import * as THREE from 'three';

export type CameraMode = 'overhead' | 'cockpit';

export class CameraRig {
  private readonly desiredPosition = new THREE.Vector3();
  private readonly lookTarget = new THREE.Vector3();
  private readonly localOffset = new THREE.Vector3();
  private readonly localLook = new THREE.Vector3();
  private readonly yawRotation = new THREE.Quaternion();
  private mode: CameraMode = 'overhead';

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly overheadOffset = new THREE.Vector3(0, 9.5, 9.5),
  ) {}

  get currentMode(): CameraMode { return this.mode; }

  setMode(mode: CameraMode, target: THREE.Vector3, yaw: number): void {
    this.mode = mode;
    this.snapTo(target, yaw);
  }

  snapTo(target: THREE.Vector3, yaw = 0): void {
    this.calculatePose(target, yaw);
    this.camera.position.copy(this.desiredPosition);
    this.camera.fov = this.mode === 'cockpit' ? 64 : 48;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.lookTarget);
  }

  update(delta: number, target: THREE.Vector3, yaw: number, lag: number): void {
    this.calculatePose(target, yaw);
    const effectiveLag = this.mode === 'cockpit' ? Math.min(lag, 0.055) : lag;
    const factor = 1 - Math.exp(-delta / Math.max(0.001, effectiveLag));
    this.camera.position.lerp(this.desiredPosition, factor);
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, this.mode === 'cockpit' ? 64 : 48, factor);
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.lookTarget);
  }

  private calculatePose(target: THREE.Vector3, yaw: number): void {
    if (this.mode === 'overhead') {
      this.desiredPosition.copy(target).add(this.overheadOffset);
      this.lookTarget.copy(target).add(this.localLook.set(0, 0.35, -1.2));
      return;
    }

    this.yawRotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
    // The imported car is about 1.33 units tall and faces local -Z. Place the
    // camera just above and behind its cockpit so the hood remains visible
    // without putting the near plane inside the bodywork.
    this.localOffset.set(0, 1.58, 0.48).applyQuaternion(this.yawRotation);
    this.localLook.set(0, 0.72, -8).applyQuaternion(this.yawRotation);
    this.desiredPosition.copy(target).add(this.localOffset);
    this.lookTarget.copy(target).add(this.localLook);
  }
}
