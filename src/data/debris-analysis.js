
const GM      = 3.986004418e5;   // km³ s⁻²
const R_EARTH = 6371.0;          // km

function makeBins() {
  const bins = [];
  function add(low, high) {
    bins.push({ low, high, count: 0, mid: (low + high) / 2 });
  }
  for (let a = 200;    a < 2000;  a += 50)   add(a, a + 50);
  for (let a = 2000;   a < 2500;  a += 100)  add(a, a + 100);
  for (let a = 2500;   a < 20500; a += 500)  add(a, a + 500);
  for (let a = 20500;  a < 36500; a += 1000) add(a, a + 1000);
  return bins;
}

export function analyzeDensity(tles) {
  const bins = makeBins();

  for (const tle of tles) {
    const n = tle.meanMotion;
    if (!n || n <= 0) continue;

    const n_rad_s = n * (2 * Math.PI) / 86400;
    const a_km    = Math.cbrt(GM / (n_rad_s * n_rad_s));
    const h_km    = a_km - R_EARTH;

    for (const bin of bins) {
      if (h_km >= bin.low && h_km < bin.high) {
        bin.count++;
        break;
      }
    }
  }

  return bins.filter(b => b.count > 0);
}
