import * as THREE from 'three';
import { InputController } from '../core/InputController';
import { Loop } from '../core/Loop';
import { createRenderer, resizeRenderer } from '../core/Renderer';
import { assetUrl } from '../core/assetUrl';
import { createStageFloorTexture } from '../assets/StageFloorTexture';
import { Pickup, type PowerUpType } from '../entities/Pickup';
import { Player, type ArenaBounds } from '../entities/Player';
import { Rival } from '../entities/Rival';
import { AudioSystem } from '../systems/AudioSystem';
import { CameraRig, type CameraMode } from '../systems/CameraRig';
import { CollisionSystem } from '../systems/CollisionSystem';
import { DebugTools, type DebugTuning } from '../systems/DebugTools';
import { Hud } from '../systems/Hud';
import { StageDressing } from '../systems/StageDressing';
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

const POWER_UPS: readonly { type: PowerUpType; kind: 'fuse' | 'trophy-star' | 'storm-lantern'; color: string }[] = [
  { type: 'repair', kind: 'fuse', color: '#61e3a3' },
  { type: 'overdrive', kind: 'trophy-star', color: '#ffad42' },
  { type: 'shock', kind: 'storm-lantern', color: '#6fcfff' },
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
  private readonly fxButton: HTMLButtonElement;
  private readonly musicButton: HTMLButtonElement;
  private readonly stateOverlay: HTMLElement;
  private readonly modalPrimaryButton: HTMLButtonElement;
  private readonly modalSecondaryButton: HTMLButtonElement;
  private readonly tuning: DebugTuning = {
    speed: 7.1,
    dashMultiplier: 2.05,
    acceleration: 10.5,
    turnRate: 2.35,
    cameraLag: 0.13,
    exposure: 1.05,
    maxDpr: window.matchMedia('(pointer: coarse)').matches ? 1.5 : 2,
  };
  private readonly debugTools: DebugTools;
  private readonly impactCooldowns = new Map<number, number>();
  private readonly rivalImpactCooldowns = new Map<string, number>();
  private readonly burstParticles: { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number }[] = [];
  private readonly impactRings: { mesh: THREE.Mesh; life: number; maxLife: number }[] = [];
  private readonly cameraForward = new THREE.Vector3();
  private readonly carForward = new THREE.Vector3();
  private readonly campaign = loadCampaignProgress();
  private floorMaterial?: THREE.MeshStandardMaterial;
  private floorTexture?: THREE.Texture;
  private stageDressing?: StageDressing;
  private keyLight?: THREE.DirectionalLight;
  private fillLight?: THREE.DirectionalLight;
  private rimLight?: THREE.PointLight;
  private frame = 0;
  private stageIndex = Math.min(this.campaign.completedStages, CAMPAIGN_STAGES.length - 1);
  private storyPhase: StoryPhase = 'intro';
  private score = 0;
  private timeLeft = CAMPAIGN_STAGES[this.stageIndex].seconds;
  private state: GameState = this.campaign.completedStages >= CAMPAIGN_STAGES.length ? 'campaignComplete' : 'welcome';
  private accumulator = 0;
  private activeHits = 0;
  private wasDashing = false;
  private playerHealth = 100;
  private readonly playerMaxHealth = 100;
  private damageBoostTime = 0;
  private boostCharge = 100;
  private boosting = false;
  private eliminations = 0;
  private presentedStageId: string | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = createRenderer(canvas);
    this.renderer.toneMappingExposure = this.tuning.exposure;
    this.input = new InputController(this.getElement('#touch-stick'), this.getElement('#touch-knob'), this.getElement('#dash-button'));
    this.pauseButton = this.getElement<HTMLButtonElement>('#pause-button');
    this.restartButton = this.getElement<HTMLButtonElement>('#restart-button');
    this.cameraButton = this.getElement<HTMLButtonElement>('#camera-button');
    this.fxButton = this.getElement<HTMLButtonElement>('#fx-button');
    this.musicButton = this.getElement<HTMLButtonElement>('#music-button');
    this.stateOverlay = this.getElement('#state-overlay');
    this.modalPrimaryButton = this.getElement<HTMLButtonElement>('#modal-primary');
    this.modalSecondaryButton = this.getElement<HTMLButtonElement>('#modal-secondary');
    this.pauseButton.addEventListener('click', this.togglePause);
    this.restartButton.addEventListener('click', this.restartStage);
    this.cameraButton.addEventListener('click', this.toggleCamera);
    this.fxButton.addEventListener('click', this.toggleEffects);
    this.musicButton.addEventListener('click', this.toggleMusic);
    this.modalPrimaryButton.addEventListener('click', this.handleModalPrimary);
    this.modalSecondaryButton.addEventListener('click', this.handleModalSecondary);
    this.stateOverlay.addEventListener('keydown', this.handleOverlayKeyDown);
    window.addEventListener('keydown', this.handleGlobalAudioKey);
    this.debugTools = new DebugTools(this.tuning, () => {
      this.renderer.toneMappingExposure = this.tuning.exposure;
      resizeRenderer(this.renderer, this.camera, this.tuning.maxDpr);
    });
    this.createScene();
    this.syncAudioButtons();
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
          this.rivals.forEach((rival) => {
            if (rival.group.visible) rival.takeDamage(rival.health);
          });
          this.eliminations = this.currentStage.rivalCount;
          this.completeStage();
        },
        failStage: () => {
          if (this.state !== 'playing') return;
          this.playerHealth = 0;
          this.failStage();
        },
        damagePlayer: (amount: number) => {
          if (this.state !== 'playing') return;
          this.playerHealth = Math.max(0, this.playerHealth - Math.max(0, amount));
        },
        damageRival: (index: number, amount: number) => {
          if (this.state !== 'playing') return;
          const rival = this.rivals[index];
          if (!rival?.group.visible) return;
          const point = rival.group.position.clone();
          if (rival.takeDamage(amount)) this.eliminateRival(rival, point);
        },
        collectPowerUp: (type: PowerUpType) => {
          if (this.state !== 'playing') return;
          this.applyPowerUp(type, this.player.group.position.clone());
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
    this.fxButton.removeEventListener('click', this.toggleEffects);
    this.musicButton.removeEventListener('click', this.toggleMusic);
    this.modalPrimaryButton.removeEventListener('click', this.handleModalPrimary);
    this.modalSecondaryButton.removeEventListener('click', this.handleModalSecondary);
    this.stateOverlay.removeEventListener('keydown', this.handleOverlayKeyDown);
    window.removeEventListener('keydown', this.handleGlobalAudioKey);
    this.input.dispose();
    this.audio.dispose();
    this.stageDressing?.dispose();
    this.floorTexture?.dispose();
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
    const pausing = this.state === 'playing';
    if (pausing) {
      this.audio.pauseCue();
      window.setTimeout(() => void this.audio.setPaused(true), 120);
    } else {
      void this.audio.setPaused(false);
    }
    this.setState(pausing ? 'paused' : 'playing');
    this.pauseButton.setAttribute('aria-label', this.state === 'paused' ? 'Resume ride' : 'Pause ride');
  };

  private readonly toggleEffects = () => {
    const muted = this.audio.toggleEffectsMuted();
    this.syncAudioButtons();
    if (!muted) void this.audio.unlock().then(() => this.audio.confirm());
  };

  private readonly toggleMusic = () => {
    this.audio.toggleMusicMuted();
    this.syncAudioButtons();
    void this.audio.unlock();
  };

  private readonly handleGlobalAudioKey = (event: KeyboardEvent) => {
    if (event.repeat) return;
    if (event.code === 'KeyM') this.toggleEffects();
    else if (event.code === 'KeyN') this.toggleMusic();
  };

  private syncAudioButtons(): void {
    const effectsMuted = this.audio.areEffectsMuted();
    const musicMuted = this.audio.isMusicMuted();
    this.fxButton.setAttribute('aria-pressed', String(effectsMuted));
    this.fxButton.setAttribute('aria-label', effectsMuted ? 'Unmute effects' : 'Mute effects');
    this.fxButton.title = effectsMuted ? 'Unmute effects (M)' : 'Mute effects (M)';
    this.fxButton.querySelector('.sound-glyph')!.textContent = effectsMuted ? 'FX̸' : 'FX';
    this.musicButton.setAttribute('aria-pressed', String(musicMuted));
    this.musicButton.setAttribute('aria-label', musicMuted ? 'Unmute music' : 'Mute music');
    this.musicButton.title = musicMuted ? 'Unmute music (N)' : 'Mute music (N)';
    this.musicButton.querySelector('.sound-glyph')!.textContent = musicMuted ? '♫̸' : '♫';
  }

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
    void this.audio.unlock().then(() => this.audio.confirm());
  };

  private readonly handleModalSecondary = () => {
    if (this.state === 'welcome') {
      this.resetCampaign();
      this.showStageIntro();
    } else if (this.state === 'paused') this.restartStage();
    void this.audio.unlock().then(() => this.audio.confirm());
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
    this.rivalImpactCooldowns.clear();
    this.clearParticles();
    clearCampaignProgress();
    this.applyStagePresentation();
  }

  private readonly restartStage = () => {
    this.score = 0;
    this.eliminations = 0;
    this.playerHealth = this.playerMaxHealth;
    this.damageBoostTime = 0;
    this.boostCharge = 100;
    this.boosting = false;
    this.timeLeft = this.currentStage.seconds;
    this.accumulator = 0;
    this.activeHits = 0;
    this.wasDashing = false;
    this.impactCooldowns.clear();
    this.rivalImpactCooldowns.clear();
    this.player.reset();
    this.rivals.forEach((rival, index) => {
      const bossScale = this.currentStage.bossRival?.index === index ? this.currentStage.bossRival.scale : 1;
      const bossHealth = this.currentStage.bossRival?.index === index ? 1.35 : 1;
      rival.configureCombat((62 + this.stageIndex * 7) * bossHealth);
      rival.configure(this.currentStage.difficulty, index < this.currentStage.rivalCount, bossScale);
      rival.reset(RIVAL_SPAWNS[index]);
    });
    this.pickups.forEach((pickup, index) => {
      const config = POWER_UPS[index % POWER_UPS.length];
      const [x, z] = this.currentStage.collectibles.positions[index];
      pickup.reconfigure(config.kind, config.color, new THREE.Vector3(x, 0.8, z), config.type);
    });
    this.clearParticles();
    this.pauseButton.setAttribute('aria-label', 'Pause ride');
    this.cameraRig.snapTo(this.player.group.position, this.player.group.rotation.y);
    this.applyStagePresentation();
    this.setState('playing', true);
    void this.audio.setPaused(false).then(() => {
      if (this.currentStage.bossRival) this.audio.bossCue();
    });
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
    this.stageDressing?.update(delta, elapsed);
    this.cameraRig.update(delta, this.player.group.position, this.player.group.rotation.y, this.tuning.cameraLag);
    this.syncHud();
    this.publishDiagnostics();
  }

  private simulate(delta: number, elapsed: number): void {
    this.timeLeft = Math.max(0, this.timeLeft - delta);
    this.damageBoostTime = Math.max(0, this.damageBoostTime - delta);
    const wantsBoost = this.input.isDashHeld();
    this.boosting = wantsBoost && this.boostCharge > 0.5;
    this.boostCharge = THREE.MathUtils.clamp(
      this.boostCharge + (this.boosting ? -46 : 18) * delta,
      0,
      100,
    );
    this.player.update(
      delta,
      elapsed,
      this.input,
      this.tuning,
      this.cameraRig.currentMode === 'cockpit' ? 'vehicle' : 'arena',
      this.boosting,
      ARENA,
    );
    const dashing = this.boosting;
    if (dashing && !this.wasDashing) this.audio.boost();
    this.wasDashing = dashing;
    const rivalsBeforeStep = this.activeRivals;
    rivalsBeforeStep.forEach((rival) => {
      let target = this.player.group.position;
      let bestDistance = rival.group.position.distanceToSquared(target);
      for (const other of rivalsBeforeStep) {
        if (other === rival) continue;
        const distance = rival.group.position.distanceToSquared(other.group.position);
        if (distance < bestDistance) { bestDistance = distance; target = other.group.position; }
      }
      rival.update(delta, target, ARENA);
    });
    this.collision.keepInArena(this.player, ARENA);
    this.activeRivals.forEach((rival) => this.collision.keepInArena(rival, ARENA));

    this.activeHits = 0;
    for (const rival of this.activeRivals) {
      const strength = this.collision.resolveCars(this.player, rival);
      if (strength > 1.15) this.registerPlayerImpact(rival, strength);
    }
    const activeRivals = this.activeRivals;
    for (let i = 0; i < activeRivals.length; i += 1) {
      for (let j = i + 1; j < activeRivals.length; j += 1) {
        const strength = this.collision.resolveCars(activeRivals[i], activeRivals[j], 0.78);
        if (strength > 1.4) this.registerRivalImpact(activeRivals[i], activeRivals[j], strength);
      }
    }

    const collected = this.collision.collectPickups(this.player.group.position, this.pickups, this.player.radius);
    for (const pickup of collected) this.applyPowerUp(pickup.powerUpType, pickup.group.position);
    for (const [index, cooldown] of this.impactCooldowns) {
      const next = cooldown - delta;
      if (next <= 0) this.impactCooldowns.delete(index);
      else this.impactCooldowns.set(index, next);
    }
    for (const [pair, cooldown] of this.rivalImpactCooldowns) {
      const next = cooldown - delta;
      if (next <= 0) this.rivalImpactCooldowns.delete(pair);
      else this.rivalImpactCooldowns.set(pair, next);
    }
    if (this.activeRivals.length === 0) this.completeStage();
    else if (this.playerHealth <= 0 || this.timeLeft <= 0) this.failStage();
  }

  private failStage(): void {
    if (this.state !== 'playing') return;
    this.audio.stageFail();
    this.setState('lost');
  }

  private completeStage(): void {
    this.accumulator = 0;
    this.campaign.campaignScore += this.score;
    this.campaign.completedStages = Math.max(this.campaign.completedStages, this.stageIndex + 1);
    saveCampaignProgress(this.campaign);
    this.audio.stageClear();
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
      playerHealth: this.playerHealth,
      playerMaxHealth: this.playerMaxHealth,
      rivalsRemaining: this.activeRivals.length,
      eliminations: this.eliminations,
      boostCharge: this.boostCharge,
      damageBoostTime: this.damageBoostTime,
    });
  }

  private applyStagePresentation(): void {
    this.rivals.forEach((rival, index) => {
      const bossScale = this.currentStage.bossRival?.index === index ? this.currentStage.bossRival.scale : 1;
      rival.configure(this.currentStage.difficulty, index < this.currentStage.rivalCount, bossScale);
    });
    if (this.presentedStageId === this.currentStage.id) return;
    this.presentedStageId = this.currentStage.id;
    if (this.floorMaterial) {
      const nextFloorTexture = createStageFloorTexture(this.currentStage);
      nextFloorTexture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      this.floorTexture?.dispose();
      this.floorTexture = nextFloorTexture;
      this.floorMaterial.map = nextFloorTexture;
      this.floorMaterial.color.set('#ffffff');
      this.floorMaterial.needsUpdate = true;
    }
    if (this.scene.fog instanceof THREE.Fog) this.scene.fog.color.set(this.currentStage.theme.fog);
    this.stageDressing?.configure(this.currentStage);
    this.keyLight?.color.set(this.currentStage.theme.lightColor);
    this.fillLight?.color.set(this.currentStage.theme.accent);
    this.rimLight?.color.set(this.currentStage.theme.secondary);
    const angle = (this.stageIndex / CAMPAIGN_STAGES.length) * Math.PI * 2;
    this.keyLight?.position.set(Math.cos(angle) * 8, 11, Math.sin(angle) * 8);

    this.currentStage.collectibles.positions.forEach(([x, z], index) => {
      const config = POWER_UPS[index % POWER_UPS.length];
      this.pickups[index]?.reconfigure(config.kind, config.color, new THREE.Vector3(x, 0.8, z), config.type);
    });
  }

  private registerPlayerImpact(rival: Rival, strength: number): void {
    if (this.impactCooldowns.has(rival.index)) return;
    this.impactCooldowns.set(rival.index, 0.34);
    this.activeHits += 1;
    const hitPower = Math.max(0, strength - 0.8);
    const outgoingMultiplier = (this.boosting ? 1.45 : 1) * (this.damageBoostTime > 0 ? 1.85 : 1);
    const rivalDamage = Math.min(34, (3.5 + hitPower * 3.7) * outgoingMultiplier);
    const incomingDamage = Math.min(24, (2.2 + hitPower * (1.8 + this.stageIndex * 0.08)) * (this.boosting ? 0.72 : 1));
    const eliminated = rival.takeDamage(rivalDamage);
    this.playerHealth = Math.max(0, this.playerHealth - incomingDamage);
    this.score = this.eliminations;
    if (strength > 5.2 || this.boosting) this.audio.heavyImpact();
    else this.audio.impact(strength);
    this.hud.flashImpact();
    const point = this.player.group.position.clone().lerp(rival.group.position, 0.5);
    this.spawnImpact(point, this.damageBoostTime > 0 ? '#ffad42' : '#fff3c4', Math.min(2.2, 0.8 + strength * 0.16));
    this.cameraRig.impulse(Math.min(0.56, 0.12 + strength * 0.045));
    if (eliminated) this.eliminateRival(rival, point);
    if (this.playerHealth <= 0) this.spawnImpact(this.player.group.position, '#e65e72', 2.5);
  }

  private registerRivalImpact(a: Rival, b: Rival, strength: number): void {
    const key = `${Math.min(a.index, b.index)}:${Math.max(a.index, b.index)}`;
    if (this.rivalImpactCooldowns.has(key)) return;
    this.rivalImpactCooldowns.set(key, 0.38);
    const damage = Math.min(20, 2 + Math.max(0, strength - 1) * 2.15);
    const point = a.group.position.clone().lerp(b.group.position, 0.5);
    const aEliminated = a.takeDamage(damage);
    const bEliminated = b.takeDamage(damage);
    this.audio.impact(strength * 0.72);
    this.spawnImpact(point, '#9dd9ff', Math.min(1.4, 0.55 + strength * 0.1));
    if (aEliminated) this.eliminateRival(a, point);
    if (bEliminated) this.eliminateRival(b, point);
  }

  private eliminateRival(rival: Rival, position: THREE.Vector3): void {
    this.eliminations += 1;
    this.score = this.eliminations;
    this.audio.carEliminated();
    this.spawnImpact(position, '#ffcf66', 2.6);
    this.cameraRig.impulse(0.38);
    rival.group.visible = false;
  }

  private applyPowerUp(type: PowerUpType, position: THREE.Vector3): void {
    if (type === 'repair') {
      this.playerHealth = Math.min(this.playerMaxHealth, this.playerHealth + 32);
      this.audio.repairPowerUp();
      this.spawnImpact(position, '#61e3a3', 1.45);
    } else if (type === 'overdrive') {
      this.damageBoostTime = Math.max(this.damageBoostTime, 8);
      this.audio.overdrivePowerUp();
      this.spawnImpact(position, '#ffad42', 1.7);
    } else {
      this.audio.shockBomb();
      this.spawnShockWave(this.player.group.position, '#72cfff', 7.5);
      for (const rival of [...this.activeRivals]) {
        const distance = rival.group.position.distanceTo(this.player.group.position);
        if (distance > 7.5) continue;
        const point = rival.group.position.clone();
        const eliminated = rival.takeDamage(26 + this.stageIndex * 1.5);
        this.spawnImpact(point, '#a5e8ff', 1.7);
        if (eliminated) this.eliminateRival(rival, point);
      }
      this.cameraRig.impulse(0.45);
    }
    this.hud.flashPickup();
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
    this.keyLight = new THREE.DirectionalLight('#ffd9a0', 2.55);
    this.keyLight.position.set(-6, 11, 7);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    Object.assign(this.keyLight.shadow.camera, { near: 0.5, far: 35, left: -15, right: 15, top: 12, bottom: -12 });
    this.fillLight = new THREE.DirectionalLight('#8fb9d8', 0.82);
    this.fillLight.position.set(8, 8, -10);
    this.rimLight = new THREE.PointLight('#fff0c2', 18, 28, 2);
    this.rimLight.position.set(0, 5.8, -9);
    this.stageDressing = new StageDressing(this.currentStage);
    this.scene.add(this.keyLight, this.fillLight, this.rimLight, this.createArena(), this.createPavilion(), this.stageDressing.group, this.player.group);
    this.rivals.forEach((rival) => this.scene.add(rival.group));
    this.createPickups();
  }

  private createArena(): THREE.Group {
    const arena = new THREE.Group();
    arena.name = 'LayeredPocketArena';
    const floorTexture = createStageFloorTexture(this.currentStage);
    floorTexture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    this.floorTexture = floorTexture;
    this.floorMaterial = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      map: this.floorTexture,
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
    this.currentStage.collectibles.positions.forEach(([x, z], index) => {
      const config = POWER_UPS[index % POWER_UPS.length];
      const pickup = new Pickup(
        index,
        new THREE.Vector3(x, 0.8, z),
        config.kind,
        config.color,
        config.type,
      );
      this.pickups.push(pickup);
      this.scene.add(pickup.group);
    });
  }

  private spawnImpact(position: THREE.Vector3, color: string, intensity = 1): void {
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
    const count = Math.round(8 + intensity * 6);
    for (let i = 0; i < count; i += 1) {
      const mesh = new THREE.Mesh(
        new THREE.ShapeGeometry(shape),
        new THREE.MeshBasicMaterial({ color, transparent: true }),
      );
      mesh.position.copy(position).add(new THREE.Vector3(0, 0.42, 0));
      const angle = i / count * Math.PI * 2;
      mesh.rotation.set(Math.PI / 2, angle, angle * 0.5);
      this.burstParticles.push({
        mesh,
        velocity: new THREE.Vector3(Math.cos(angle) * (2.6 + intensity * 1.8), 1.8 + (i % 3) * 0.65 + intensity, Math.sin(angle) * (2.6 + intensity * 1.8)),
        life: 0.38 + intensity * 0.16,
      });
      this.scene.add(mesh);
    }
    this.spawnShockWave(position, color, 1.3 + intensity * 0.9);
  }

  private spawnShockWave(position: THREE.Vector3, color: string, size: number): void {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.88, 56), material);
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(position);
    ring.position.y = 0.14;
    ring.scale.setScalar(0.35);
    ring.userData.targetScale = size;
    this.impactRings.push({ mesh: ring, life: 0.52, maxLife: 0.52 });
    this.scene.add(ring);
  }

  private updateParticles(delta: number): void {
    for (let i = this.burstParticles.length - 1; i >= 0; i -= 1) {
      const particle = this.burstParticles[i];
      particle.life -= delta;
      particle.velocity.y -= delta * 6;
      particle.mesh.position.addScaledVector(particle.velocity, delta);
      particle.mesh.scale.setScalar(Math.max(0.01, particle.life * 2));
      (particle.mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, particle.life * 2.5);
      if (particle.life <= 0) {
        this.scene.remove(particle.mesh);
        particle.mesh.geometry.dispose();
        (particle.mesh.material as THREE.Material).dispose();
        this.burstParticles.splice(i, 1);
      }
    }
    for (let i = this.impactRings.length - 1; i >= 0; i -= 1) {
      const ring = this.impactRings[i];
      ring.life -= delta;
      const progress = 1 - ring.life / ring.maxLife;
      const targetScale = Number(ring.mesh.userData.targetScale) || 2;
      ring.mesh.scale.setScalar(THREE.MathUtils.lerp(0.35, targetScale, 1 - (1 - progress) ** 3));
      (ring.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, ring.life / ring.maxLife);
      if (ring.life <= 0) {
        this.scene.remove(ring.mesh);
        ring.mesh.geometry.dispose();
        (ring.mesh.material as THREE.Material).dispose();
        this.impactRings.splice(i, 1);
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
    this.impactRings.forEach((ring) => {
      this.scene.remove(ring.mesh);
      ring.mesh.geometry.dispose();
      (ring.mesh.material as THREE.Material).dispose();
    });
    this.impactRings.length = 0;
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
        collectibleKind: this.currentStage.collectibles.kind,
        collectibleName: this.currentStage.collectibles.name,
        pickupLayoutSignature: this.currentStage.collectibles.positions.map(([x, z]) => `${x},${z}`).join('|'),
      },
      world: {
        floorPattern: this.currentStage.theme.floorPattern,
        floorSource: 'authored-texture',
        dressing: this.currentStage.theme.dressing,
        props: this.stageDressing?.diagnostics.props ?? 0,
        meshes: this.stageDressing?.diagnostics.meshes ?? 0,
      },
      audio: this.audio.diagnostics,
      physics: { engine: 'custom-arcade', timestep: FIXED_STEP, bodies: 1 + this.activeRivals.length, colliders: 1 + this.activeRivals.length + this.pickups.filter((pickup) => pickup.active).length, activeHits: this.activeHits },
      input: { dash: this.input.isDashHeld(), boosting: this.boosting },
      combat: {
        playerHealth: this.playerHealth,
        playerMaxHealth: this.playerMaxHealth,
        rivalsRemaining: this.activeRivals.length,
        eliminations: this.eliminations,
        rivalHealth: this.rivals.filter((rival) => !rival.eliminated && rival.group.visible).map((rival) => ({ index: rival.index, health: rival.health, maxHealth: rival.maxHealth })),
        damageBoostTime: this.damageBoostTime,
        boostCharge: this.boostCharge,
      },
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
        importedPickupsReady: this.pickups.filter((pickup) => pickup.isImportedReady).length,
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
