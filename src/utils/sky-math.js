
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export function raDec3D(raDeg, decDeg) {
  const ra  = raDeg  * DEG2RAD;
  const dec = decDeg * DEG2RAD;
  return {
    x:  Math.cos(dec) * Math.cos(ra),
    y:  Math.sin(dec),
    z: -Math.cos(dec) * Math.sin(ra),
  };
}

export function vec3ToRaDec(x, y, z) {
  const dec = Math.asin(Math.max(-1, Math.min(1, y)));
  const ra  = ((Math.atan2(-z, x) * RAD2DEG) + 360) % 360;
  return { raDeg: ra, decDeg: dec * RAD2DEG };
}

export function altAz(raDeg, decDeg, tsMs, latDeg, lonDeg) {
  const JD = tsMs / 86400000 + 2440587.5;

  let gmst = 280.46061837 + 360.98564736629 * (JD - 2451545.0);
  gmst = ((gmst % 360) + 360) % 360;

  const lst = ((gmst + lonDeg) % 360 + 360) % 360;

  let H = ((lst - raDeg) % 360 + 360) % 360;
  if (H > 180) H -= 360;

  const φ = latDeg * DEG2RAD;
  const δ = decDeg * DEG2RAD;
  const h = H      * DEG2RAD;

  const sinAlt = Math.sin(δ) * Math.sin(φ) + Math.cos(δ) * Math.cos(φ) * Math.cos(h);
  const altRad = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const altDeg = altRad * RAD2DEG;

  const cosAlt = Math.cos(altRad);
  let azDeg = 0;
  if (cosAlt > 1e-6) {
    const sinAz = -Math.sin(h) * Math.cos(δ) / cosAlt;
    const cosAz = (Math.sin(δ) - Math.sin(φ) * sinAlt) / (Math.cos(φ) * cosAlt);
    azDeg = (Math.atan2(sinAz, cosAz) * RAD2DEG + 360) % 360;
  }

  const transitAlt = (90 - Math.abs(latDeg - decDeg));

  const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const azCardinal = DIRS[Math.round(((azDeg % 360) + 360) % 360 / 45) % 8];

  return { altDeg, azDeg, azCardinal, visible: altDeg > 0, transitAlt };
}

export function bestObservingMonth(raDeg) {

  const sunRaNeeded = ((raDeg - 180) + 360) % 360;
  const daysAfterMar20 = sunRaNeeded;
  const bestDOY = ((79 + daysAfterMar20 - 1) % 365) + 1;

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DAYS   = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let doy = Math.max(1, Math.min(365, Math.round(bestDOY)));
  for (let m = 0; m < 12; m++) {
    if (doy <= DAYS[m]) return MONTHS[m];
    doy -= DAYS[m];
  }
  return 'Dec';
}

export function bsAsVisibility(decDeg) {
  const OBS_LAT = -34.6;
  if (decDeg < OBS_LAT - 90) return 'Never rises above horizon';
  if (decDeg > 90 + OBS_LAT) return 'Never visible from Buenos Aires';
  if (decDeg < -(90 - Math.abs(OBS_LAT))) return 'Circumpolar — always above horizon';
  if (decDeg < 0)  return 'High in the southern sky';
  if (decDeg < 30) return 'Visible in the northern sky';
  return 'Low on the northern horizon';
}
