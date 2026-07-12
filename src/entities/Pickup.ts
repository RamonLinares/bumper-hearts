import * as THREE from 'three';

function createStarShape(points = 5, outer = 0.46, inner = 0.22): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / points;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function createHeartShape(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.43);
  shape.bezierCurveTo(-0.1, -0.3, -0.48, -0.08, -0.48, 0.2);
  shape.bezierCurveTo(-0.48, 0.56, -0.08, 0.62, 0, 0.34);
  shape.bezierCurveTo(0.08, 0.62, 0.48, 0.56, 0.48, 0.2);
  shape.bezierCurveTo(0.48, -0.08, 0.1, -0.3, 0, -0.43);
  return shape;
}

export class Pickup {
  readonly group = new THREE.Group();
  readonly radius = 0.62;
  active = true;

  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly icon: THREE.Mesh;
  private readonly orbit: THREE.Group;

  constructor(
    readonly index: number,
    position: THREE.Vector3,
  ) {
    const isHeart = index % 2 === 1;
    this.group.name = isHeart ? `HeartTicket-${index}` : `MemoryStar-${index}`;
    const iconGeometry = new THREE.ExtrudeGeometry(isHeart ? createHeartShape() : createStarShape(), {
      depth: 0.12,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.035,
      bevelThickness: 0.035,
      curveSegments: 14,
    });
    const iconMaterial = new THREE.MeshPhysicalMaterial({
      color: isHeart ? '#e96b62' : '#f5c45b',
      emissive: isHeart ? '#5e171d' : '#6b3e0a',
      emissiveIntensity: 0.52,
      roughness: 0.3,
      metalness: isHeart ? 0.08 : 0.34,
      clearcoat: 0.55,
    });
    this.icon = new THREE.Mesh(iconGeometry, iconMaterial);
    this.icon.castShadow = true;
    this.icon.position.z = -0.06;
    this.group.add(this.icon);
    this.geometries.push(iconGeometry);
    this.materials.push(iconMaterial);

    const haloGeometry = new THREE.TorusGeometry(0.61, 0.026, 7, 40);
    const haloMaterial = new THREE.MeshBasicMaterial({ color: '#fff0c2', transparent: true, opacity: 0.86 });
    const halo = new THREE.Mesh(haloGeometry, haloMaterial);
    halo.position.z = -0.1;
    this.group.add(halo);
    this.geometries.push(haloGeometry);
    this.materials.push(haloMaterial);

    this.orbit = new THREE.Group();
    const chipGeometry = isHeart ? new THREE.BoxGeometry(0.16, 0.09, 0.04) : new THREE.OctahedronGeometry(0.08, 0);
    const chipMaterial = new THREE.MeshStandardMaterial({ color: isHeart ? '#fff0c2' : '#4e9f9b', roughness: 0.48, metalness: 0.12 });
    for (let i = 0; i < 3; i += 1) {
      const chip = new THREE.Mesh(chipGeometry, chipMaterial);
      const angle = i * Math.PI * 2 / 3;
      chip.position.set(Math.cos(angle) * 0.74, Math.sin(angle) * 0.74, 0);
      chip.rotation.z = angle;
      this.orbit.add(chip);
    }
    this.group.add(this.orbit);
    this.geometries.push(chipGeometry);
    this.materials.push(chipMaterial);
    this.group.position.copy(position);
  }

  update(delta: number, elapsed: number): void {
    if (!this.active) return;
    this.group.rotation.y += delta * 1.25;
    this.icon.rotation.z = Math.sin(elapsed * 1.8 + this.index) * 0.12;
    this.orbit.rotation.z -= delta * 1.4;
    this.group.position.y = 0.88 + Math.sin(elapsed * 2.6 + this.index) * 0.14;
  }

  collect(): void {
    this.active = false;
    this.group.visible = false;
  }

  dispose(): void {
    this.geometries.forEach((geometry) => geometry.dispose());
    this.materials.forEach((material) => material.dispose());
  }
}
