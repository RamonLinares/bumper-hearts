import * as THREE from 'three';
import type { Pickup } from '../entities/Pickup';

export class CollisionSystem {
  private readonly delta = new THREE.Vector3();

  resolveCars(
    a: { group: THREE.Group; velocity: THREE.Vector3; radius: number },
    b: { group: THREE.Group; velocity: THREE.Vector3; radius: number },
    restitution = 0.92,
  ): number {
    this.delta.copy(b.group.position).sub(a.group.position);
    this.delta.y = 0;
    const minDistance = a.radius + b.radius;
    const distanceSq = this.delta.lengthSq();
    if (distanceSq >= minDistance * minDistance) return 0;
    const distance = Math.max(Math.sqrt(distanceSq), 0.001);
    this.delta.multiplyScalar(1 / distance);
    const overlap = minDistance - distance;
    a.group.position.addScaledVector(this.delta, -overlap * 0.5);
    b.group.position.addScaledVector(this.delta, overlap * 0.5);
    const relativeSpeed = a.velocity.dot(this.delta) - b.velocity.dot(this.delta);
    if (relativeSpeed <= 0) return 0;
    const impulse = relativeSpeed * (1 + restitution) * 0.5;
    a.velocity.addScaledVector(this.delta, -impulse);
    b.velocity.addScaledVector(this.delta, impulse);
    return relativeSpeed;
  }

  keepInArena(car: { group: THREE.Group; velocity: THREE.Vector3; radius: number }, bounds: { halfWidth: number; halfDepth: number }): number {
    let impact = 0;
    const maxX = bounds.halfWidth - car.radius;
    const maxZ = bounds.halfDepth - car.radius;
    if (car.group.position.x < -maxX || car.group.position.x > maxX) {
      car.group.position.x = THREE.MathUtils.clamp(car.group.position.x, -maxX, maxX);
      impact = Math.max(impact, Math.abs(car.velocity.x));
      car.velocity.x *= -0.72;
    }
    if (car.group.position.z < -maxZ || car.group.position.z > maxZ) {
      car.group.position.z = THREE.MathUtils.clamp(car.group.position.z, -maxZ, maxZ);
      impact = Math.max(impact, Math.abs(car.velocity.z));
      car.velocity.z *= -0.72;
    }
    return impact;
  }

  collectPickups(playerPosition: THREE.Vector3, pickups: Pickup[], playerRadius: number): Pickup[] {
    const collected: Pickup[] = [];

    for (const pickup of pickups) {
      if (!pickup.active) continue;
      this.delta.copy(playerPosition).sub(pickup.group.position);
      this.delta.y = 0;
      const radius = playerRadius + pickup.radius;
      if (this.delta.lengthSq() <= radius * radius) {
        pickup.collect();
        collected.push(pickup);
      }
    }

    return collected;
  }
}
