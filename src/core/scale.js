
export const KM_PER_UNIT = 500;

const AU_KM = 149_597_870.7;

const LY_KM = 9.461e12;

export const SCALE_LEVELS = [
  { id: 'leo',         label: 'LOW EARTH ORBIT',    minDist: 0,      maxDist: 15     },
  { id: 'orbit',       label: 'EARTH ORBIT',         minDist: 15,     maxDist: 90     },
  { id: 'cislunar',    label: 'CISLUNAR SPACE',       minDist: 90,     maxDist: 800    },
  { id: 'inner_solar', label: 'INNER SOLAR SYSTEM',  minDist: 800,    maxDist: 5_000  },
  { id: 'outer_solar', label: 'OUTER SOLAR SYSTEM',  minDist: 5_000,  maxDist: 90_000 },
  { id: 'interstellar',label: 'INTERSTELLAR',         minDist: 90_000, maxDist: Infinity },
];

export function getScaleInfo(distUnits) {
  const level = SCALE_LEVELS.find(s => distUnits >= s.minDist && distUnits < s.maxDist)
             ?? SCALE_LEVELS[SCALE_LEVELS.length - 1];

  const km = distUnits * KM_PER_UNIT;
  let distStr;

  if (km < 1_000) {
    distStr = `${km.toFixed(0)} km`;
  } else if (km < 1_000_000) {
    distStr = `${(km / 1_000).toFixed(1)}k km`;
  } else if (km < AU_KM * 0.1) {
    distStr = `${(km / 1_000_000).toFixed(2)}M km`;
  } else if (km < LY_KM * 0.1) {
    distStr = `${(km / AU_KM).toFixed(3)} AU`;
  } else {
    distStr = `${(km / LY_KM).toFixed(4)} ly`;
  }

  return { level, distStr };
}
