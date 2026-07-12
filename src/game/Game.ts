import * as THREE from 'three';
import { InputController } from '../core/InputController';
import { Loop } from '../core/Loop';
import { createRenderer, resizeRenderer } from '../core/Renderer';
import { Pickup } from '../entities/Pickup';
import { Player, type ArenaBounds } from '../entities/Player';
import { Rival } from '../entities/Rival';
import { AudioSystem } from '../systems/AudioSystem';
import { CameraRig } from '../systems/CameraRig';
import { CollisionSystem } from '../systems/CollisionSystem';
import { DebugTools, type DebugTuning } from '../systems/DebugTools';
import { Hud } from '../systems/Hud';

const ARENA: ArenaBounds = { halfWidth: 11, halfDepth: 7 };
const ROUND_SECONDS = 70;
const TARGET_SCORE = 1400;
const FIXED_STEP = 1 / 60;
type GameState = 'playing' | 'paused' | 'won' | 'lost';

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
  private readonly modalPrimaryButton: HTMLButtonElement;
  private readonly modalSecondaryButton: HTMLButtonElement;
  private readonly tuning: DebugTuning = {
    speed: 6.6,
    dashMultiplier: 1.5,
    acceleration: 8.5,
    cameraLag: 0.13,
    exposure: 1.05,
    maxDpr: window.matchMedia('(pointer: coarse)').matches ? 1.5 : 2,
  };
  private readonly debugTools: DebugTools;
  private readonly impactCooldowns = new Map<number, number>();
  private readonly burstParticles: { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number }[] = [];
  private frame = 0;
  private score = 0;
  private timeLeft = ROUND_SECONDS;
  private state: GameState = 'playing';
  private accumulator = 0;
  private activeHits = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = createRenderer(canvas);
    this.renderer.toneMappingExposure = this.tuning.exposure;
    this.input = new InputController(this.getElement('#touch-stick'), this.getElement('#touch-knob'), this.getElement('#dash-button'));
    this.pauseButton = this.getElement<HTMLButtonElement>('#pause-button');
    this.restartButton = this.getElement<HTMLButtonElement>('#restart-button');
    this.modalPrimaryButton = this.getElement<HTMLButtonElement>('#modal-primary');
    this.modalSecondaryButton = this.getElement<HTMLButtonElement>('#modal-secondary');
    this.pauseButton.addEventListener('click', this.togglePause);
    this.restartButton.addEventListener('click', this.restart);
    this.modalPrimaryButton.addEventListener('click', this.handleModalPrimary);
    this.modalSecondaryButton.addEventListener('click', this.restart);
    this.debugTools = new DebugTools(this.tuning, () => {
      this.renderer.toneMappingExposure = this.tuning.exposure;
      resizeRenderer(this.renderer, this.camera, this.tuning.maxDpr);
    });
    this.createScene();
    this.hud.setTarget(TARGET_SCORE);
    this.cameraRig.snapTo(this.player.group.position);
    resizeRenderer(this.renderer, this.camera, this.tuning.maxDpr);
    this.publishDiagnostics();
    window.render_game_to_text = () => JSON.stringify({
      coordinateSystem: 'arena center origin; +x right, -z forward',
      ...window.__THREE_GAME_DIAGNOSTICS__,
    });
    window.advanceTime = (milliseconds: number) => {
      const steps = Math.max(1, Math.round(milliseconds / (FIXED_STEP * 1000)));
      const elapsed = (ROUND_SECONDS - this.timeLeft);
      for (let i = 0; i < steps; i += 1) this.update(FIXED_STEP, elapsed + i * FIXED_STEP);
      this.render();
    };
  }

  start(): void { this.loop.start(); }

  dispose(): void {
    this.loop.stop();
    this.pauseButton.removeEventListener('click', this.togglePause);
    this.restartButton.removeEventListener('click', this.restart);
    this.modalPrimaryButton.removeEventListener('click', this.handleModalPrimary);
    this.modalSecondaryButton.removeEventListener('click', this.restart);
    this.input.dispose();
    this.audio.dispose();
    this.debugTools.dispose();
    this.pickups.forEach((pickup) => pickup.dispose());
    this.rivals.forEach((rival) => rival.dispose());
    this.player.dispose();
    this.renderer.dispose();
    window.__THREE_GAME_DIAGNOSTICS__ = undefined;
    window.render_game_to_text = undefined;
    window.advanceTime = undefined;
  }

  private readonly togglePause = () => {
    if (this.state === 'won' || this.state === 'lost') return;
    this.state = this.state === 'paused' ? 'playing' : 'paused';
    this.pauseButton.setAttribute('aria-label', this.state === 'paused' ? 'Resume ride' : 'Pause ride');
  };

  private readonly handleModalPrimary = () => {
    if (this.state === 'paused') this.togglePause();
    else if (this.state === 'won' || this.state === 'lost') this.restart();
  };

  private readonly restart = () => {
    this.score = 0;
    this.timeLeft = ROUND_SECONDS;
    this.state = 'playing';
    this.accumulator = 0;
    this.activeHits = 0;
    this.impactCooldowns.clear();
    this.player.reset();
    this.rivals.forEach((rival, index) => rival.reset(RIVAL_SPAWNS[index]));
    this.pickups.forEach((pickup) => {
      pickup.active = true;
      pickup.group.visible = true;
    });
    this.clearParticles();
    this.pauseButton.setAttribute('aria-label', 'Pause ride');
    this.cameraRig.snapTo(this.player.group.position);
  };

  private update(delta: number, elapsed: number): void {
    this.frame += 1;
    resizeRenderer(this.renderer, this.camera, this.tuning.maxDpr);
    if (this.input.consumeRestart()) this.restart();
    if (this.input.consumePause()) this.togglePause();

    if (this.state === 'playing') {
      this.accumulator += Math.min(delta, 0.05);
      while (this.accumulator >= FIXED_STEP) {
        this.simulate(FIXED_STEP, elapsed);
        this.accumulator -= FIXED_STEP;
      }
    }
    this.updateParticles(delta);
    this.pickups.forEach((pickup) => pickup.update(delta, elapsed));
    this.cameraRig.update(delta, this.player.group.position, this.tuning.cameraLag);
    this.hud.update(this.score, TARGET_SCORE, this.timeLeft, this.state);
    this.publishDiagnostics();
  }

  private simulate(delta: number, elapsed: number): void {
    this.timeLeft = Math.max(0, this.timeLeft - delta);
    this.player.update(delta, elapsed, this.input, this.tuning, ARENA);
    this.rivals.forEach((rival) => rival.update(delta, this.player.group.position, ARENA));
    this.collision.keepInArena(this.player, ARENA);
    this.rivals.forEach((rival) => this.collision.keepInArena(rival, ARENA));

    this.activeHits = 0;
    for (const rival of this.rivals) {
      const strength = this.collision.resolveCars(this.player, rival);
      if (strength > 1.15) this.registerPlayerImpact(rival, strength);
    }
    for (let i = 0; i < this.rivals.length; i += 1) {
      for (let j = i + 1; j < this.rivals.length; j += 1) this.collision.resolveCars(this.rivals[i], this.rivals[j], 0.78);
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
    if (this.score >= TARGET_SCORE) this.state = 'won';
    else if (this.timeLeft <= 0) this.state = 'lost';
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
    new THREE.TextureLoader().load('/assets/backgrounds/nostalgic-carnival-diorama.png', (texture) => {
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
    floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(ARENA.halfWidth / 2, ARENA.halfDepth / 2);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(ARENA.halfWidth * 2, ARENA.halfDepth * 2), new THREE.MeshStandardMaterial({ color: '#2b2a36', map: floorTexture, roughness: 0.74, metalness: 0.05 }));
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
    const center = new THREE.Mesh(new THREE.ShapeGeometry(heartShape, 16), new THREE.MeshStandardMaterial({ color: '#f5c45b', roughness: 0.42, metalness: 0.28 }));
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
    textureCanvas.width = textureCanvas.height = 256;
    const context = textureCanvas.getContext('2d');
    if (!context) throw new Error('Could not create floor texture context.');
    context.fillStyle = '#302d39';
    context.fillRect(0, 0, 256, 256);
    const gradient = context.createRadialGradient(128, 128, 16, 128, 128, 170);
    gradient.addColorStop(0, 'rgba(255,240,194,.055)');
    gradient.addColorStop(1, 'rgba(8,10,20,.18)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);
    context.strokeStyle = 'rgba(255,240,199,.07)';
    context.lineWidth = 1;
    for (let i = 0; i <= 256; i += 32) {
      context.beginPath(); context.moveTo(i, 0); context.lineTo(i, 256); context.moveTo(0, i); context.lineTo(256, i); context.stroke();
    }
    context.strokeStyle = 'rgba(8,7,12,.28)';
    for (let i = 0; i < 9; i += 1) {
      const x = 20 + ((i * 53) % 220);
      const y = 24 + ((i * 79) % 210);
      context.lineWidth = 2 + (i % 2);
      context.beginPath();
      context.ellipse(x, y, 16 + (i % 3) * 7, 5 + (i % 2) * 3, i * 0.62, 0.2, Math.PI * 1.55);
      context.stroke();
    }
    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private publishDiagnostics(): void {
    const info = this.renderer.info;
    window.__THREE_GAME_DIAGNOSTICS__ = {
      frame: this.frame,
      elapsed: ROUND_SECONDS - this.timeLeft,
      score: this.score,
      targetScore: TARGET_SCORE,
      complete: this.state === 'won',
      state: this.state,
      timeLeft: this.timeLeft,
      physics: { engine: 'custom-arcade', timestep: FIXED_STEP, bodies: 1 + this.rivals.length, colliders: 1 + this.rivals.length + this.pickups.filter((pickup) => pickup.active).length, activeHits: this.activeHits },
      input: { dash: this.input.isDashHeld() },
      entities: { rivals: this.rivals.length, pickupsActive: this.pickups.filter((pickup) => pickup.active).length, particles: this.burstParticles.length },
      player: { position: { x: this.player.group.position.x, y: this.player.group.position.y, z: this.player.group.position.z }, speed: this.player.velocity.length(), velocity: { x: this.player.velocity.x, z: this.player.velocity.z }, yaw: this.player.group.rotation.y },
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
