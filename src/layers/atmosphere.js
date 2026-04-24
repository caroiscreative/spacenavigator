
import * as THREE from 'three/webgpu';
import { normalWorld, positionWorld, cameraPosition, vec3, mix } from 'three/tsl';
import { EARTH_RADIUS_UNITS } from '../utils/coordinates.js';

const ATMO_SCALE   = 1.06;
const ATMO_SEGMENTS = 64;

export function createAtmosphere(scene) {
  const geo = new THREE.SphereGeometry(
    EARTH_RADIUS_UNITS * ATMO_SCALE,
    ATMO_SEGMENTS,
    ATMO_SEGMENTS,
  );

  const mat = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite:  false,
    side:        THREE.FrontSide,
    blending:    THREE.AdditiveBlending,
  });

  const viewDir = cameraPosition.sub(positionWorld).normalize();
  const nDotV   = normalWorld.dot(viewDir).clamp(0.0, 1.0);
  const fresnel = nDotV.oneMinus().pow(3.5);

  const innerColor = vec3(0.08, 0.25, 1.00); // deep blue
  const outerColor = vec3(0.28, 0.58, 1.00); // sky blue

  mat.colorNode   = mix(innerColor, outerColor, fresnel);
  mat.opacityNode = fresnel.mul(0.68); // max ~68% opacity at the limb

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'atmosphere';
  scene.add(mesh);

  return { mesh };
}
