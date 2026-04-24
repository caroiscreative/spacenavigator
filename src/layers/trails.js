
import * as THREE from 'three/webgpu';
import { twoline2satrec, propagate } from 'satellite.js';

const NUM_POINTS = 320;

const UPDATE_INTERVAL_MS = 30_000;

const TRAIL_COLORS = {
  station:  [1.000, 1.000, 1.000],   // white
  starlink: [0.310, 0.765, 0.969],   // sky blue
  oneweb:   [0.502, 0.796, 0.769],   // teal
  debris:   [0.937, 0.329, 0.314],   // red
  geo:      [0.808, 0.576, 0.847],   // purple
  meo:      [0.506, 0.780, 0.518],   // green
  leo:      [0.310, 0.765, 0.969],   // sky blue
};

const PEAK_BRIGHTNESS  = 0.70;
const FLOOR_BRIGHTNESS = 0.02;

export function createTrail(scene, tle) {
  const satrec    = twoline2satrec(tle.line1, tle.line2);
  const periodMs  = (1440 / tle.meanMotion) * 60_000;   // ms per revolution
  const baseColor = TRAIL_COLORS[tle.category] ?? TRAIL_COLORS.leo;

  const posArray = new Float32Array(NUM_POINTS * 3);
  const colArray = new Float32Array(NUM_POINTS * 3);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  geometry.setAttribute('color',    new THREE.BufferAttribute(colArray, 3));

  const material = new THREE.LineBasicNodeMaterial({
    vertexColors: true,
    blending:     THREE.AdditiveBlending,
    depthWrite:   false,
    depthTest:    false,   // render on top of Earth — same fix as heat shells
    transparent:  true,
  });

  const line           = new THREE.Line(geometry, material);
  line.name            = 'orbital-trail';
  line.frustumCulled   = false;   // arc spans huge distance range
  scene.add(line);

  let lastUpdateNow = 0;

  function computeArc(wallClockMs) {
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

      const frac         = i / (NUM_POINTS - 1);          // 0 → 1
      const distCentre   = Math.abs(frac - 0.5) * 2;      // 0 → 1 from centre
      const brightness   = FLOOR_BRIGHTNESS
                         + (PEAK_BRIGHTNESS - FLOOR_BRIGHTNESS)
                         * Math.pow(1 - distCentre, 2.2); // gamma-like curve

      colArray[i * 3]     = baseColor[0] * brightness;
      colArray[i * 3 + 1] = baseColor[1] * brightness;
      colArray[i * 3 + 2] = baseColor[2] * brightness;
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate    = true;
  }

  computeArc(Date.now());
  lastUpdateNow = performance.now();

  function update(now) {
    if (now - lastUpdateNow >= UPDATE_INTERVAL_MS) {
      computeArc(Date.now());
      lastUpdateNow = now;
    }
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
    scene.remove(line);
  }

  return { update, dispose };
}
