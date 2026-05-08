

const GM_KM3 = 3.986004418e5;

const RISK_THRESHOLDS = [
  { level: 'extreme',  minKp: 7, maxAlt: 350 },
  { level: 'high',     minKp: 5, maxAlt: 450 },
  { level: 'elevated', minKp: 3, maxAlt: 380 },
];

export const DRAG_RISK_COLOR = {
  elevated: [1.000, 0.792, 0.157],
  high:     [1.000, 0.427, 0.000],
  extreme:  [1.000, 0.090, 0.267],
};

export function computeDragRisk(kp, tleData) {
  const riskMap = new Map();
  if (kp === null || kp < 3) return riskMap;

  for (let i = 0; i < tleData.length; i++) {
    const n = tleData[i].meanMotion;
    let altKm = 400;
    if (n && n > 0) {
      const n_rad_s = n * (2 * Math.PI) / 86400;
      const a_km    = Math.cbrt(GM_KM3 / (n_rad_s * n_rad_s));
      altKm = a_km - 6371;
    }

    for (const { level, minKp, maxAlt } of RISK_THRESHOLDS) {
      if (kp >= minKp && altKm < maxAlt) {
        riskMap.set(i, level);
        break;
      }
    }
  }

  return riskMap;
}

export function parseKpForecast(raw) {
  if (!Array.isArray(raw) || raw.length < 2) return [];
  const results = [];
  for (let i = 1; i < raw.length; i++) {
    const row = raw[i];
    if (!Array.isArray(row) || row.length < 2) continue;
    const time = new Date(row[0]);
    if (isNaN(time.getTime())) continue;
    const kp = parseFloat(row[1]);
    if (isNaN(kp)) continue;
    results.push({
      time,
      kp,
      observed: typeof row[2] === 'string' && row[2].toLowerCase().includes('observed'),
    });
  }
  return results;
}

export function countRiskLevels(riskMap) {
  const counts = { elevated: 0, high: 0, extreme: 0 };
  for (const level of riskMap.values()) {
    if (Object.prototype.hasOwnProperty.call(counts, level)) counts[level]++;
  }
  return counts;
}
