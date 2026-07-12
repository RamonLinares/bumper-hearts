import * as THREE from 'three';
import { InputController } from '../core/InputController';
import { Loop } from '../core/Loop';
import { createRenderer, resizeRenderer } from '../core/Renderer';
import { assetUrl } from '../core/assetUrl';
import { Pickup } from '../entities/Pickup';
import { Player, type ArenaBounds } from '../entities/Player';
import { Rival } from '../entities/Rival';
import { AudioSystem } from '../systems/AudioSystem';
import { CameraRig, type CameraMode } from '../systems/CameraRig';
import { CollisionSystem } from '../systems/CollisionSystem';
import { DebugTools, type DebugTuning } from '../systems/DebugTools';
import { Hud } from '../systems/Hud';
import {
  CAMPAIGN_STAGES,
  clearCampaignProgress,
  loadCampaignProgress,
  saveCampaignProgress,
  type GameState,
  type StoryPhase,
} from './Campaign';

const ARENA: ArenaBounds = { halfWidth: 11, halfDepth: 7 };
const FIXED_STEP = 1 / 60;

const RIVAL_SPAWNS = [
  new THREE.Vector3(-6.5, 0, -3),
  new THREE.Vector3(6.5, 0, -3),
  new THREE.Vector3(-5, 0, 3.8),
  new THREE.Vector3(5.5, 0, 3.6),
];

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(48, 1, 0.1, 80);
  private readonly input: InputController;
  private readonly player = new Player();
  private readonly rivals = RIVAL_SPAWNS.map((position, index) => new Rival(index, position));
  private readonly pickups: Pickup[] = [];
  private readonly collision = new CollisionSystem();
  private readonly audio = new AudioSystem();
  private readonly hud = new Hud();
  private readonly cameraRig = new CameraRig(this.camera, new THREE.Vector3(0, 14.5, 13));
  private readonly loop = new Loop((delta, elapsed) => this.update(delta, elapsed), () => this.render());
  private readonly pauseButton: HTMLButtonElement;
  private readonly restartButton: HTMLButtonElement;
  private readonly cameraButton: HTMLButtonElement;
  private readonly stateOverlay: HTMLElement;
  private readonly modalPrimaryButton: HTMLButtonElement;
  private readonly modalSecondaryButton: HTMLButtonElement;
  private readonly tuning: DebugTuning = {
    speed: 6.6,
    dashMultiplier: 1.5,
    acceleration: 8.5,
    turnRate: 2.35,
    cameraLag: 0.13,
    exposure: 1.05,
    maxDpr: window.matchMedia('(pointer: coarse)').matches ? 1.5 : 2,
  };
  private readonly debugTools: DebugTools;
  private readonly impactCooldowns = new Map<number, number>();
  private readonly burstParticles: { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number }[] = [];
  private readonly cameraForward = new THREE.Vector3();
  private readonly carForward = new THREE.Vector3();
  private readonly campaign = loadCampaignProgress();
  private floorMaterial?: THREE.MeshStandardMaterial;
  private centerMaterial?: THREE.MeshStandardMaterial;
  private frame = 0;
  private stageIndex = Math.min(this.campaign.completedStages, CAMPAIGN_STAGES.length - 1);
  private storyPhase: StoryPhase = 'intro';
  private score = 0;
  private timeLeft = CAMPAIGN_STAGES[this.stageIndex].seconds;
  private state: GameState = this.campaign.completedStages >= CAMPAIGN_STAGES.length ? 'campaignComplete' : 'welcome';
  private accumulator = 0;
  private activeHits = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = createRenderer(canvas);
    this.renderer.toneMappingExposure = this.tuning.exposure;
    this.input = new InputController(this.getElement('#touch-stick'), this.getElement('#touch-knob'), this.getElement('#dash-button'));
    this.pauseButton = this.getElement<HTMLButtonElement>('#pause-button');
    this.restartButton = this.getElement<HTMLButtonElement>('#restart-button');
    this.cameraButton = this.getElement<HTMLButtonElement>('#camera-button');
    this.stateOverlay = this.getElement('#state-overlay');
    this.modalPrimaryButton = this.getElement<HTMLButtonElement>('#modal-primary');
    this.modalSecondaryButton = this.getElement<HTMLButtonElement>('#modal-secondary');
    this.pauseButton.addEventListener('click', this.togglePause);
    this.restartButton.addEventListener('click', this.restartStage);
    this.cameraButton.addEventListener('click', this.toggleCamera);
    this.modalPrimaryButton.addEventListener('click', this.handleModalPrimary);
    this.modalSecondaryButton.addEventListener('click', this.handleModalSecondary);
    this.stateOverlay.addEventListener('keydown', this.handleOverlayKeyDown);
    this.debugTools = new DebugTools(this.tuning, () => {
      this.renderer.toneMappingExposure = this.tuning.exposure;
      resizeRenderer(this.renderer, this.camera, this.tuning.maxDpr);
    });
    this.createScene();
    this.applyStagePresentation();
    this.syncHud();
    this.modalPrimaryButton.focus({ preventScroll: true });
    this.cameraRig.snapTo(this.player.group.position, this.player.group.rotation.y);
    resizeRenderer(this.renderer, this.camera, this.tuning.maxDpr);
    this.publishDiagnostics();
    window.render_game_to_text = () => JSON.stringify({
      coordinateSystem: 'arena center origin; +x right, -z forward',
      ...window.__THREE_GAME_DIAGNOSTICS__,
    });
    if (import.meta.env.DEV) {
      window.advanceTime = (milliseconds: number) => {
        const steps = Math.max(1, Math.round(milliseconds / (FIXED_STEP * 1000)));
        const elapsed = this.currentStage.seconds - this.timeLeft;
        for (let i = 0; i < steps; i += 1) this.update(FIXED_STEP, elapsed + i * FIXED_STEP);
        this.render();
      };
      window.__BUMPER_HEARTS_TEST_HOOKS__ = {
        completeStage: () => {
          if (this.state !== 'playing') return;
          this.score = this.currentStage.targetScore;
          this.completeStage();
        },
        failStage: () => {
          if (this.state !== 'playing') return;
          this.timeLeft = 0;
          this.setState('lost');
        },
      };
    }
  }

  start(): void { this.loop.start(); }

  dispose(): void {
    this.loop.stop();
    this.pauseButton.removeEventListener('click', this.togglePause);
    this.restartButton.removeEventListener('click', this.restartStage);
    this.cameraButton.removeEventListener('click', this.toggleCamera);
    this.modalPrimaryButton.removeEventListener('click', this.handleModalPrimary);
    this.modalSecondaryButton.removeEventListener('click', this.handleModalSecondary);
    this.stateOverlay.removeEventListener('keydown', this.handleOverlayKeyDown);
    this.input.dispose();
    this.audio.dispose();
    this.debugTools.dispose();
    this.pickups.forEach((pickup) => pickup.dispose());
    this.rivals.forEach((rival) => rival.dispose());
    this.player.dispose();
    this.renderer.dispose();
    window.__THREE_GAME_DIAGNOSTICS__ = undefined;
    window.render_game_to_text = undefined;
    if (import.meta.env.DEV) {
      window.advanceTime = undefined;
      window.__BUMPER_HEARTS_TEST_HOOKS__ = undefined;
    }
  }

  private get currentStage() { return CAMPAIGN_STAGES[this.stageIndex]; }

  private get activeRivals(): Rival[] { return this.rivals.filter((rival) => rival.group.visible); }

  private readonly togglePause = () => {
    if (this.state !== 'playing' && this.state !== 'paused') return;
    this.setState(this.state === 'paused' ? 'playing' : 'paused');
    this.pauseButton.setAttribute('aria-label', this.state === 'paused' ? 'Resume ride' : 'Pause ride');
  };

  private readonly toggleCamera = () => {
    if (this.state !== 'playing') return;
    const nextMode: CameraMode = this.cameraRig.currentMode === 'overhead' ? 'cockpit' : 'overhead';
    this.cameraRig.setMode(nextMode, this.player.group.position, this.player.group.rotation.y);
    const cockpit = nextMode === 'cockpit';
    this.cameraButton.setAttribute('aria-pressed', String(cockpit));
    this.cameraButton.setAttribute('aria-label', cockpit ? 'Switch to overhead view' : 'Switch to first-person view');
    this.cameraButton.title = cockpit ? 'Overhead view (C)' : 'First-person view (C)';
  };

  private readonly handleModalPrimary = () => {
    if (this.state === 'welcome') this.showStageIntro();
    else if (this.state === 'story') this.advanceStory();
    else if (this.state === 'paused') this.togglePause();
    else if (this.state === 'lost') this.restartStage();
    else if (this.state === 'campaignComplete') {
      this.resetCampaign();
      this.showStageIntro();
    }
  };

  private readonly handleModalSecondary = () => {
    if (this.state === 'welcome') {
      this.resetCampaign();
      this.showStageIntro();
    } else if (this.state === 'paused') this.restartStage();
  };

  private readonly handleOverlayKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Tab' || this.state === 'playing') return;
    const buttons = [this.modalPrimaryButton, this.modalSecondaryButton].filter((button) => !button.hidden && !button.disabled);
    if (buttons.length === 0) return;
    const activeIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex = event.shiftKey
      ? (activeIndex <= 0 ? buttons.length - 1 : activeIndex - 1)
      : (activeIndex >= buttons.length - 1 ? 0 : activeIndex + 1);
    event.preventDefault();
    buttons[nextIndex].focus({ preventScroll: true });
  };

  private showStageIntro(): void {
    this.storyPhase = 'intro';
    this.setState('story', true);
  }

  private advanceStory(): void {
    if (this.storyPhase === 'intro') {
      this.restartStage();
      return;
    }
    if (this.stageIndex === CAMPAIGN_STAGES.length - 1) {
      this.setState('campaignComplete', true);
      return;
    }
    this.stageIndex = Math.min(this.stageIndex + 1, CAMPAIGN_STAGES.length - 1);
    this.storyPhase = 'intro';
    this.score = 0;
    this.timeLeft = this.currentStage.seconds;
    this.applyStagePresentation();
    this.setState('story', true);
  }

  private resetCampaign(): void {
    this.stageIndex = 0;
    this.campaign.completedStages = 0;
    this.campaign.campaignScore = 0;
    this.storyPhase = 'intro';
    this.score = 0;
    this.timeLeft = CAMPAIGN_STAGES[0].seconds;
    this.accumulator = 0;
    this.activeHits = 0;
    this.impactCooldowns.clear();
    this.clearParticles();
    clearCampaignProgress();
    this.applyStagePresentation();
  }

  private readonly restartStage = () => {
    this.score = 0;
    this.timeLeft = this.currentStage.seconds;
    this.accumulator = 0;
    this.activeHits = 0;
    this.impactCooldowns.clear();
    this.player.reset();
    this.rivals.forEach((rival, index) => {
      const bossScale = this.currentStage.bossRival?.index === index ? this.currentStage.bossRival.scale : 1;
      rival.configure(this.currentStage.difficulty, index < this.currentStage.rivalCount, bossScale);
      rival.reset(RIVAL_SPAWNS[index]);
    });
    this.pickups.forEach((pickup) => {
      pickup.active = true;
      pickup.group.visible = true;
    });
    this.clearParticles();
    this.pauseButton.setAttribute('aria-label', 'Pause ride');
    this.cameraRig.snapTo(this.player.group.position, this.player.group.rotation.y);
    this.applyStagePresentation();
    this.setState('playing', true);
  };

  private update(delta: number, elapsed: number): void {
    this.frame += 1;
    resizeRenderer(this.renderer, this.camera, this.tuning.maxDpr);
    if (this.input.consumeRestart() && (this.state === 'playing' || this.state === 'paused' || this.state === 'lost')) this.restartStage();
    if (this.input.consumePause()) this.togglePause();
    if (this.input.consumeCameraToggle()) this.toggleCamera();

    if (this.state === 'playing') {
      this.accumulator += Math.min(delta, 0.05);
      while (this.accumulator >= FIXED_STEP && this.state === 'playing') {
        this.simulate(FIXED_STEP, elapsed);
        this.accumulator -= FIXED_STEP;
      }
    }
    this.updateParticles(delta);
    this.pickups.forEach((pickup) => pickup.update(delta, elapsed));
    this.cameraRig.update(delta, this.player.group.position, this.player.group.rotation.y, this.tuning.cameraLag);
    this.syncHud();
    this.publishDiagnostics();
  }

  private simulate(delta: number, elapsed: number): void {
    this.timeLeft = Math.max(0, this.timeLeft - delta);
    this.player.update(
      delta,
      elapsed,
      this.input,
      this.tuning,
      this.cameraRig.currentMode === 'cockpit' ? 'vehicle' : 'arena',
      ARENA,
    );
    this.activeRivals.forEach((rival) => rival.update(delta, this.player.group.position, ARENA));
    this.collision.keepInArena(this.player, ARENA);
    this.activeRivals.forEach((rival) => this.collision.keepInArena(rival, ARENA));

    this.activeHits = 0;
    for (const rival of this.activeRivals) {
      const strength = this.collision.resolveCars(this.player, rival);
      if (strength > 1.15) this.registerPlayerImpact(rival, strength);
    }
    const activeRivals = this.activeRivals;
    for (let i = 0; i < activeRivals.length; i += 1) {
      for (let j = i + 1; j < activeRivals.length; j += 1) this.collision.resolveCars(activeRivals[i], activeRivals[j], 0.78);
    }

    const collected = this.collision.collectPickups(this.player.group.position, this.pickups, this.player.radius);
    for (const pickup of collected) {
      this.score += 125;
      this.audio.pickup(pickup.index);
      this.hud.flashPickup();
      this.spawnBurst(pickup.group.position, '#ffd86b');
    }
    for (const [index, cooldown] of this.impactCooldowns) {
      const next = cooldown - delta;
      if (next <= 0) this.impactCooldowns.delete(index);
      else this.impactCooldowns.set(index, next);
    }
    if (this.score >= this.currentStage.targetScore) this.completeStage();
    else if (this.timeLeft <= 0) this.setState('lost');
  }

  private completeStage(): void {
    this.accumulator = 0;
    this.campaign.campaignScore += this.score;
    this.campaign.completedStages = Math.max(this.campaign.completedStages, this.stageIndex + 1);
    saveCampaignProgress(this.campaign);
    this.storyPhase = 'outro';
    this.setState('story', true);
  }

  private setState(nextState: GameState, force = false): void {
    if (this.state === nextState && !force) return;
    this.state = nextState;
    this.syncHud();
    if (nextState === 'playing') this.canvas.focus({ preventScroll: true });
    else this.modalPrimaryButton.focus({ preventScroll: true });
  }

  private syncHud(): void {
    this.hud.update({
      state: this.state,
      score: this.score,
      target: this.currentStage.targetScore,
      timeLeft: this.timeLeft,
      stage: this.currentStage,
      stageNumber: this.stageIndex + 1,
      stageCount: CAMPAIGN_STAGES.length,
      campaignScore: this.campaign.campaignScore,
      completedStages: this.campaign.completedStages,
      storyPhase: this.storyPhase,
    });
  }

  private applyStagePresentation(): void {
    this.rivals.forEach((rival, index) => {
      const bossScale = this.currentStage.bossRival?.index === index ? this.currentStage.bossRival.scale : 1;
      rival.configure(this.currentStage.difficulty, index < this.currentStage.rivalCount, bossScale);
    });
    this.floorMaterial?.color.set(this.currentStage.theme.floorTint);
    this.centerMaterial?.color.set(this.currentStage.theme.accent);
    if (this.scene.fog instanceof THREE.Fog) this.scene.fog.color.set(this.currentStage.theme.fog);
  }

  private registerPlayerImpact(rival: Rival, strength: number): void {
    if (this.impactCooldowns.has(rival.index)) return;
    this.impactCooldowns.set(rival.index, 0.42);
    this.activeHits += 1;
    this.score += Math.round(35 + Math.min(strength, 10) * 13);
    this.audio.impact(strength);
    this.hud.flashImpact();
    const point = this.player.group.position.clone().lerp(rival.group.position, 0.5);
    this.spawnBurst(point, '#fff3c4');
  }

  private render(): void { this.renderer.render(this.scene, this.camera); }

  private createScene(): void {
    this.scene.background = new THREE.Color('#18314f');
    this.scene.fog = new THREE.Fog('#25314a', 25, 52);
    new THREE.TextureLoader().load(assetUrl('assets/backgrounds/nostalgic-carnival-diorama.png'), (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.mapping = THREE.EquirectangularReflectionMapping;
      this.scene.background = texture;
    });
    this.scene.add(new THREE.HemisphereLight('#fff0c2', '#252038', 1.75));
    const sun = new THREE.DirectionalLight('#ffd9a0', 2.55);
    sun.position.set(-6, 11, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { near: 0.5, far: 35, left: -15, right: 15, top: 12, bottom: -12 });
    const coolFill = new THREE.DirectionalLight('#8fb9d8', 0.82);
    coolFill.position.set(8, 8, -10);
    const rim = new THREE.PointLight('#fff0c2', 18, 28, 2);
    rim.position.set(0, 5.8, -9);
    this.scene.add(sun, coolFill, rim, this.createArena(), this.createPavilion(), this.player.group);
    this.rivals.forEach((rival) => this.scene.add(rival.group));
    this.createPickups();
  }

  private createArena(): THREE.Group {
    const arena = new THREE.Group();
    arena.name = 'LayeredPocketArena';
    const floorTexture = this.createFloorTexture();
    floorTexture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    this.floorMaterial = new THREE.MeshStandardMaterial({
      color: this.currentStage.theme.floorTint,
      map: floorTexture,
      roughness: 0.62,
      metalness: 0.16,
    });
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(ARENA.halfWidth * 2, ARENA.halfDepth * 2),
      this.floorMaterial,
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    arena.add(floor);
    const railPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-ARENA.halfWidth - 0.2, 0.38, -ARENA.halfDepth - 0.2),
      new THREE.Vector3(ARENA.halfWidth + 0.2, 0.38, -ARENA.halfDepth - 0.2),
      new THREE.Vector3(ARENA.halfWidth + 0.2, 0.38, ARENA.halfDepth + 0.2),
      new THREE.Vector3(-ARENA.halfWidth - 0.2, 0.38, ARENA.halfDepth + 0.2),
    ], true, 'catmullrom', 0.04);
    const outerRail = new THREE.Mesh(new THREE.TubeGeometry(railPath, 180, 0.23, 10, true), new THREE.MeshStandardMaterial({ color: '#ded4c5', roughness: 0.23, metalness: 0.76 }));
    outerRail.castShadow = true;
    outerRail.receiveShadow = true;
    arena.add(outerRail);
    const cushionPath = railPath.clone();
    const cushion = new THREE.Mesh(new THREE.TubeGeometry(cushionPath, 180, 0.105, 8, true), new THREE.MeshStandardMaterial({ color: '#c83e4d', roughness: 0.64 }));
    cushion.position.y = 0.25;
    arena.add(cushion);

    const heartShape = new THREE.Shape();
    heartShape.moveTo(0, -1.05);
    heartShape.bezierCurveTo(-0.2, -0.75, -1.15, -0.2, -1.15, 0.48);
    heartShape.bezierCurveTo(-1.15, 1.25, -0.2, 1.34, 0, 0.72);
    heartShape.bezierCurveTo(0.2, 1.34, 1.15, 1.25, 1.15, 0.48);
    heartShape.bezierCurveTo(1.15, -0.2, 0.2, -0.75, 0, -1.05);
    this.centerMaterial = new THREE.MeshStandardMaterial({ color: this.currentStage.theme.accent, roughness: 0.42, metalness: 0.28 });
    const center = new THREE.Mesh(new THREE.ShapeGeometry(heartShape, 16), this.centerMaterial);
    center.rotation.x = -Math.PI / 2;
    center.position.y = 0.022;
    center.scale.setScalar(0.8);
    arena.add(center);

    const seamMaterial = new THREE.MeshBasicMaterial({ color: '#fff0c2', transparent: true, opacity: 0.22 });
    for (let i = 1; i <= 3; i += 1) {
      const seam = new THREE.Mesh(new THREE.RingGeometry(i * 2.35, i * 2.35 + 0.035, 64), seamMaterial);
      seam.rotation.x = -Math.PI / 2;
      seam.position.y = 0.024;
      seam.scale.z = 0.62;
      arena.add(seam);
    }
    return arena;
  }

  private createPavilion(): THREE.Group {
    const pavilion = new THREE.Group();
    pavilion.name = 'PocketFairgroundPavilion';
    const wood = new THREE.MeshStandardMaterial({ color: '#6b4c3b', roughness: 0.78, metalness: 0.02 });
    const cream = new THREE.MeshStandardMaterial({ color: '#fff0c2', roughness: 0.6 });
    const coral = new THREE.MeshStandardMaterial({ color: '#e96b62', roughness: 0.56 });
    const chrome = new THREE.MeshStandardMaterial({ color: '#cfc5b7', roughness: 0.28, metalness: 0.72 });
    const bulb = new THREE.MeshStandardMaterial({ color: '#fff0c2', emissive: '#f5c45b', emissiveIntensity: 1.8, roughness: 0.28 });
    const postGeometry = new THREE.CylinderGeometry(0.18, 0.24, 5.8, 12);
    for (const [x, z] of [[-11.7, -7.7], [11.7, -7.7], [-11.7, 7.7], [11.7, 7.7]]) {
      const post = new THREE.Mesh(postGeometry, wood);
      post.position.set(x, 2.9, z);
      post.castShadow = true;
      pavilion.add(post);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), cream);
      cap.position.set(x, 5.8, z);
      pavilion.add(cap);
    }

    const valanceGeometry = new THREE.BoxGeometry(23.8, 0.68, 0.24);
    const farValance = new THREE.Mesh(valanceGeometry, coral);
    farValance.position.set(0, 5.18, -7.7);
    farValance.castShadow = true;
    pavilion.add(farValance);
    const trimGeometry = new THREE.BoxGeometry(23.8, 0.12, 0.3);
    const trim = new THREE.Mesh(trimGeometry, cream);
    trim.position.set(0, 4.86, -7.7);
    pavilion.add(trim);

    const bulbGeometry = new THREE.SphereGeometry(0.09, 8, 6);
    const bulbs = new THREE.InstancedMesh(bulbGeometry, bulb, 34);
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < 34; i += 1) {
      const x = -11.3 + (22.6 * i) / 33;
      matrix.makeTranslation(x, 5.2 + (i % 2) * 0.05, -7.48);
      bulbs.setMatrixAt(i, matrix);
    }
    pavilion.add(bulbs);

    const booth = new THREE.Group();
    booth.name = 'TicketBooth';
    const boothBase = new THREE.Mesh(new THREE.BoxGeometry(2.25, 1.55, 1.05), wood);
    boothBase.position.y = 0.78;
    const boothWindow = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.7, 0.035), new THREE.MeshStandardMaterial({ color: '#18314f', emissive: '#4e9f9b', emissiveIntensity: 0.25, roughness: 0.18 }));
    boothWindow.position.set(0, 1.0, 0.54);
    const boothSign = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.35, 0.14), cream);
    boothSign.position.set(0, 1.75, 0.18);
    booth.add(boothBase, boothWindow, boothSign);
    booth.position.set(-9.3, 0, -8.35);
    pavilion.add(booth);

    const speakerGeometry = new THREE.BoxGeometry(0.7, 1.15, 0.58);
    for (const x of [-6.8, 6.8]) {
      const speaker = new THREE.Mesh(speakerGeometry, new THREE.MeshStandardMaterial({ color: '#25212a', roughness: 0.8 }));
      speaker.position.set(x, 0.58, -8.1);
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.08, 18), chrome);
      cone.rotation.x = Math.PI / 2;
      cone.position.set(x, 0.65, -7.77);
      pavilion.add(speaker, cone);
    }

    const pennantGeometry = new THREE.ConeGeometry(0.18, 0.5, 3);
    for (let i = 0; i < 15; i += 1) {
      const pennant = new THREE.Mesh(pennantGeometry, i % 2 ? coral : cream);
      pennant.rotation.z = Math.PI;
      pennant.position.set(-8.4 + i * 1.2, 4.68 - Math.sin(i / 14 * Math.PI) * 0.35, -7.4);
      pavilion.add(pennant);
    }
    return pavilion;
  }

  private createPickups(): void {
    const positions = [[-8, -4], [-3, -5], [3, -4.8], [8, -3], [-7.5, 3.5], [-1.5, 4.7], [4.5, 3.8], [8.2, 1.4]];
    positions.forEach(([x, z], index) => {
      const pickup = new Pickup(index, new THREE.Vector3(x, 0.8, z));
      this.pickups.push(pickup);
      this.scene.add(pickup.group);
    });
  }

  private spawnBurst(position: THREE.Vector3, color: string): void {
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i += 1) {
      const radius = i % 2 === 0 ? 0.095 : 0.04;
      const angle = -Math.PI / 2 + i * Math.PI / 5;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    const geometry = new THREE.ShapeGeometry(shape);
    const material = new THREE.MeshBasicMaterial({ color });
    for (let i = 0; i < 8; i += 1) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(position).add(new THREE.Vector3(0, 0.42, 0));
      const angle = i / 8 * Math.PI * 2;
      mesh.rotation.set(Math.PI / 2, angle, angle * 0.5);
      this.burstParticles.push({ mesh, velocity: new THREE.Vector3(Math.cos(angle) * 2.6, 1.8 + (i % 2), Math.sin(angle) * 2.6), life: 0.45 });
      this.scene.add(mesh);
    }
  }

  private updateParticles(delta: number): void {
    for (let i = this.burstParticles.length - 1; i >= 0; i -= 1) {
      const particle = this.burstParticles[i];
      particle.life -= delta;
      particle.velocity.y -= delta * 6;
      particle.mesh.position.addScaledVector(particle.velocity, delta);
      particle.mesh.scale.setScalar(Math.max(0.01, particle.life * 2));
      if (particle.life <= 0) {
        this.scene.remove(particle.mesh);
        particle.mesh.geometry.dispose();
        (particle.mesh.material as THREE.Material).dispose();
        this.burstParticles.splice(i, 1);
      }
    }
  }

  private clearParticles(): void {
    this.burstParticles.forEach((particle) => {
      this.scene.remove(particle.mesh);
      particle.mesh.geometry.dispose();
      (particle.mesh.material as THREE.Material).dispose();
    });
    this.burstParticles.length = 0;
  }

  private createFloorTexture(): THREE.CanvasTexture {
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = textureCanvas.height = 512;
    const context = textureCanvas.getContext('2d');
    if (!context) throw new Error('Could not create floor texture context.');

    // A single authored arena surface: aged graphite enamel over modular steel
    // plates. Keep the mid-tones visible so shadows add depth instead of
    // turning the playfield into a black void.
    context.fillStyle = '#52575a';
    context.fillRect(0, 0, 512, 512);

    const panelSize = 64;
    for (let row = 0; row < 8; row += 1) {
      for (let column = 0; column < 8; column += 1) {
        const warmPanel = (row + column) % 3 === 0;
        context.fillStyle = warmPanel
          ? 'rgba(111, 99, 87, 0.22)'
          : 'rgba(47, 77, 78, 0.16)';
        context.fillRect(column * panelSize + 2, row * panelSize + 2, panelSize - 4, panelSize - 4);
      }
    }

    const centerGlow = context.createRadialGradient(256, 236, 24, 256, 256, 350);
    centerGlow.addColorStop(0, 'rgba(255, 220, 157, 0.18)');
    centerGlow.addColorStop(0.48, 'rgba(244, 196, 91, 0.045)');
    centerGlow.addColorStop(1, 'rgba(8, 15, 24, 0.28)');
    context.fillStyle = centerGlow;
    context.fillRect(0, 0, 512, 512);

    // Recessed plate seams with a warm worn lip.
    for (let i = 0; i <= 512; i += panelSize) {
      context.strokeStyle = 'rgba(15, 24, 29, 0.66)';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(i, 0);
      context.lineTo(i, 512);
      context.moveTo(0, i);
      context.lineTo(512, i);
      context.stroke();
      context.strokeStyle = 'rgba(218, 190, 139, 0.16)';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(i + 2, 0);
      context.lineTo(i + 2, 512);
      context.moveTo(0, i + 2);
      context.lineTo(512, i + 2);
      context.stroke();
    }

    // Rivets reinforce the miniature scale without adding geometry or draw calls.
    for (let y = panelSize; y < 512; y += panelSize) {
      for (let x = panelSize; x < 512; x += panelSize) {
        context.fillStyle = 'rgba(229, 204, 153, 0.42)';
        context.beginPath();
        context.arc(x + 5, y + 5, 2.2, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = 'rgba(12, 20, 25, 0.48)';
        context.beginPath();
        context.arc(x + 5.8, y + 5.8, 1.1, 0, Math.PI * 2);
        context.fill();
      }
    }

    // Overlapping tyre arcs, softened by years of use.
    context.lineCap = 'round';
    for (let i = 0; i < 18; i += 1) {
      const x = 54 + ((i * 83) % 410);
      const y = 48 + ((i * 137) % 408);
      context.strokeStyle = i % 3 === 0 ? 'rgba(18, 20, 22, 0.34)' : 'rgba(29, 31, 32, 0.23)';
      context.lineWidth = 3 + (i % 3);
      context.beginPath();
      context.ellipse(x, y, 42 + (i % 4) * 16, 13 + (i % 3) * 7, i * 0.47, 0.18, Math.PI * (1.18 + (i % 3) * 0.18));
      context.stroke();
    }

    // Fine scratches and worn enamel flecks—deterministic, sparse, and stable.
    for (let i = 0; i < 110; i += 1) {
      const x = (i * 97 + 23) % 512;
      const y = (i * 173 + 41) % 512;
      const length = 3 + (i % 11);
      context.strokeStyle = i % 4 === 0
        ? 'rgba(238, 215, 170, 0.18)'
        : 'rgba(21, 31, 34, 0.2)';
      context.lineWidth = i % 5 === 0 ? 1.5 : 0.8;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + length, y + ((i % 5) - 2));
      context.stroke();
    }

    // Soft oil and rubber haze in a few high-traffic areas.
    for (const [x, y, radius] of [[126, 346, 52], [392, 162, 44], [332, 386, 60]] as const) {
      const stain = context.createRadialGradient(x, y, 0, x, y, radius);
      stain.addColorStop(0, 'rgba(14, 27, 30, 0.2)');
      stain.addColorStop(1, 'rgba(14, 27, 30, 0)');
      context.fillStyle = stain;
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }

    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private publishDiagnostics(): void {
    const info = this.renderer.info;
    this.camera.getWorldDirection(this.cameraForward);
    this.carForward.set(0, 0, -1).applyAxisAngle(THREE.Object3D.DEFAULT_UP, this.player.group.rotation.y);
    window.__THREE_GAME_DIAGNOSTICS__ = {
      frame: this.frame,
      elapsed: this.currentStage.seconds - this.timeLeft,
      score: this.score,
      targetScore: this.currentStage.targetScore,
      complete: this.state === 'campaignComplete',
      state: this.state,
      timeLeft: this.timeLeft,
      campaign: {
        stageIndex: this.stageIndex,
        stageNumber: this.stageIndex + 1,
        stageCount: CAMPAIGN_STAGES.length,
        stageId: this.currentStage.id,
        stageTitle: this.currentStage.title,
        completedStages: this.campaign.completedStages,
        campaignScore: this.campaign.campaignScore,
        storyPhase: this.storyPhase,
        connection: this.currentStage[this.storyPhase].connection,
        pressure: this.currentStage[this.storyPhase].pressure,
        rivalCount: this.currentStage.rivalCount,
        rivalSpeedMultiplier: this.currentStage.difficulty.speedMultiplier,
        bossRivalIndex: this.currentStage.bossRival?.index ?? null,
      },
      physics: { engine: 'custom-arcade', timestep: FIXED_STEP, bodies: 1 + this.activeRivals.length, colliders: 1 + this.activeRivals.length + this.pickups.filter((pickup) => pickup.active).length, activeHits: this.activeHits },
      input: { dash: this.input.isDashHeld() },
      entities: {
        rivals: this.activeRivals.length,
        importedCars: this.scene.children.reduce((count, child) => {
          let imported = 0;
          child.traverse((descendant) => {
            if (descendant.name.startsWith('ImportedHeroVisual') || descendant.name.startsWith('ImportedRivalVisual')) imported += 1;
          });
          return count + imported;
        }, 0),
        pickupsActive: this.pickups.filter((pickup) => pickup.active).length,
        particles: this.burstParticles.length,
      },
      player: {
        position: { x: this.player.group.position.x, y: this.player.group.position.y, z: this.player.group.position.z },
        speed: this.player.velocity.length(),
        velocity: { x: this.player.velocity.x, z: this.player.velocity.z },
        yaw: this.player.group.rotation.y,
        controlMode: this.player.controlMode,
      },
      camera: {
        mode: this.cameraRig.currentMode,
        fov: this.camera.fov,
        position: { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z },
        playerVisualVisible: this.player.group.visible,
        forward: { x: this.cameraForward.x, y: this.cameraForward.y, z: this.cameraForward.z },
        carForwardAlignment: this.cameraForward.dot(this.carForward),
      },
      renderer: { calls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures },
      canvas: { clientWidth: this.canvas.clientWidth, clientHeight: this.canvas.clientHeight, width: this.canvas.width, height: this.canvas.height, dpr: Math.min(window.devicePixelRatio || 1, this.tuning.maxDpr) },
    };
  }

  private getElement<T extends HTMLElement = HTMLElement>(selector: string): T {
    const element = document.querySelector<T>(selector);
    if (!element) throw new Error(`Missing element: ${selector}`);
    return element;
  }
}
