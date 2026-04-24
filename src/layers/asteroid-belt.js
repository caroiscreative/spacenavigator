
import * as THREE from 'three/webgpu';
import { ASTEROID_COUNT, ASTEROID_ELEMENTS } from '../data/asteroid-data.js';

const SUN_DIRECTION = new THREE.Vector3(0.75, 0.18, 0.64).normalize();
const AU_SCENE      = 650;
const J2000_MS      = 946728000000;
const DEG           = Math.PI / 180;

const REFRESH_SIM_MS  = 24 * 60 * 60 * 1000;   // 1 simulated day
const REFRESH_REAL_MS = 2000;                    // hard cap in real time

const MIN_SHOW_DIST = 800;   // scene units

export function createAsteroidBelt(scene, camera) {
  const sunPos = SUN_DIRECTION.clone().multiplyScalar(AU_SCENE);

  const positions = new Float32Array(ASTEROID_COUNT * 3);
  const geo       = new THREE.BufferGeometry();
  const posAttr   = new THREE.BufferAttribute(positions, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posAttr);

  const colors = new Float32Array(ASTEROID_COUNT * 3);
  buildColors(colors);
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsNodeMaterial({
    size:         1.8,
    sizeAttenuation: false,   // fixed pixel size, no perspective scaling
    vertexColors: true,
    transparent:  true,
    opacity:      0.55,
    depthTest:    false,
    depthWrite:   false,
    blending:     THREE.AdditiveBlending,
  });

  const points          = new THREE.Points(geo, mat);
  points.name           = 'asteroid-belt';
  points.frustumCulled  = false;
  scene.add(points);

  let lastRefreshReal = -Infinity;
  let lastRefreshSim  = -Infinity;
  let visible      = false;   // off by default — matches hudAstActive = false in main.js

  propagate(J2000_MS, positions, sunPos);
  posAttr.needsUpdate = true;

  function update(simTimeMs) {
    const camDist = camera.position.length();
    const show    = visible && camDist > MIN_SHOW_DIST;

    if (points.visible !== show) points.visible = show;
    if (!show) return;

    const now      = Date.now();
    const simDelta  = Math.abs(simTimeMs - lastRefreshSim);
    const realDelta = now - lastRefreshReal;

    if (simDelta >= REFRESH_SIM_MS || realDelta >= REFRESH_REAL_MS) {
      lastRefreshReal = now;
      lastRefreshSim  = simTimeMs;
      propagate(simTimeMs, positions, sunPos);
      posAttr.needsUpdate = true;
    }
  }

  function toggle() {
    visible = !visible;
    console.log(`[AsteroidBelt] ${visible ? 'visible' : 'hidden'}`);
  }

  function dispose() {
    geo.dispose();
    mat.dispose();
    scene.remove(points);
  }

  console.log(`[AsteroidBelt] ${ASTEROID_COUNT} asteroids loaded`);
  return { update, toggle, dispose };
}

function propagate(simTimeMs, out, sunPos) {
  const daysSinceJ2000 = (simTimeMs - J2000_MS) / 86_400_000;

  for (let idx = 0; idx < ASTEROID_COUNT; idx++) {
    const base = idx * 6;
    const a    = ASTEROID_ELEMENTS[base + 0];   // AU
    const e    = ASTEROID_ELEMENTS[base + 1];
    const i    = ASTEROID_ELEMENTS[base + 2] * DEG;   // inclination
    const om   = ASTEROID_ELEMENTS[base + 3] * DEG;   // longitude of ascending node (Ω)
    const w    = ASTEROID_ELEMENTS[base + 4] * DEG;   // argument of perihelion (ω)
    const ma0  = ASTEROID_ELEMENTS[base + 5] * DEG;   // mean anomaly at epoch (J2000)

    const n  = (2 * Math.PI) / (a ** 1.5 * 365.25);   // rad/day
    const M  = ma0 + n * daysSinceJ2000;               // current mean anomaly

    let E = M;
    E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));

    const cosE = Math.cos(E);
    const sinE = Math.sin(E);
    const nu   = Math.atan2(Math.sqrt(1 - e * e) * sinE, cosE - e);

    const r = a * (1 - e * cosE);                 // AU

    const rP = r * Math.cos(nu);
    const rQ = r * Math.sin(nu);

    const cosOm = Math.cos(om); const sinOm = Math.sin(om);
    const cosI  = Math.cos(i);  const sinI  = Math.sin(i);
    const cosW  = Math.cos(w);  const sinW  = Math.sin(w);

    const x_ecl = (cosOm * cosW - sinOm * sinW * cosI) * rP +
                  (-cosOm * sinW - sinOm * cosW * cosI) * rQ;
    const y_ecl = (sinOm * cosW + cosOm * sinW * cosI) * rP +
                  (-sinOm * sinW + cosOm * cosW * cosI) * rQ;
    const z_ecl = (sinW * sinI) * rP +
                  (cosW * sinI) * rQ;

    const sc = AU_SCENE;
    out[idx * 3]     = sunPos.x + x_ecl * sc;
    out[idx * 3 + 1] = sunPos.y + z_ecl * sc;
    out[idx * 3 + 2] = sunPos.z - y_ecl * sc;
  }
}

function buildColors(colors) {
  for (let idx = 0; idx < ASTEROID_COUNT; idx++) {
    const a = ASTEROID_ELEMENTS[idx * 6];    // semi-major axis AU

    let r, g, b;
    if (a < 2.5) {
      r = 0.72; g = 0.60; b = 0.48;
    } else if (a < 2.82) {
      r = 0.58; g = 0.52; b = 0.48;
    } else {
      r = 0.46; g = 0.48; b = 0.52;
    }

    const jitter = 0.75 + Math.random() * 0.35;
    colors[idx * 3]     = r * jitter;
    colors[idx * 3 + 1] = g * jitter;
    colors[idx * 3 + 2] = b * jitter;
  }
}
