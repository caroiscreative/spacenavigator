
const STATION_NORADS = new Set([
  25544,  // ISS (ZARYA)
  49044,  // Chinese Space Station (TIANHE)
  36086,  // Tiangong-1 (deorbited, kept for completeness)
  53239,  // CSS module
  54216,  // CSS module
]);

export function parseTLEText(raw) {
  const lines = raw
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const satellites = [];

  for (let i = 0; i + 2 < lines.length; i++) {
    const name  = lines[i];
    const line1 = lines[i + 1];
    const line2 = lines[i + 2];

    if (!line1.startsWith('1 ') || !line2.startsWith('2 ')) {
      continue;
    }

    i += 2;

    const sat = parseTriplet(name, line1, line2);
    if (sat) satellites.push(sat);
  }

  return satellites;
}

function parseTriplet(name, line1, line2) {
  try {
    const norad        = parseInt(line1.substring(2, 7).trim(), 10);
    const inclDeg      = parseFloat(line2.substring(8, 16).trim());
    const meanMotion   = parseFloat(line2.substring(52, 63).trim());
    const eccentricity = parseFloat('0.' + line2.substring(26, 33).trim());

    if (isNaN(norad) || isNaN(inclDeg) || isNaN(meanMotion)) return null;

    const cleanName = name.replace(/\s+/g, ' ').trim();
    const category  = categorize(cleanName, norad, inclDeg, meanMotion, eccentricity);

    const intlRaw     = line1.substring(9, 17).trim();   // e.g. "25155A"
    const yearDigits  = parseInt(intlRaw.substring(0, 2), 10);
    const launchYear  = isNaN(yearDigits) ? null
                      : yearDigits >= 57 ? 1900 + yearDigits : 2000 + yearDigits;
    const launchNum   = parseInt(intlRaw.substring(2, 5), 10);
    const launchPiece = intlRaw.substring(5).trim() || null;
    const launchGroup = (!isNaN(launchYear) && !isNaN(launchNum))
                      ? `${launchYear}-${String(launchNum).padStart(3, '0')}`
                      : null;
    const intlDes     = intlRaw || null;

    return {
      name: cleanName, norad, line1, line2,
      category, inclDeg, meanMotion, eccentricity,
      intlDes, launchGroup, launchPiece, launchYear,
    };
  } catch {
    return null;
  }
}

function categorize(name, norad, inclDeg, meanMotion, eccentricity) {
  const upper = name.toUpperCase();

  if (STATION_NORADS.has(norad))                        return 'station';

  if (/\bDEB\b/.test(upper) || /R\/B/.test(upper))      return 'debris';

  if (upper.includes('STARLINK'))                        return 'starlink';
  if (upper.includes('ONEWEB'))                          return 'oneweb';

  if (eccentricity < 0.01 && inclDeg < 5 && meanMotion >= 0.9 && meanMotion <= 1.1) {
    return 'geo';
  }

  if (meanMotion >= 1.8 && meanMotion <= 2.2 && inclDeg >= 50 && inclDeg <= 65) {
    return 'meo';
  }

  return 'leo';
}
