import * as THREE from 'three';
import type { CollectibleKind } from '../game/Campaign';

function starShape(points = 5, outer = 0.43, inner = 0.2): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < points * 2; i += 1) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + i * Math.PI / points;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  shape.closePath();
  return shape;
}

function heartShape(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.42);
  shape.bezierCurveTo(-0.12, -0.28, -0.46, -0.06, -0.46, 0.2);
  shape.bezierCurveTo(-0.46, 0.56, -0.08, 0.61, 0, 0.34);
  shape.bezierCurveTo(0.08, 0.61, 0.46, 0.56, 0.46, 0.2);
  shape.bezierCurveTo(0.46, -0.06, 0.12, -0.28, 0, -0.42);
  return shape;
}

function roundedTicketShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-0.46, -0.28); s.lineTo(0.46, -0.28); s.lineTo(0.46, -0.09);
  s.absarc(0.46, 0, 0.09, -Math.PI / 2, Math.PI / 2, true);
  s.lineTo(0.46, 0.28); s.lineTo(-0.46, 0.28); s.lineTo(-0.46, 0.09);
  s.absarc(-0.46, 0, 0.09, Math.PI / 2, -Math.PI / 2, true); s.closePath();
  return s;
}

type BuiltModel = { root: THREE.Group; animated: THREE.Object3D[] };

export class Pickup {
  readonly group = new THREE.Group();
  readonly radius = 0.62;
  active = true;

  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private animated: THREE.Object3D[] = [];
  private kind: CollectibleKind = 'ticket';

  constructor(readonly index: number, position: THREE.Vector3, kind: CollectibleKind = 'ticket', color = '#f5c45b') {
    this.group.position.copy(position);
    this.reconfigure(kind, color, position);
  }

  reconfigure(kind: CollectibleKind, color: string, position?: THREE.Vector3): void {
    this.clearModel();
    this.kind = kind;
    this.active = true;
    this.group.visible = true;
    this.group.name = `${kind}-${this.index}`;
    if (position) this.group.position.copy(position);

    const model = this.buildModel(kind, color);
    this.group.add(model.root);
    this.animated = model.animated;

    const haloGeometry = new THREE.TorusGeometry(0.59, 0.022, 6, 32);
    const haloMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.72, depthWrite: false });
    const halo = new THREE.Mesh(haloGeometry, haloMaterial);
    halo.name = 'pickupHalo';
    halo.position.z = -0.12;
    this.group.add(halo);
    this.geometries.push(haloGeometry);
    this.materials.push(haloMaterial);
  }

  private material(color: string, emissive = color, metalness = 0.2): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: 0.28, roughness: 0.34, metalness });
    this.materials.push(material);
    return material;
  }

  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
    this.geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    return mesh;
  }

  private buildModel(kind: CollectibleKind, color: string): BuiltModel {
    const root = new THREE.Group();
    root.name = 'pickupModel';
    const primary = this.material(color);
    const dark = this.material('#273247', '#000000', 0.55);
    const cream = this.material('#fff0c2', '#7a5520', 0.08);
    const animated: THREE.Object3D[] = [];

    if (kind === 'ticket' || kind === 'evidence-card' || kind === 'love-letter') {
      const geometry = new THREE.ExtrudeGeometry(kind === 'ticket' ? roundedTicketShape() : new THREE.Shape([
        new THREE.Vector2(-0.42, -0.3), new THREE.Vector2(0.42, -0.3), new THREE.Vector2(0.42, 0.3), new THREE.Vector2(-0.42, 0.3),
      ]), { depth: 0.08, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 1 });
      const card = this.mesh(geometry, kind === 'ticket' ? primary : cream);
      card.position.z = -0.04;
      root.add(card);
      if (kind === 'evidence-card') {
        const stripe = this.mesh(new THREE.BoxGeometry(0.6, 0.07, 0.13), primary);
        stripe.position.set(0, 0.12, 0.03); root.add(stripe);
        const pin = this.mesh(new THREE.SphereGeometry(0.065, 10, 6), dark);
        pin.position.set(-0.27, 0.17, 0.09); root.add(pin);
      } else if (kind === 'love-letter') {
        const flap = this.mesh(new THREE.ConeGeometry(0.3, 0.58, 3), primary);
        flap.rotation.z = Math.PI / 2; flap.scale.y = 0.72; flap.position.z = 0.1; root.add(flap);
      } else {
        for (const x of [-0.2, 0, 0.2]) {
          const punch = this.mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.13, 8), dark);
          punch.rotation.x = Math.PI / 2; punch.position.set(x, 0, 0.08); root.add(punch);
        }
      }
    } else if (kind === 'bulb') {
      const globe = this.mesh(new THREE.SphereGeometry(0.3, 18, 12), primary);
      globe.scale.y = 1.14; globe.position.y = 0.1; root.add(globe);
      const base = this.mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.28, 12), dark);
      base.position.y = -0.28; root.add(base);
      for (let y = -0.36; y < -0.17; y += 0.07) {
        const thread = this.mesh(new THREE.TorusGeometry(0.19, 0.015, 5, 16), cream);
        thread.rotation.x = Math.PI / 2; thread.position.y = y; root.add(thread);
      }
      animated.push(globe);
    } else if (kind === 'radio-coil') {
      const coil = this.mesh(new THREE.TorusKnotGeometry(0.28, 0.055, 64, 8, 2, 3), primary);
      root.add(coil); animated.push(coil);
      const core = this.mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.7, 10), dark);
      core.rotation.z = Math.PI / 2; root.add(core);
    } else if (kind === 'cafe-token') {
      const token = this.mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.11, 28), primary);
      token.rotation.x = Math.PI / 2; root.add(token);
      const cup = this.mesh(new THREE.TorusGeometry(0.17, 0.045, 7, 20, Math.PI * 1.5), cream);
      cup.position.z = 0.08; cup.rotation.z = -Math.PI / 4; root.add(cup);
    } else if (kind === 'trophy-star' || kind === 'marquee-heart') {
      const shape = kind === 'trophy-star' ? starShape() : heartShape();
      const icon = this.mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 }), primary);
      icon.position.z = -0.06; root.add(icon); animated.push(icon);
      if (kind === 'trophy-star') {
        const pedestal = this.mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.16, 12), dark);
        pedestal.position.y = -0.48; root.add(pedestal);
      } else {
        for (let i = 0; i < 6; i += 1) {
          const bulb = this.mesh(new THREE.SphereGeometry(0.035, 6, 4), cream);
          const a = i / 6 * Math.PI * 2; bulb.position.set(Math.cos(a) * 0.47, Math.sin(a) * 0.42, 0.12); root.add(bulb);
        }
      }
    } else if (kind === 'fuse') {
      const glass = this.mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.62, 14), primary);
      glass.rotation.z = Math.PI / 2; root.add(glass);
      for (const x of [-0.37, 0.37]) {
        const cap = this.mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.18, 14), dark);
        cap.rotation.z = Math.PI / 2; cap.position.x = x; root.add(cap);
      }
      const filament = this.mesh(new THREE.TorusGeometry(0.12, 0.018, 5, 16), cream);
      filament.rotation.y = Math.PI / 2; root.add(filament); animated.push(filament);
    } else {
      const cage = this.mesh(new THREE.CylinderGeometry(0.28, 0.36, 0.62, 8), dark);
      cage.position.y = -0.03; root.add(cage);
      const lamp = this.mesh(new THREE.SphereGeometry(0.19, 14, 10), primary);
      lamp.position.y = 0.02; root.add(lamp); animated.push(lamp);
      const handle = this.mesh(new THREE.TorusGeometry(0.29, 0.035, 6, 20, Math.PI), cream);
      handle.position.y = 0.35; root.add(handle);
    }
    return { root, animated };
  }

  update(delta: number, elapsed: number): void {
    if (!this.active) return;
    this.group.rotation.y += delta * (this.kind === 'radio-coil' ? 1.65 : 1.05);
    this.group.rotation.z = Math.sin(elapsed * 1.35 + this.index) * 0.07;
    this.group.position.y = 0.88 + Math.sin(elapsed * 2.45 + this.index * 0.7) * 0.14;
    this.animated.forEach((part, i) => { part.scale.setScalar(1 + Math.sin(elapsed * 3.2 + i) * 0.045); });
  }

  collect(): void { this.active = false; this.group.visible = false; }

  private clearModel(): void {
    this.group.clear();
    this.geometries.splice(0).forEach((geometry) => geometry.dispose());
    this.materials.splice(0).forEach((material) => material.dispose());
    this.animated = [];
  }

  dispose(): void { this.clearModel(); }
}
