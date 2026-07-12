import * as THREE from 'three';
import { assetUrl } from '../core/assetUrl';
import type { CampaignStage } from '../game/Campaign';

const loader = new THREE.TextureLoader();

/** Loads the authored stage-floor artwork. The UV crop preserves square texel
 * density across the arena's 5:3 footprint instead of stretching the image. */
export function createStageFloorTexture(stage: CampaignStage): THREE.Texture {
  const texture = loader.load(assetUrl(`assets/textures/stage-floors/${stage.theme.floorPattern}.webp`));
  texture.name = `AuthoredFloor-${stage.theme.floorPattern}`;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(1, 0.6);
  texture.offset.set(0, 0.2);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}
