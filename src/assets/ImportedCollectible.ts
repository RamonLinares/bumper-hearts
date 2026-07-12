import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { assetUrl } from '../core/assetUrl';
import type { CollectibleKind } from '../game/Campaign';

const loader = new GLTFLoader();
const sources = new Map<CollectibleKind, Promise<THREE.Group>>();
const PLANAR_KINDS = new Set<CollectibleKind>([
  'ticket', 'cafe-token', 'trophy-star', 'evidence-card', 'love-letter', 'marquee-heart',
]);

function loadSource(kind: CollectibleKind): Promise<THREE.Group> {
  const existing = sources.get(kind);
  if (existing) return existing;

  const request = loader
    .loadAsync(assetUrl(`assets/models/collectibles/${kind}/model.glb`))
    .then((gltf) => {
      const source = gltf.scene;
      source.updateMatrixWorld(true);
      let bounds = new THREE.Box3().setFromObject(source);
      let size = bounds.getSize(new THREE.Vector3());
      if (PLANAR_KINDS.has(kind)) {
        const thinnestAxis = size.x <= size.y && size.x <= size.z ? 'x' : size.y <= size.z ? 'y' : 'z';
        if (thinnestAxis === 'x') source.rotation.y = Math.PI / 2;
        else if (thinnestAxis === 'y') source.rotation.x = Math.PI / 2;
        source.updateMatrixWorld(true);
        bounds = new THREE.Box3().setFromObject(source);
        size = bounds.getSize(new THREE.Vector3());
      }
      const scale = 0.96 / Math.max(size.x, size.y, size.z, 0.001);
      source.scale.setScalar(scale);
      source.updateMatrixWorld(true);

      const normalized = new THREE.Box3().setFromObject(source);
      const center = normalized.getCenter(new THREE.Vector3());
      source.position.set(-center.x, -center.y, -center.z);
      source.name = `TripoCollectibleSource-${kind}`;
      source.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.castShadow = true;
        object.receiveShadow = true;
      });
      return source;
    });

  sources.set(kind, request);
  return request;
}

export async function createImportedCollectible(kind: CollectibleKind): Promise<THREE.Group> {
  const source = await loadSource(kind);
  const root = source.clone(true);
  root.name = `TripoCollectible-${kind}`;
  return root;
}
