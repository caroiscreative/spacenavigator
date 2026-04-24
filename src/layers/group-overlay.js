
import * as THREE from 'three/webgpu';
import { twoline2satrec, propagate } from 'satellite.js';

const UPDATE_INTERVAL_MS = 30_000;

const PEAK_BRIGHTNESS  = 0.52;
const FLOOR_BRIGHTNESS = 0.03;

const TRAIL_COLORS = {
  station:  [1.000, 1.000, 1.000],
  starlink: [0.310, 0.765, 0.969],
  oneweb:   [0.502, 0.796, 0.769],
  debris:   [0.937, 0.329, 0.314],
  geo:      [0.808, 0.576, 0.847],
  meo:      [0.506, 0.780, 0.518],
  leo:      [0.310, 0.765, 0.969],
};

export function createGroupOverlay(scene, groupEntries) {
  if (!groupEntries || groupEntries.length === 0) return null;

  const NUM_POINTS = Math.max(60, 120 - Math.floor(groupEntries.length * 0.8));

  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    blending:     THREE.AdditiveBlending,
    depthWrite:   false,
    depthTest:    false,   // same fix as trails / heat shells
    transparent:  true,
  });

  const envelopeGroup     = new THREE.Group();
  envelopeGroup.name      = 'group-envelope';
  envelopeGroup.frustumCulled = false;
  scene.add(envelopeGroup);

  const _proj = new THREE.Vector3();   // reused in updateReticles

  const satellites = groupEntries.map(({ tle, idx }) => {
    const satrec    = twoline2satrec(tle.line1, tle.line2);
    const periodMs  = (1440 / tle.meanMotion) * 60_000;
    const baseColor = TRAIL_COLORS[tle.category] ?? TRAIL_COLORS.leo;

    const posArray = new Float32Array(NUM_POINTS * 3);
    const colArray = new Float32Array(NUM_POINTS * 3);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    geometry.setAttribute('color',    new THREE.BufferAttribute(colArray, 3));

    const line         = new THREE.Line(geometry, material);
    line.frustumCulled = false;
    envelopeGroup.add(line);

    return { idx, satrec, periodMs, baseColor, posArray, colArray, geometry };
  });

  const reticleContainer    = document.createElement('div');
  reticleContainer.id       = 'group-reticles';
  reticleContainer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(reticleContainer);

  const reticleEls = groupEntries.map(() => {
    const el       = document.createElement('div');
    el.className   = 'group-reticle hidden';
    el.innerHTML   =
      '<div class="sr-corner sr-tl"></div>' +
      '<div class="sr-corner sr-tr"></div>' +
      '<div class="sr-corner sr-bl"></div>' +
      '<div class="sr-corner sr-br"></div>';
    reticleContainer.appendChild(el);
    return el;
  });

  function computeAllArcs(wallClockMs) {
    for (const sat of satellites) {
      const { satrec, periodMs, baseColor, posArray, colArray, geometry } = sat;
      const halfPeriod = periodMs / 2;

      for (let i = 0; i < NUM_POINTS; i++) {
        const t      = wallClockMs - halfPeriod + (i / (NUM_POINTS - 1)) * periodMs;
        const result = propagate(satrec, new Date(t));

        if (result.position && result.position !== false) {
          const { x, y, z } = result.position;   // ECI km
          posArray[i * 3]     =  x / 500;
          posArray[i * 3 + 1] =  z / 500;
          posArray[i * 3 + 2] = -y / 500;
        }

        const frac       = i / (NUM_POINTS - 1);
        const distCentre = Math.abs(frac - 0.5) * 2;          // 0→1 from centre
        const brightness = FLOOR_BRIGHTNESS
                         + (PEAK_BRIGHTNESS - FLOOR_BRIGHTNESS)
                         * Math.pow(1 - distCentre, 2.2);

        colArray[i * 3]     = baseColor[0] * brightness;
        colArray[i * 3 + 1] = baseColor[1] * brightness;
        colArray[i * 3 + 2] = baseColor[2] * brightness;
      }

      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate    = true;
    }
  }

  computeAllArcs(Date.now());
  let lastUpdateNow = performance.now();

  function update(now) {
    if (now - lastUpdateNow >= UPDATE_INTERVAL_MS) {
      computeAllArcs(Date.now());
      lastUpdateNow = now;
    }
  }

  function updateReticles(positions, camera, canvas) {
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;

    for (let i = 0; i < satellites.length; i++) {
      const { idx } = satellites[i];
      const el      = reticleEls[i];

      const px = positions[idx * 3];
      const py = positions[idx * 3 + 1];
      const pz = positions[idx * 3 + 2];

      if (px === 0 && py === 0 && pz === 0) {
        el.classList.add('hidden');
        continue;
      }

      _proj.set(px, py, pz).project(camera);

      if (_proj.z >= 1) {   // behind the camera
        el.classList.add('hidden');
        continue;
      }

      const sx = (_proj.x  + 1) / 2 * W;
      const sy = (-_proj.y + 1) / 2 * H;

      el.style.transform = `translate(calc(${sx}px - 50%), calc(${sy}px - 50%))`;
      el.classList.remove('hidden');
    }
  }

  function dispose() {
    for (const sat of satellites) {
      sat.geometry.dispose();
    }
    material.dispose();
    scene.remove(envelopeGroup);
    reticleContainer.remove();
  }

  return { update, updateReticles, dispose };
}
