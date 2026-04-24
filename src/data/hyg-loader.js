
const COL_ID  =  0;
const COL_HIP =  1;   // Hipparcos catalog number — used by constellation lines data
const COL_MAG = 13;
const COL_CI  = 16;
const COL_X   = 17;
const COL_Y   = 18;
const COL_Z   = 19;

export const SKY_RADIUS = 9e4;

export async function loadHYG(url = '/data/hyg_v38.csv') {
  const t0 = performance.now();

  let response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new Error(`[HYG] network error fetching "${url}": ${err.message}`);
  }
  if (!response.ok) {
    throw new Error(`[HYG] fetch failed — HTTP ${response.status} for "${url}"`);
  }

  const text = await response.text();
  console.log(`[HYG] Fetched ${(text.length / 1e6).toFixed(1)} MB in ${(performance.now() - t0).toFixed(0)} ms`);
  return parseCSV(text);
}

function parseCSV(text) {
  const lines    = text.split('\n');
  const maxStars = lines.length - 1; // line 0 is the header

  const positions = new Float32Array(maxStars * 3);
  const colors    = new Float32Array(maxStars * 3);
  const sizes     = new Float32Array(maxStars);     // reserved for future sizeNode use

  const hipMap = new Map();

  let idx = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const cols = line.split(',');

    if (parseInt(cols[COL_ID], 10) === 0) continue;

    const mag = parseFloat(cols[COL_MAG]);
    const ci  = parseFloat(cols[COL_CI]);
    const hx  = parseFloat(cols[COL_X]);
    const hy  = parseFloat(cols[COL_Y]);
    const hz  = parseFloat(cols[COL_Z]);

    if (!isFinite(hx) || !isFinite(hy) || !isFinite(hz)) continue;
    if (hx === 0 && hy === 0 && hz === 0) continue;
    if (!isFinite(mag)) continue;

    const len = Math.sqrt(hx * hx + hy * hy + hz * hz);
    const nx  =  (hx / len) * SKY_RADIUS;  // threeX =  hygX
    const ny  =  (hz / len) * SKY_RADIUS;  // threeY =  hygZ  (NCP → +Y up)
    const nz  = -(hy / len) * SKY_RADIUS;  // threeZ = −hygY

    positions[idx * 3]     = nx;
    positions[idx * 3 + 1] = ny;
    positions[idx * 3 + 2] = nz;

    const hip = parseInt(cols[COL_HIP], 10);
    if (hip > 0) hipMap.set(hip, { nx, ny, nz });

    sizes[idx] = Math.min(4.0, Math.max(0.4, Math.pow(2.512, (6.5 - mag) / 2.5)));

    const bvSafe = isNaN(ci) ? 0.6 : ci;
    const { r, g, b } = bvToRgb(bvSafe);
    const bright      = magBrightness(mag);

    colors[idx * 3]     = r * bright;
    colors[idx * 3 + 1] = g * bright;
    colors[idx * 3 + 2] = b * bright;

    idx++;
  }

  return {
    positions: positions.subarray(0, idx * 3),
    colors:    colors.subarray(0, idx * 3),
    sizes:     sizes.subarray(0, idx),
    count:     idx,
    hipMap,
  };
}

function bvToRgb(bv) {
  const t = Math.max(-0.4, Math.min(2.0, bv));

  let r, b;

  if (t < 0.3) {
    const f = (t + 0.4) / 0.7;
    r = 0.82 + f * 0.08;   // 0.82 → 0.90
    b = 1.00;
  } else if (t < 0.8) {
    const f = (t - 0.3) / 0.5;
    r = 0.90 + f * 0.10;   // 0.90 → 1.00
    b = 1.00 - f * 0.15;   // 1.00 → 0.85
  } else {
    const f = Math.min(1.0, (t - 0.8) / 1.2);
    r = 1.00;
    b = 0.85 - f * 0.05;   // 0.85 → 0.80
  }

  r = Math.min(1.0, Math.max(0.8, r));
  b = Math.min(1.0, Math.max(0.8, b));
  const g = Math.min(r, b);   // Craig Taylor: G = min(R, B)

  return { r, g, b };
}

function magBrightness(mag) {
  return Math.min(1.0, Math.max(0.03, Math.pow(2.512, (6.5 - mag) / 3.2) * 0.28));
}
