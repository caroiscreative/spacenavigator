

const LAYER_ORDER = [
  'stars', 'orbits', 'constellations', 'satellites', 'debris',
  'asteroids', 'risk', 'heat', 'interstellar', 'weather',
];

function fmt(n) {
  return parseFloat(n.toPrecision(6));
}

export function encodeState({ camPos, camTarget, simTime, speedIndex, layers, selection = {} }) {
  const cam = [fmt(camPos.x), fmt(camPos.y), fmt(camPos.z)].join(',');
  const tgt = [fmt(camTarget.x), fmt(camTarget.y), fmt(camTarget.z)].join(',');
  const lyr = LAYER_ORDER.reduce(
    (bits, key, i) => bits | (layers[key] ? (1 << i) : 0),
    0,
  );

  const params = new URLSearchParams({ cam, tgt, t: Math.round(simTime), sp: speedIndex, lyr });

  if (selection.satNorad != null)           params.set('sat',    selection.satNorad);
  if (selection.dsoId && selection.dsoCat)  params.set('dso',    `${selection.dsoId}:${selection.dsoCat}`);
  if (selection.planet)                     params.set('planet', selection.planet);
  if (selection.timePanel)                  params.set('tc',     '1');

  return '#' + params.toString();
}

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

export function writeState(hash) {
  history.replaceState(null, '', hash);
}
