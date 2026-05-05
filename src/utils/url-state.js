
// url-state.js — encode/decode SpaceNavigator view state as a URL hash fragment.
//
// Hash format (all params optional except cam+tgt):
//   #cam=x,y,z & tgt=x,y,z & t=ms & sp=speedIdx & lyr=bitmask
//   & sat=noradId          (selected satellite NORAD ID)
//   & dso=id:cat           (selected DSO — cat: galaxy | blackhole | nebula)
//   & planet=Name          (selected planet name, or "Sun")
//   & tc=1                 (time controls panel open)
//
// Layer bitmask (LSB → MSB):
//   0 stars | 1 orbits | 2 constellations | 3 satellites | 4 debris
//   5 asteroids | 6 risk | 7 heat | 8 interstellar | 9 weather

const LAYER_ORDER = [
  'stars', 'orbits', 'constellations', 'satellites', 'debris',
  'asteroids', 'risk', 'heat', 'interstellar', 'weather',
];

// 6 significant figures — handles LEO (~13 units) through galactic (~90 000 units)
// without excess precision in the URL.
function fmt(n) {
  return parseFloat(n.toPrecision(6));
}

/**
 * Encode the current view state into a URL hash string.
 *
 * @param {Object}   p
 * @param {{x,y,z}}  p.camPos      - camera.position
 * @param {{x,y,z}}  p.camTarget   - controls.target
 * @param {number}   p.simTime     - simulation timestamp (ms)
 * @param {number}   p.speedIndex  - TIME_SPEEDS index
 * @param {Object}   p.layers      - map of layer key → boolean
 * @param {Object}   [p.selection] - optional selection state:
 *   { satNorad?: number, dsoId?: string, dsoCat?: string,
 *     planet?: string, timePanel?: boolean }
 * @returns {string}  hash string starting with '#'
 */
export function encodeState({ camPos, camTarget, simTime, speedIndex, layers, selection = {} }) {
  const cam = [fmt(camPos.x), fmt(camPos.y), fmt(camPos.z)].join(',');
  const tgt = [fmt(camTarget.x), fmt(camTarget.y), fmt(camTarget.z)].join(',');
  const lyr = LAYER_ORDER.reduce(
    (bits, key, i) => bits | (layers[key] ? (1 << i) : 0),
    0,
  );

  const params = new URLSearchParams({ cam, tgt, t: Math.round(simTime), sp: speedIndex, lyr });

  // Selection state — only write params that are set
  if (selection.satNorad != null)           params.set('sat',    selection.satNorad);
  if (selection.dsoId && selection.dsoCat)  params.set('dso',    `${selection.dsoId}:${selection.dsoCat}`);
  if (selection.planet)                     params.set('planet', selection.planet);
  if (selection.timePanel)                  params.set('tc',     '1');

  return '#' + params.toString();
}

/**
 * Decode the current URL hash into a state object.
 * Returns null if the hash is absent or malformed.
 */
export function decodeState() {
  const hash = location.hash.slice(1);
  if (!hash) return null;
  try {
    const p = new URLSearchParams(hash);
    const camStr = p.get('cam');
    const tgtStr = p.get('tgt');
    if (!camStr || !tgtStr) return null;

    const camParts = camStr.split(',').map(Number);
    const tgtParts = tgtStr.split(',').map(Number);
    if (camParts.length !== 3 || tgtParts.length !== 3) return null;
    if (camParts.some(isNaN) || tgtParts.some(isNaN)) return null;

    const lyrRaw = p.has('lyr') ? parseInt(p.get('lyr')) : null;
    const layers = lyrRaw !== null
      ? Object.fromEntries(LAYER_ORDER.map((key, i) => [key, !!(lyrRaw & (1 << i))]))
      : null;

    // DSO: "id:cat"  (cat can contain colons — split on last one)
    let dsoId = null, dsoCat = null;
    const dsoRaw = p.get('dso');
    if (dsoRaw) {
      const colon = dsoRaw.lastIndexOf(':');
      if (colon > 0) { dsoId = dsoRaw.slice(0, colon); dsoCat = dsoRaw.slice(colon + 1); }
    }

    return {
      camPos:     { x: camParts[0], y: camParts[1], z: camParts[2] },
      camTarget:  { x: tgtParts[0], y: tgtParts[1], z: tgtParts[2] },
      simTime:    p.has('t')  ? parseInt(p.get('t'))  : null,
      speedIndex: p.has('sp') ? parseInt(p.get('sp')) : null,
      layers,
      // Selection
      satNorad:   p.has('sat') ? parseInt(p.get('sat')) : null,
      dsoId,
      dsoCat,
      planet:     p.get('planet') ?? null,
      timePanel:  p.get('tc') === '1',
    };
  } catch {
    return null;
  }
}

/**
 * Push a new hash to the URL bar without triggering a page reload.
 * @param {string} hash  - value returned by encodeState()
 */
export function writeState(hash) {
  history.replaceState(null, '', hash);
}
