
import { twoline2satrec, propagate } from 'satellite.js';

let satrecs = [];

let satCount = 0;

let totalCount = 0;

self.onmessage = ({ data }) => {
  switch (data.type) {
    case 'init':    handleInit(data.tles);              break;
    case 'propagate': handlePropagate(data.timestamp);  break;
  }
};

function handleInit(tles) {
  satrecs    = [];
  totalCount = tles.length;

  for (let i = 0; i < tles.length; i++) {
    try {
      const rec = twoline2satrec(tles[i].line1, tles[i].line2);
      if (rec && rec.error === 0) {
        satrecs.push({ rec, idx: i });
      }
    } catch {
    }
  }

  satCount = satrecs.length;
  self.postMessage({ type: 'ready', count: satCount });
  console.debug(`[Worker] ${satCount} satrecs initialised (${totalCount - satCount} rejected)`);
}

function handlePropagate(timestamp) {
  const date = new Date(timestamp);

  const positions = new Float32Array(totalCount * 3);

  for (let i = 0; i < satCount; i++) {
    const { rec, idx } = satrecs[i];
    try {
      const result = propagate(rec, date);

      if (result.position && result.position !== false) {
        const { x, y, z } = result.position;   // ECI km
        positions[idx * 3]     =  x / 500;       // → scene units (1 u = 500 km)
        positions[idx * 3 + 1] =  z / 500;       // ECI z = north pole = Three.js +Y
        positions[idx * 3 + 2] = -y / 500;       // ECI y → Three.js -Z
      }
    } catch {
    }
  }

  self.postMessage({ type: 'positions', positions, count: satCount }, [positions.buffer]);
}
