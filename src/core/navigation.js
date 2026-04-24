
import * as THREE from 'three/webgpu';
import { getScaleInfo } from './scale.js';
import { EARTH_RADIUS_UNITS } from '../utils/coordinates.js';

const SKY_RADIUS   = 9e4;
const MIN_DISTANCE = EARTH_RADIUS_UNITS * 1.002;
const MAX_DISTANCE = SKY_RADIUS * 1.05;
const FLIGHT_MS    = 1800;   // fly-to animation duration

const SOLAR_VIEW_DIR = new THREE.Vector3(0.28, 0.62, 0.73).normalize();

const PRESETS = {
  '1': { label: 'LOW EARTH ORBIT',    dist: 20      },
  '2': { label: 'GEO ORBIT',          dist: 85      },
  '3': { label: 'LUNAR DISTANCE',     dist: 780     },
  '4': { label: 'INNER SOLAR SYSTEM', dist: 3_000,  dir: SOLAR_VIEW_DIR },
  '5': { label: 'STAR FIELD',         dist: 82_000  },
  '6': { label: 'OUTER SOLAR SYSTEM', dist: 22_000, dir: SOLAR_VIEW_DIR },
};

export function createNavigation(camera, controls) {
  controls.minDistance = MIN_DISTANCE;
  controls.maxDistance = MAX_DISTANCE;
  controls.zoomSpeed   = 1.5;

  const elScale  = document.getElementById('stat-scale');
  const elDist   = document.getElementById('stat-dist');
  const elPreset = document.getElementById('stat-preset'); // preset flash label

  let animStart    = null;   // performance.now() when animation began
  let animFromDist = 0;      // starting distance
  let animToDist   = 0;      // target distance
  let animating    = false;
  let animFromDir  = null;   // unit vector — camera direction at animation start
  let animToDir    = null;   // unit vector — target camera direction (null = keep current)

  let focusMesh    = null;

  let lastScaleId = '';

  let presetLabelTimer = null;

  window.addEventListener('keydown', (e) => {
    const preset = PRESETS[e.key];
    if (!preset) return;

    animFromDist = camera.position.distanceTo(controls.target);

    if (focusMesh && focusMesh.userData.planetDef && ['1','2','3'].includes(e.key)) {
      const r      = focusMesh.userData.planetDef.radius;
      const mults  = { '1': 3, '2': 10, '3': 50 };
      animToDist   = r * mults[e.key];
    } else {
      animToDist   = preset.dist;
    }

    if (preset.dir) {
      animFromDir = camera.position.clone().sub(controls.target).normalize();
      animToDir   = preset.dir;
    } else {
      animFromDir = null;
      animToDir   = null;
    }

    animStart  = performance.now();
    animating  = true;

    if (elPreset) {
      elPreset.textContent = preset.label;
      elPreset.style.opacity = '1';
      clearTimeout(presetLabelTimer);
      presetLabelTimer = setTimeout(() => {
        if (elPreset) elPreset.style.opacity = '0';
      }, 2000);
    }
  });

  function flyTo(dist) {
    animFromDist = camera.position.length();   // Earth-relative for search
    animToDist   = dist;
    animStart    = performance.now();
    animating    = true;
  }

  function flyToPoint(targetPos, dist) {
    controls.target.set(targetPos.x ?? targetPos[0], targetPos.y ?? targetPos[1], targetPos.z ?? targetPos[2]);
    animFromDist = camera.position.distanceTo(controls.target);  // distance from NEW target
    animToDist   = dist;
    animStart    = performance.now();
    animating    = true;
  }

  function setFocusPlanet(mesh) {
    focusMesh = mesh;
    if (mesh && mesh.userData.planetDef) {
      controls.minDistance = mesh.userData.planetDef.radius * 1.05;
    }
  }

  function clearFocusPlanet() {
    focusMesh = null;
    controls.minDistance = MIN_DISTANCE;
  }

  function update() {
    if (animating) {
      const elapsed = performance.now() - animStart;
      const t       = Math.min(1.0, elapsed / FLIGHT_MS);
      const ease    = 1 - Math.pow(1 - t, 3);     // cubic ease-out
      const newDist = animFromDist + (animToDist - animFromDist) * ease;

      const target = controls.target;
      let dir;
      if (animToDir && animFromDir) {
        dir = animFromDir.clone().lerp(animToDir, ease).normalize();
      } else {
        dir = camera.position.clone().sub(target);
        if (dir.lengthSq() > 0) dir.normalize();
        else dir.set(0, 0, 1);
      }
      camera.position.copy(target).add(dir.multiplyScalar(newDist));

      if (t >= 1.0) animating = false;
    }

    const d    = camera.position.length();
    camera.near = Math.max(0.0001, d * 5e-5);
    camera.far  = Math.max(2e5,    d * 200);
    camera.updateProjectionMatrix();

    const { level, distStr } = getScaleInfo(d);
    if (level.id !== lastScaleId) {
      lastScaleId = level.id;
      if (elScale) elScale.textContent = level.label;
    }
    if (elDist) elDist.textContent = distStr;
  }

  return { update, flyTo, flyToPoint, setFocusPlanet, clearFocusPlanet };
}
