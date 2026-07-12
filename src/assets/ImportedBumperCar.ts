import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { assetUrl } from '../core/assetUrl';

const MODEL_URL = assetUrl('assets/models/bumper-car/7410209e-ca4c-413b-a326-2595ab89551d-pbr_model.model.png');
const loader = new GLTFLoader();
let normalizedSource: Promise<THREE.Group> | null = null;

export type ImportedBumperCar = {
  root: THREE.Group;
  materials: THREE.Material[];
};

function loadNormalizedSource(): Promise<THREE.Group> {
  normalizedSource ??= loader.loadAsync(MODEL_URL).then((gltf) => {
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
    visual.name = 'NormalizedImportedBumperCar';
    return visual;
  });
  return normalizedSource;
}

function tintMaterial(material: THREE.Material, tint: string, strength: number): THREE.Material {
  const clone = material.clone();
  if (!(clone instanceof THREE.MeshStandardMaterial) || strength <= 0) return clone;

  const tintColor = new THREE.Color(tint);
  clone.onBeforeCompile = (shader) => {
    shader.uniforms.carPaintTint = { value: tintColor };
    shader.uniforms.carPaintStrength = { value: strength };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec3 carPaintTint;
uniform float carPaintStrength;`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
float carLuma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
float carMaxChannel = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b));
float carMinChannel = min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b));
float carChroma = carMaxChannel - carMinChannel;
float carRedDominance = diffuseColor.r - max(diffuseColor.g, diffuseColor.b);
// The source model has saturated coral bodywork, cream trim, a tan seat,
// neutral chrome and a black rubber bumper. Targeting red chroma recolors the
// painted panels while preserving those material identities and their wear.
float carPaintMask = smoothstep(0.18, 0.34, carRedDominance) * smoothstep(0.30, 0.52, carChroma);
vec3 carTintedPaint = carPaintTint * (0.44 + carLuma * 0.92);
diffuseColor.rgb = mix(diffuseColor.rgb, carTintedPaint, carPaintStrength * carPaintMask);`,
      );
  };
  clone.customProgramCacheKey = () => `bumper-car-${tint}-${strength.toFixed(2)}`;
  clone.needsUpdate = true;
  return clone;
}

export async function createImportedBumperCar(tint = '#ffffff', tintStrength = 0): Promise<ImportedBumperCar> {
  const source = await loadNormalizedSource();
  const root = source.clone(true);
  const materials: THREE.Material[] = [];

  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.castShadow = true;
    child.receiveShadow = true;
    const sourceMaterials = Array.isArray(child.material) ? child.material : [child.material];
    const clonedMaterials = sourceMaterials.map((material) => {
      const cloned = tintMaterial(material, tint, tintStrength);
      materials.push(cloned);
      return cloned;
    });
    child.material = Array.isArray(child.material) ? clonedMaterials : clonedMaterials[0];
    child.name ||= 'importedBumperCarMesh';
  });

  return { root, materials };
}
