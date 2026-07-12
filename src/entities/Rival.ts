import * as THREE from 'three';
import { createBumperCar, type BumperCarStyle } from '../assets/BumperCarFactory';
import { createImportedBumperCar } from '../assets/ImportedBumperCar';
import type { RivalDifficulty } from '../game/Campaign';

const STYLES: BumperCarStyle[] = ['cherry-rocket', 'lavender-bug', 'gold-taxi', 'cherry-rocket'];
const RIVAL_IDENTITIES = [
  { name: 'Teal Comet', tint: '#58b8b1' },
  { name: 'Lavender Ace', tint: '#a98bd0' },
  { name: 'Golden Arrow', tint: '#e7ad43' },
  { name: 'Cherry Sprint', tint: '#d95e68' },
] as const;

export class Rival {
  readonly group = new THREE.Group();
  readonly velocity = new THREE.Vector3();
  private collisionScale = 1;
  private readonly desired = new THREE.Vector3();
  private readonly model;
  private readonly importedRoot = new THREE.Group();
  private importedMaterials: THREE.Material[] = [];
  private disposed = false;
  private wanderAngle: number;
  private decisionTimer = 0;
  private aiClock = 0;
  private readonly healthBar = new THREE.Group();
  private readonly healthFill = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#65d4ca', depthTest: false }));
  health = 100;
  maxHealth = 100;
  eliminated = false;
  private difficulty: RivalDifficulty = {
    speedMultiplier: 1,
    chaseRadius: 7.5,
    chaseChance: 0.6,
    steeringResponse: 2.4,
    decisionScale: 1,
  };

  constructor(readonly index: number, position: THREE.Vector3) {
    this.wanderAngle = index * 1.7;
    this.group.position.copy(position);
    this.model = createBumperCar(STYLES[index % STYLES.length]);
    const identity = RIVAL_IDENTITIES[index % RIVAL_IDENTITIES.length];
    this.group.name = `Rival-${identity.name.replace(/\s+/g, '-')}-${index}`;
    const healthBack = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#101d30', opacity: 0.82, transparent: true, depthTest: false }));
    healthBack.scale.set(1.35, 0.14, 1);
    this.healthFill.scale.set(1.25, 0.085, 1);
    this.healthFill.position.z = 0.01;
    this.healthBar.position.y = 1.48;
    this.healthBar.add(healthBack, this.healthFill);
    this.importedRoot.name = `ImportedRivalWrapper-${index}`;
    this.group.add(this.model.root, this.importedRoot, this.healthBar);
    void createImportedBumperCar(identity.tint, 0.78).then(
      ({ root, materials }) => {
        if (this.disposed) {
          materials.forEach((material) => material.dispose());
          return;
        }
        this.importedMaterials = materials;
        root.name = `ImportedRivalVisual-${identity.name.replace(/\s+/g, '-')}`;
        this.importedRoot.add(root);
        this.model.root.visible = false;
      },
      () => {
        this.model.root.visible = true;
      },
    );
  }

  get radius(): number { return 0.72 * this.collisionScale; }

  takeDamage(amount: number): boolean {
    if (this.eliminated) return false;
    this.health = Math.max(0, this.health - Math.max(0, amount));
    this.syncHealthBar();
    if (this.health > 0) return false;
    this.eliminated = true;
    this.group.visible = false;
    this.velocity.set(0, 0, 0);
    return true;
  }

  heal(amount: number): void {
    if (this.eliminated) return;
    this.health = Math.min(this.maxHealth, this.health + amount);
    this.syncHealthBar();
  }

  update(delta: number, playerPosition: THREE.Vector3, arena: { halfWidth: number; halfDepth: number }): void {
    if (!this.group.visible) return;
    this.aiClock += delta;
    this.decisionTimer -= delta;
    if (this.decisionTimer <= 0) {
      this.decisionTimer = (0.65 + ((this.index * 0.37 + this.aiClock * 0.11) % 0.85)) * this.difficulty.decisionScale;
      const toPlayerX = playerPosition.x - this.group.position.x;
      const toPlayerZ = playerPosition.z - this.group.position.z;
      const chaseRoll = ((this.index * 37 + Math.floor(this.aiClock * 10) * 17) % 100) / 100;
      const chase = toPlayerX * toPlayerX + toPlayerZ * toPlayerZ < this.difficulty.chaseRadius ** 2
        && chaseRoll < this.difficulty.chaseChance;
      if (chase) this.wanderAngle = Math.atan2(toPlayerX, toPlayerZ);
      else this.wanderAngle += 0.8 + this.index * 0.21;
    }
    if (Math.abs(this.group.position.x) > arena.halfWidth - 2) this.wanderAngle = this.group.position.x > 0 ? -Math.PI / 2 : Math.PI / 2;
    if (Math.abs(this.group.position.z) > arena.halfDepth - 2) this.wanderAngle = this.group.position.z > 0 ? Math.PI : 0;
    const speed = (3.25 + this.index * 0.24) * this.difficulty.speedMultiplier;
    this.desired.set(Math.sin(this.wanderAngle) * speed, 0, Math.cos(this.wanderAngle) * speed);
    this.velocity.lerp(this.desired, 1 - Math.exp(-this.difficulty.steeringResponse * delta));
    this.group.position.addScaledVector(this.velocity, delta);
    if (this.velocity.lengthSq() > 0.02) this.group.rotation.y = Math.atan2(-this.velocity.x, -this.velocity.z);
    this.model.antenna.rotation.z = Math.sin(performance.now() * 0.006 + this.index) * 0.1;
  }

  reset(position: THREE.Vector3): void {
    this.group.position.copy(position);
    this.velocity.set(0, 0, 0);
    this.decisionTimer = 0;
    this.aiClock = 0;
    this.wanderAngle = this.index * 1.7;
    this.eliminated = false;
    this.health = this.maxHealth;
    this.syncHealthBar();
  }

  configure(difficulty: RivalDifficulty, active: boolean, scale = 1): void {
    this.difficulty = difficulty;
    this.collisionScale = scale;
    this.group.scale.setScalar(scale);
    this.group.visible = active;
  }

  configureCombat(maxHealth: number): void {
    this.maxHealth = Math.max(1, maxHealth);
    this.health = this.maxHealth;
    this.eliminated = false;
    this.syncHealthBar();
  }

  private syncHealthBar(): void {
    const ratio = THREE.MathUtils.clamp(this.health / this.maxHealth, 0, 1);
    this.healthFill.scale.x = 1.25 * ratio;
    this.healthFill.position.x = -0.625 * (1 - ratio);
    const material = this.healthFill.material as THREE.SpriteMaterial;
    material.color.set(ratio > 0.55 ? '#65d4ca' : ratio > 0.25 ? '#f5c45b' : '#e65e72');
  }

  dispose(): void {
    this.disposed = true;
    this.model.geometries.forEach((geometry) => geometry.dispose());
    this.model.materials.forEach((material) => material.dispose());
    this.importedMaterials.forEach((material) => material.dispose());
    this.healthBar.traverse((object) => {
      if (object instanceof THREE.Sprite) object.material.dispose();
    });
    this.importedRoot.clear();
  }
}
