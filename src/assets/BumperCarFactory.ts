import * as THREE from 'three';

export type BumperCarStyle = 'mint-comet' | 'cherry-rocket' | 'lavender-bug' | 'gold-taxi';

export const HERO_CAR_PAINT = '#0c6f7a';

type CarPalette = {
  body: string;
  secondary: string;
  light: string;
  decal: string;
};

const PALETTES: Record<BumperCarStyle, CarPalette> = {
  'mint-comet': { body: HERO_CAR_PAINT, secondary: '#e9d9b4', light: '#f5c45b', decal: '#bd8b4a' },
  'cherry-rocket': { body: '#c83e4d', secondary: '#f1a06f', light: '#fff0c2', decal: '#18314f' },
  'lavender-bug': { body: '#9b83c6', secondary: '#f3d8d0', light: '#fff0c2', decal: '#4e315f' },
  'gold-taxi': { body: '#f5c45b', secondary: '#6b4c3b', light: '#fff4cf', decal: '#18314f' },
};

export type BumperCarModel = {
  root: THREE.Group;
  geometries: THREE.BufferGeometry[];
  materials: THREE.Material[];
  antenna: THREE.Group;
  lamps: THREE.Mesh[];
};

function createHullGeometry(style: BumperCarStyle): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const pointed = style === 'cherry-rocket' ? 0.2 : 0.38;
  const wide = style === 'lavender-bug' ? 0.78 : style === 'gold-taxi' ? 0.7 : 0.68;
  shape.moveTo(0, -0.84);
  shape.quadraticCurveTo(wide, -0.67, wide + pointed, -0.16);
  shape.quadraticCurveTo(wide + 0.02, 0.64, 0.44, 0.78);
  shape.quadraticCurveTo(0, 0.9, -0.44, 0.78);
  shape.quadraticCurveTo(-wide - 0.02, 0.64, -wide - pointed, -0.16);
  shape.quadraticCurveTo(-wide, -0.67, 0, -0.84);
  return new THREE.ExtrudeGeometry(shape, {
    depth: style === 'gold-taxi' ? 0.32 : 0.27,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.06,
    bevelThickness: 0.06,
    curveSegments: 16,
  });
}

function roundedPanel(width: number, height: number, radius = 0.08): THREE.ShapeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2 + radius, -height / 2);
  shape.lineTo(width / 2 - radius, -height / 2);
  shape.quadraticCurveTo(width / 2, -height / 2, width / 2, -height / 2 + radius);
  shape.lineTo(width / 2, height / 2 - radius);
  shape.quadraticCurveTo(width / 2, height / 2, width / 2 - radius, height / 2);
  shape.lineTo(-width / 2 + radius, height / 2);
  shape.quadraticCurveTo(-width / 2, height / 2, -width / 2, height / 2 - radius);
  shape.lineTo(-width / 2, -height / 2 + radius);
  shape.quadraticCurveTo(-width / 2, -height / 2, -width / 2 + radius, -height / 2);
  return new THREE.ShapeGeometry(shape, 3);
}

export function createBumperCar(style: BumperCarStyle): BumperCarModel {
  const palette = PALETTES[style];
  const root = new THREE.Group();
  root.name = style;
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const bodyMaterial = new THREE.MeshPhysicalMaterial({ color: palette.body, roughness: 0.32, metalness: 0.08, clearcoat: 0.72, clearcoatRoughness: 0.2 });
  const secondaryMaterial = new THREE.MeshStandardMaterial({ color: palette.secondary, roughness: 0.58, metalness: 0.03 });
  const rubberMaterial = new THREE.MeshStandardMaterial({ color: '#26212a', roughness: 0.94, metalness: 0 });
  const chromeMaterial = new THREE.MeshStandardMaterial({ color: style === 'mint-comet' ? '#bd9457' : '#d8cdbb', roughness: 0.24, metalness: 0.82 });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: '#352c38', roughness: 0.72, metalness: 0.02 });
  const decalMaterial = new THREE.MeshStandardMaterial({ color: palette.decal, roughness: 0.52, polygonOffset: true, polygonOffsetFactor: -2 });
  const lampMaterial = new THREE.MeshStandardMaterial({ color: palette.light, emissive: palette.light, emissiveIntensity: 1.35, roughness: 0.3 });
  materials.push(bodyMaterial, secondaryMaterial, rubberMaterial, chromeMaterial, darkMaterial, decalMaterial, lampMaterial);

  const hullGeometry = createHullGeometry(style);
  hullGeometry.rotateX(Math.PI / 2);
  hullGeometry.translate(0, 0.18, 0);
  const hull = new THREE.Mesh(hullGeometry, bodyMaterial);
  hull.name = 'paintedHull';
  hull.castShadow = true;
  hull.receiveShadow = true;
  root.add(hull);
  geometries.push(hullGeometry);

  const skirtGeometry = new THREE.CylinderGeometry(0.78, 0.84, 0.2, 32);
  const skirt = new THREE.Mesh(skirtGeometry, darkMaterial);
  skirt.scale.z = style === 'cherry-rocket' ? 1.28 : 1.16;
  skirt.position.y = 0.19;
  skirt.castShadow = true;
  root.add(skirt);
  geometries.push(skirtGeometry);

  const bumperGeometry = new THREE.TorusGeometry(0.83, 0.09, 10, 42);
  const bumper = new THREE.Mesh(bumperGeometry, rubberMaterial);
  bumper.name = 'rubberBumper';
  bumper.rotation.x = Math.PI / 2;
  bumper.scale.y = style === 'cherry-rocket' ? 1.3 : 1.17;
  bumper.position.y = 0.27;
  bumper.castShadow = true;
  root.add(bumper);
  geometries.push(bumperGeometry);

  const seatGeometry = new THREE.BoxGeometry(style === 'lavender-bug' ? 0.66 : 0.58, 0.38, 0.3, 3, 2, 2);
  const seat = new THREE.Mesh(seatGeometry, secondaryMaterial);
  seat.name = 'stitchedSeat';
  seat.position.set(0, 0.66, 0.22);
  seat.rotation.x = -0.12;
  seat.castShadow = true;
  root.add(seat);
  geometries.push(seatGeometry);

  const seatInsetGeometry = roundedPanel(0.42, 0.23);
  const seatInset = new THREE.Mesh(seatInsetGeometry, darkMaterial);
  seatInset.position.set(0, 0.675, 0.055);
  seatInset.rotation.x = -Math.PI / 2 - 0.12;
  root.add(seatInset);
  geometries.push(seatInsetGeometry);

  const steeringGeometry = new THREE.TorusGeometry(0.17, 0.022, 6, 20);
  const steering = new THREE.Mesh(steeringGeometry, chromeMaterial);
  steering.name = 'steeringWheel';
  steering.position.set(0, 0.73, -0.18);
  steering.rotation.x = -0.62;
  root.add(steering);
  geometries.push(steeringGeometry);

  const hoodPanelGeometry = roundedPanel(style === 'gold-taxi' ? 0.58 : 0.48, 0.5, 0.12);
  const hoodPanel = new THREE.Mesh(hoodPanelGeometry, secondaryMaterial);
  hoodPanel.position.set(0, 0.51, -0.48);
  hoodPanel.rotation.x = -Math.PI / 2;
  root.add(hoodPanel);
  geometries.push(hoodPanelGeometry);

  const decalShape = new THREE.Shape();
  decalShape.moveTo(0, 0.12);
  decalShape.bezierCurveTo(-0.15, 0.25, -0.3, 0.02, 0, -0.23);
  decalShape.bezierCurveTo(0.3, 0.02, 0.15, 0.25, 0, 0.12);
  const decalGeometry = new THREE.ShapeGeometry(decalShape, 8);
  const decal = new THREE.Mesh(decalGeometry, decalMaterial);
  decal.name = 'heartDecal';
  decal.position.set(0, 0.518, -0.5);
  decal.rotation.x = -Math.PI / 2;
  decal.scale.setScalar(style === 'gold-taxi' ? 0.62 : 0.48);
  root.add(decal);
  geometries.push(decalGeometry);

  const lampGeometry = new THREE.SphereGeometry(0.09, 12, 8);
  const lamps: THREE.Mesh[] = [];
  for (const x of [-0.36, 0.36]) {
    const lamp = new THREE.Mesh(lampGeometry, lampMaterial);
    lamp.name = x < 0 ? 'leftHeadlamp' : 'rightHeadlamp';
    lamp.scale.z = 0.55;
    lamp.position.set(x, 0.42, -0.73);
    lamps.push(lamp);
    root.add(lamp);
  }
  geometries.push(lampGeometry);

  const railGeometry = new THREE.TorusGeometry(0.54, 0.018, 5, 30, Math.PI);
  const rail = new THREE.Mesh(railGeometry, chromeMaterial);
  rail.name = 'cockpitRail';
  rail.position.set(0, 0.73, 0.12);
  rail.rotation.set(Math.PI / 2, 0, Math.PI);
  root.add(rail);
  geometries.push(railGeometry);

  const antenna = new THREE.Group();
  antenna.name = 'antenna';
  const stemGeometry = new THREE.CylinderGeometry(0.014, 0.018, 0.48, 6);
  const stem = new THREE.Mesh(stemGeometry, chromeMaterial);
  stem.position.y = 0.2;
  const tipGeometry = new THREE.SphereGeometry(0.065, 8, 6);
  const tip = new THREE.Mesh(tipGeometry, lampMaterial);
  tip.position.y = 0.45;
  antenna.add(stem, tip);
  antenna.position.set(0.48, 0.55, 0.28);
  root.add(antenna);
  geometries.push(stemGeometry, tipGeometry);

  if (style === 'cherry-rocket') {
    const spoilerGeometry = new THREE.BoxGeometry(0.9, 0.08, 0.16);
    const spoiler = new THREE.Mesh(spoilerGeometry, secondaryMaterial);
    spoiler.position.set(0, 0.55, 0.75);
    spoiler.castShadow = true;
    root.add(spoiler);
    geometries.push(spoilerGeometry);
  } else if (style === 'gold-taxi') {
    const topperGeometry = new THREE.BoxGeometry(0.34, 0.16, 0.2);
    const topper = new THREE.Mesh(topperGeometry, lampMaterial);
    topper.position.set(0, 0.96, 0.16);
    root.add(topper);
    geometries.push(topperGeometry);
  } else if (style === 'lavender-bug') {
    const canopyGeometry = new THREE.SphereGeometry(0.44, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    const canopyMaterial = new THREE.MeshPhysicalMaterial({ color: '#c7e9e5', transparent: true, opacity: 0.38, roughness: 0.18, metalness: 0.02, transmission: 0.08 });
    const canopy = new THREE.Mesh(canopyGeometry, canopyMaterial);
    canopy.scale.z = 0.8;
    canopy.position.set(0, 0.62, 0.1);
    root.add(canopy);
    geometries.push(canopyGeometry);
    materials.push(canopyMaterial);
  }

  root.scale.setScalar(0.92);
  return { root, geometries, materials, antenna, lamps };
}
