import * as THREE from 'three';
import { createBumperCar, HERO_CAR_PAINT } from '../assets/BumperCarFactory';
import { createImportedBumperCar } from '../assets/ImportedBumperCar';
import type { InputController } from '../core/InputController';

export type PlayerTuning = {
  speed: number;
  dashMultiplier: number;
  acceleration: number;
  turnRate: number;
};

export type PlayerControlMode = 'arena' | 'vehicle';

export type ArenaBounds = {
  halfWidth: number;
  halfDepth: number;
};

export class Player {
  readonly group = new THREE.Group();
  readonly velocity = new THREE.Vector3();
  readonly radius = 0.74;

  private readonly move = new THREE.Vector2();
  private readonly targetVelocity = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly model = createBumperCar('mint-comet');
  private readonly importedRoot = new THREE.Group();
  private importedMaterials: THREE.Material[] = [];
  private disposed = false;
  private activeControlMode: PlayerControlMode = 'arena';

  constructor() {
    this.group.name = 'MintCometPlayer';
    this.importedRoot.name = 'ImportedHeroWrapper';
    this.group.add(this.model.root, this.importedRoot);
    void createImportedBumperCar(HERO_CAR_PAINT, 0.96).then(
      ({ root, materials }) => {
        if (this.disposed) {
          materials.forEach((material) => material.dispose());
          return;
        }
        this.importedMaterials = materials;
        root.name = 'ImportedHeroVisual';
        this.importedRoot.add(root);
        this.model.root.visible = false;
      },
      () => {
        this.model.root.visible = true;
      },
    );
  }

  get controlMode(): PlayerControlMode { return this.activeControlMode; }

  update(
    delta: number,
    elapsed: number,
    input: InputController,
    tuning: PlayerTuning,
    controlMode: PlayerControlMode,
    boosting: boolean,
    _bounds: ArenaBounds,
  ): void {
    input.readMovement(this.move);
    this.activeControlMode = controlMode;
    const dash = boosting ? tuning.dashMultiplier : 1;

    if (controlMode === 'vehicle') {
      // POV controls are relative to the car: vertical input is throttle and
      // horizontal input changes heading. Cars face local -Z.
      this.group.rotation.y -= this.move.x * tuning.turnRate * delta;
      this.forward.set(0, 0, -1).applyAxisAngle(THREE.Object3D.DEFAULT_UP, this.group.rotation.y);
      this.targetVelocity.copy(this.forward).multiplyScalar(-this.move.y * tuning.speed * dash);
    } else {
      this.targetVelocity.set(this.move.x, 0, this.move.y).multiplyScalar(tuning.speed * dash);
    }

    const smoothing = 1 - Math.exp(-tuning.acceleration * delta);
    this.velocity.lerp(this.targetVelocity, smoothing);
    this.group.position.addScaledVector(this.velocity, delta);

    if (controlMode === 'arena' && this.velocity.lengthSq() > 0.001) {
      // The authored cars face local -Z. Negating X keeps their noses aligned
      // with lateral motion: right is -PI/2, left is +PI/2.
      this.group.rotation.y = Math.atan2(-this.velocity.x, -this.velocity.z);
    }

    this.group.position.y = 0.06 + Math.sin(elapsed * 9) * Math.min(this.velocity.length() / 40, 0.08);
    this.model.antenna.rotation.z = Math.sin(elapsed * 9) * Math.min(0.12, this.velocity.length() * 0.012);
    const glow = boosting ? 3.1 : 1.35;
    this.model.lamps.forEach((lamp) => {
      (lamp.material as THREE.MeshStandardMaterial).emissiveIntensity = glow;
    });
  }

  reset(position = new THREE.Vector3()): void {
    this.group.position.copy(position);
    this.velocity.set(0, 0, 0);
    this.group.rotation.set(0, 0, 0);
  }

  dispose(): void {
    this.disposed = true;
    this.model.geometries.forEach((geometry) => geometry.dispose());
    this.model.materials.forEach((material) => material.dispose());
    this.importedMaterials.forEach((material) => material.dispose());
    this.importedRoot.clear();
  }
}
