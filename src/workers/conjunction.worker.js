
const SCALE_KM    = 500;           // 1 scene unit = 500 km
const MIN_KM      = 1.0;           // skip pairs closer than this (docked/same object)
const WARN_KM     = 100;           // scan threshold
const WARN_SCENE  = WARN_KM / SCALE_KM;

const CRITICAL_KM = 5;
const WARNING_KM  = 25;

self.onmessage = ({ data }) => {
  if (data.type !== 'scan') return;

  const { positions, count, tles } = data;
  const t0 = performance.now();

  const ORIGIN_TOL2 = 0.01 * 0.01;   // within 5 km of origin → skip
  const valid = [];
  for (let i = 0; i < count; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    if (x * x + y * y + z * z < ORIGIN_TOL2) continue;
    valid.push(i);
  }

  valid.sort((a, b) => positions[a * 3] - positions[b * 3]);

  const n             = valid.length;
  const results       = [];
  let   skippedColocated = 0;

  for (let i = 0; i < n; i++) {
    const a  = valid[i];
    const ax = positions[a * 3];
    const ay = positions[a * 3 + 1];
    const az = positions[a * 3 + 2];

    for (let j = i + 1; j < n; j++) {
      const b  = valid[j];
      const bx = positions[b * 3];

      if (bx - ax > WARN_SCENE) break;   // sorted — all further are too far in X

      const dx = ax - bx;
      const dy = ay - positions[b * 3 + 1];
      const dz = az - positions[b * 3 + 2];
      const d2 = dx * dx + dy * dy + dz * dz;

      if (d2 < WARN_SCENE * WARN_SCENE) {
        const distKm = Math.sqrt(d2) * SCALE_KM;

        if (distKm < MIN_KM) {
          skippedColocated++;
          continue;   // docked or same object — skip
        }

        let risk;
        if (distKm < CRITICAL_KM) risk = 'critical';
        else if (distKm < WARNING_KM) risk = 'warning';
        else risk = 'caution';

        results.push({
          idxA:   a,
          idxB:   b,
          distKm,
          risk,
          nameA:  tles[a]?.name     ?? `#${a}`,
          nameB:  tles[b]?.name     ?? `#${b}`,
          catA:   tles[a]?.category ?? 'leo',
          catB:   tles[b]?.category ?? 'leo',
          posA:   [ax, ay, az],
          posB:   [positions[b * 3], positions[b * 3 + 1], positions[b * 3 + 2]],
        });
      }
    }
  }

  results.sort((a, b) => a.distKm - b.distKm);
  const top = results.slice(0, 20);

  const elapsed = (performance.now() - t0).toFixed(1);
  console.log(
    `[ConjunctionWorker] ${valid.length} sats scanned → ` +
    `${results.length} conjunctions (${skippedColocated} co-located skipped), ` +
    `top ${top.length} returned (${elapsed}ms)`
  );

  self.postMessage({
    type:             'results',
    conjunctions:     top,
    totalFound:       results.length,
    skippedColocated,
  });
};
