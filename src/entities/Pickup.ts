import * as THREE from 'three';
import { createImportedCollectible } from '../assets/ImportedCollectible';
import type { CollectibleKind } from '../game/Campaign';

const TILTED_KINDS = new Set<CollectibleKind>([
  'ticket', 'cafe-token', 'trophy-star', 'evidence-card', 'love-letter', 'marquee-heart',
]);

export class Pickup {
  readonly group = new THREE.Group();
  readonly radius = 0.62;
  active = true;

  private readonly visual = new THREE.Group();
  private readonly haloGeometry = new THREE.TorusGeometry(0.61, 0.026, 8, 40);
  private readonly haloMaterial = new THREE.MeshBasicMaterial({
    color: '#f5c45b', transparent: true, opacity: 0.68, depthWrite: false,
  });
  private readonly halo = new THREE.Mesh(this.haloGeometry, this.haloMaterial);
  private kind: CollectibleKind = 'ticket';
  private requestVersion = 0;
  private importedReady = false;

  constructor(readonly index: number, position: THREE.Vector3, kind: CollectibleKind = 'ticket', color = '#f5c45b') {
    this.visual.name = 'ImportedCollectibleVisual';
    this.halo.name = 'pickupHalo';
    this.halo.position.z = -0.08;
    this.group.add(this.visual, this.halo);
    this.reconfigure(kind, color, position);
  }

  reconfigure(kind: CollectibleKind, color: string, position?: THREE.Vector3): void {
    const version = ++this.requestVersion;
    this.kind = kind;
    this.active = true;
    this.importedReady = false;
    this.group.visible = true;
    this.group.name = `${kind}-${this.index}`;
    if (position) this.group.position.copy(position);
    this.haloMaterial.color.set(color);
    this.visual.clear();
    this.visual.rotation.x = TILTED_KINDS.has(kind) ? -0.82 : 0;

    void createImportedCollectible(kind).then((model) => {
      if (version !== this.requestVersion) return;
      this.visual.add(model);
      this.importedReady = true;
    }).catch((error) => {
      console.warn(`Could not load Tripo collectible: ${kind}`, error);
    });
  }

  update(delta: number, elapsed: number): void {
    if (!this.active) return;
    if (!TILTED_KINDS.has(this.kind)) {
      this.group.rotation.y += delta * (this.kind === 'radio-coil' ? 1.55 : 0.92);
    }
    this.group.rotation.z = Math.sin(elapsed * 1.35 + this.index) * 0.055;
    this.group.position.y = 0.82 + Math.sin(elapsed * 2.3 + this.index * 0.7) * 0.12;
    this.halo.scale.setScalar(1 + Math.sin(elapsed * 3.1 + this.index) * 0.06);
  }

  collect(): void { this.active = false; this.group.visible = false; }

  get isImportedReady(): boolean { return this.importedReady; }

  dispose(): void {
    this.requestVersion += 1;
    this.visual.clear();
    this.haloGeometry.dispose();
    this.haloMaterial.dispose();
  }
}
