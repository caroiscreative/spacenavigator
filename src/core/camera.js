
import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const EARTH_RADIUS_UNITS = 12.74;

export function createCamera(renderer) {
  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.001,
    1e9,
  );

  camera.position.set(0, EARTH_RADIUS_UNITS * 0.8, EARTH_RADIUS_UNITS * 3.2);
  camera.lookAt(0, 0, 0);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping  = true;
  controls.dampingFactor  = 0.04;
  controls.minDistance    = EARTH_RADIUS_UNITS * 1.02;
  controls.maxDistance    = EARTH_RADIUS_UNITS * 400;
  controls.enablePan      = false;
  controls.rotateSpeed    = 0.5;
  controls.zoomSpeed      = 1.2;
  controls.autoRotate     = false;

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  return { camera, controls };
}
