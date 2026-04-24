
import * as satellite from 'satellite.js';
import * as THREE from 'three/webgpu';

const SEGS      = 64;      // line segments per orbit ellipse
const BRIGHTNESS = 0.18;   // colour scale factor — orbits are dim, additive

const CATEGORY_COLOR = {
  station:  [1.000, 1.000, 1.000],
  starlink: [0.310, 0.765, 0.969],
  oneweb:   [0.502, 0.796, 0.769],
  debris:   [0.937, 0.329, 0.314],
  geo:      [0.808, 0.576, 0.847],
  meo:      [0.506, 0.780, 0.518],
  leo:      [0.310, 0.765, 0.969],
};

const GM_KM3_S2 = 398600.4418;   // Earth gravitational parameter km³/s²
const KM_PER_UNIT = 500;         // scene unit → km conversion

export function createOrbitRings(scene, tles) {
  if (!tles || tles.length === 0) {
    return { toggle: () => {}, dispose: () => {}, highlight: () => {}, clearHighlight: () => {}, isVisible: () => false };
  }

  const totalVerts = tles.length * SEGS * 2;
  const posArr     = new Float32Array(totalVerts * 3);
  const colArr     = new Float32Array(totalVerts * 3);

  const satrecs    = new Array(tles.length).fill(null);

  let   validCount  = 0;   // how many orbits were successfully computed
  let   highlightIdx = -1; // currently highlighted TLE index (-1 = none)

  for (let t = 0; t < tles.length; t++) {
    const tle = tles[t];
    let satrec;
    try {
      satrec = satellite.twoline2satrec(tle.line1, tle.line2);
    } catch {
      continue;
    }
    if (!satrec || satrec.error !== 0) continue;
    satrecs[t] = satrec;

    const n_rad_s = satrec.no / 60;                       // rad/min → rad/s
    if (n_rad_s <= 0) continue;

    const a_km = Math.pow(GM_KM3_S2 / (n_rad_s * n_rad_s), 1 / 3);
    if (a_km < 6378 || a_km > 500_000) continue;         // sanity: < Earth surface or unrealistic

    const e   = Math.min(satrec.ecco, 0.9999);           // eccentricity
    const b_km = a_km * Math.sqrt(1 - e * e);            // semi-minor axis

    const i  = satrec.inclo;                             // inclination rad
    const Om = satrec.nodeo;                             // RAAN rad
    const w  = satrec.argpo;                             // arg of perigee rad

    const cosOm = Math.cos(Om), sinOm = Math.sin(Om);
    const cosi  = Math.cos(i),  sini  = Math.sin(i);
    const cosw  = Math.cos(w),  sinw  = Math.sin(w);

    const rgb = CATEGORY_COLOR[tle.category] ?? CATEGORY_COLOR.leo;
    const cr  = rgb[0] * BRIGHTNESS;
    const cg  = rgb[1] * BRIGHTNESS;
    const cb  = rgb[2] * BRIGHTNESS;

    let px0 = 0, py0 = 0, pz0 = 0;

    for (let j = 0; j <= SEGS; j++) {
      const E   = (j / SEGS) * Math.PI * 2;             // eccentric anomaly
      const xp  = a_km * (Math.cos(E) - e);             // perifocal x
      const yp  = b_km * Math.sin(E);                    // perifocal y

      const xw  = cosw * xp - sinw * yp;
      const yw  = sinw * xp + cosw * yp;

      const xi  = xw;
      const yi  = cosi * yw;
      const zi  = sini * yw;

      const xE  = cosOm * xi - sinOm * yi;
      const yE  = sinOm * xi + cosOm * yi;
      const zE  = zi;

      const sx  = xE /  KM_PER_UNIT;
      const sy  = zE /  KM_PER_UNIT;
      const sz  = -yE / KM_PER_UNIT;

      if (j > 0) {
        const base = (t * SEGS + (j - 1)) * 2 * 3;

        posArr[base]     = px0;  posArr[base + 1] = py0;  posArr[base + 2] = pz0;
        posArr[base + 3] = sx;   posArr[base + 4] = sy;   posArr[base + 5] = sz;

        colArr[base]     = cr;   colArr[base + 1] = cg;   colArr[base + 2] = cb;
        colArr[base + 3] = cr;   colArr[base + 4] = cg;   colArr[base + 5] = cb;
      }

      px0 = sx; py0 = sy; pz0 = sz;
    }

    validCount++;
  }

  console.log(`[OrbitRings] Computed ${validCount} orbital ellipses`);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  geometry.setAttribute('color',    new THREE.BufferAttribute(colArr, 3));

  const material = new THREE.LineBasicNodeMaterial({
    vertexColors: true,
    transparent:  true,
    opacity:      1.0,
    blending:     THREE.AdditiveBlending,
    depthWrite:   false,
    depthTest:    false,  // always visible over Earth — visualization overlay style
  });

  const lines      = new THREE.LineSegments(geometry, material);
  lines.name       = 'orbit-rings';
  lines.frustumCulled = false;
  lines.visible    = false;   // off by default — toggle with 'O'
  scene.add(lines);

  function highlight(tleIdx) {
    if (tleIdx < 0 || tleIdx >= tles.length) { clearHighlight(); return; }
    if (tleIdx === highlightIdx) return;   // already lit

    clearHighlight();                       // restore previous
    highlightIdx = tleIdx;

    const base = tleIdx * SEGS * 2;
    for (let v = 0; v < SEGS * 2; v++) {
      const vi = (base + v) * 3;
      colArr[vi]     = 1.0;    // bright gold — glows with AdditiveBlending
      colArr[vi + 1] = 0.85;
      colArr[vi + 2] = 0.0;
    }
    geometry.attributes.color.needsUpdate = true;
  }

  function clearHighlight() {
    if (highlightIdx < 0) return;
    const t   = highlightIdx;
    const rgb = CATEGORY_COLOR[tles[t]?.category] ?? CATEGORY_COLOR.leo;
    const base = t * SEGS * 2;
    for (let v = 0; v < SEGS * 2; v++) {
      const vi = (base + v) * 3;
      colArr[vi]     = rgb[0] * BRIGHTNESS;
      colArr[vi + 1] = rgb[1] * BRIGHTNESS;
      colArr[vi + 2] = rgb[2] * BRIGHTNESS;
    }
    geometry.attributes.color.needsUpdate = true;
    highlightIdx = -1;
  }

  function isVisible() { return lines.visible; }

  function toggle() {
    lines.visible = !lines.visible;
    if (!lines.visible) clearHighlight();
    console.log(`[OrbitRings] ${lines.visible ? 'shown' : 'hidden'}`);
  }

  function dispose() {
    clearHighlight();
    geometry.dispose();
    material.dispose();
    scene.remove(lines);
  }

  return { toggle, dispose, highlight, clearHighlight, isVisible };
}
