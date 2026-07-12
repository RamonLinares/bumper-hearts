import * as THREE from 'three';
import { createBumperCar, type BumperCarStyle } from '../assets/BumperCarFactory';

const STYLES: BumperCarStyle[] = ['cherry-rocket', 'lavender-bug', 'gold-taxi', 'cherry-rocket'];

export class Rival {
  readonly group = new THREE.Group();
  readonly velocity = new THREE.Vector3();
  readonly radius = 0.72;
  private readonly desired = new THREE.Vector3();
  private readonly model;
  private wanderAngle: number;
  private decisionTimer = 0;

  constructor(readonly index: number, position: THREE.Vector3) {
    this.wanderAngle = index * 1.7;
    this.group.position.copy(position);
    this.model = createBumperCar(STYLES[index % STYLES.length]);
    this.group.name = `Rival-${STYLES[index % STYLES.length]}-${index}`;
    this.group.add(this.model.root);
  }

  update(delta: number, playerPosition: THREE.Vector3, arena: { halfWidth: number; halfDepth: number }): void {
    this.decisionTimer -= delta;
    if (this.decisionTimer <= 0) {
      this.decisionTimer = 0.65 + ((this.index * 0.37 + performance.now() * 0.0001) % 0.85);
      const toPlayerX = playerPosition.x - this.group.position.x;
      const toPlayerZ = playerPosition.z - this.group.position.z;
      const chase = toPlayerX * toPlayerX + toPlayerZ * toPlayerZ < 55 && (this.index + Math.floor(performance.now() / 2000)) % 3 !== 0;
      if (chase) this.wanderAngle = Math.atan2(toPlayerX, toPlayerZ);
      else this.wanderAngle += 0.8 + this.index * 0.21;
    }
    if (Math.abs(this.group.position.x) > arena.halfWidth - 2) this.wanderAngle = this.group.position.x > 0 ? -Math.PI / 2 : Math.PI / 2;
    if (Math.abs(this.group.position.z) > arena.halfDepth - 2) this.wanderAngle = this.group.position.z > 0 ? Math.PI : 0;
    const speed = 3.25 + this.index * 0.24;
    this.desired.set(Math.sin(this.wanderAngle) * speed, 0, Math.cos(this.wanderAngle) * speed);
    this.velocity.lerp(this.desired, 1 - Math.exp(-2.4 * delta));
    this.group.position.addScaledVector(this.velocity, delta);
    if (this.velocity.lengthSq() > 0.02) this.group.rotation.y = Math.atan2(this.velocity.x, -this.velocity.z);
    this.model.antenna.rotation.z = Math.sin(performance.now() * 0.006 + this.index) * 0.1;
  }

  reset(position: THREE.Vector3): void {
    this.group.position.copy(position);
    this.velocity.set(0, 0, 0);
    this.decisionTimer = 0;
  }

  dispose(): void {
    this.model.geometries.forEach((geometry) => geometry.dispose());
    this.model.materials.forEach((material) => material.dispose());
  }
}
