import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createBumperCar } from '../assets/BumperCarFactory';
import type { InputController } from '../core/InputController';

export type PlayerTuning = {
  speed: number;
  dashMultiplier: number;
  acceleration: number;
};

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
  private readonly model = createBumperCar('mint-comet');
  private readonly importedRoot = new THREE.Group();

  constructor() {
    this.group.name = 'MintCometPlayer';
    this.importedRoot.name = 'ImportedHeroWrapper';
    this.group.add(this.model.root, this.importedRoot);
    new GLTFLoader().load(
      '/assets/models/bumper-car/7410209e-ca4c-413b-a326-2595ab89551d-pbr_model.model.png',
      (gltf) => {
        const visual = gltf.scene;
        const bounds = new THREE.Box3().setFromObject(visual);
        const size = bounds.getSize(new THREE.Vector3());
        const scale = 1.72 / Math.max(size.x, size.z, 0.001);
        visual.scale.setScalar(scale);
        visual.updateMatrixWorld(true);
        const normalizedBounds = new THREE.Box3().setFromObject(visual);
        const center = normalizedBounds.getCenter(new THREE.Vector3());
        visual.position.set(-center.x, 0.12 - normalizedBounds.min.y, -center.z);
        visual.rotation.y = Math.PI;
        visual.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            child.name ||= 'importedHeroMesh';
          }
        });
        this.importedRoot.add(visual);
        this.model.root.visible = false;
      },
      undefined,
      () => {
        this.model.root.visible = true;
      },
    );
  }

  update(delta: number, elapsed: number, input: InputController, tuning: PlayerTuning, _bounds: ArenaBounds): void {
    input.readMovement(this.move);
    const dash = input.isDashHeld() ? tuning.dashMultiplier : 1;
    this.targetVelocity.set(this.move.x, 0, this.move.y).multiplyScalar(tuning.speed * dash);

    const smoothing = 1 - Math.exp(-tuning.acceleration * delta);
    this.velocity.lerp(this.targetVelocity, smoothing);
    this.group.position.addScaledVector(this.velocity, delta);

    if (this.velocity.lengthSq() > 0.001) {
      // The authored cars face local -Z. Negating X keeps their noses aligned
      // with lateral motion: right is -PI/2, left is +PI/2.
      this.group.rotation.y = Math.atan2(-this.velocity.x, -this.velocity.z);
    }

    this.group.position.y = 0.06 + Math.sin(elapsed * 9) * Math.min(this.velocity.length() / 40, 0.08);
    this.model.antenna.rotation.z = Math.sin(elapsed * 9) * Math.min(0.12, this.velocity.length() * 0.012);
    const glow = input.isDashHeld() ? 2.35 : 1.35;
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
    this.model.geometries.forEach((geometry) => geometry.dispose());
    this.model.materials.forEach((material) => material.dispose());
    this.importedRoot.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        Object.values(material).forEach((value) => {
          if (value instanceof THREE.Texture) value.dispose();
        });
        material.dispose();
      });
    });
  }
}
