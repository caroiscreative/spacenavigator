
import { parseTLEText } from './tle-parser.js';
import { openTLECache  } from './tle-cache.js';

const GROUPS = [
  'gps-ops', 'glo-ops', 'galileo', 'sbas', 'nnss',
  'stations',
  'weather', 'noaa', 'goes', 'resource', 'sarsat', 'dmc', 'tdrss', 'argos',
  'geo', 'intelsat', 'ses', 'telesat', 'iridium', 'iridium-NEXT',
  'orbcomm', 'globalstar',
  'oneweb', 'planet', 'spire',
  'amateur', 'satnogs', 'cubesat',
  'science', 'geodetic', 'engineering', 'education',
  'military', 'radar', 'gorizont', 'raduga', 'molniya',
  'other-comm', 'other',
  'last-30-days',
];

const CELESTRAK_BASE = '/celestrak/NORAD/elements/gp.php';

export async function fetchTLEs({ forceRefresh = false } = {}) {
  const cache = await openTLECache();

  if (forceRefresh) {
    console.log('[TLEFetcher] Force refresh — clearing cache');
    await cache.clear();
  }

  const MIN_EXPECTED_SATS = 500;

  if (!forceRefresh) {
    const cached = await cache.get('merged');
    if (cached) {
      if (cached.length >= MIN_EXPECTED_SATS) {
        console.log(`[TLEFetcher] Cache hit — ${cached.length} satellites loaded from IndexedDB`);
        return cached;
      } else {
        console.warn(`[TLEFetcher] Cache hit but only ${cached.length} satellites — too few, forcing refresh`);
        await cache.clear();
      }
    }
  }

  console.log('[TLEFetcher] Fetching TLEs from CelesTrak...');
  const t0 = performance.now();

  const groupResults = await fetchAllGroups(cache);

  const merged = mergeAndDedup(groupResults);

  const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
  console.log(`[TLEFetcher] ${merged.length} unique satellites merged in ${elapsed}s`);

  await cache.set('merged', merged);

  return merged;
}

async function fetchAllGroups(cache) {
  const BATCH = 6;   // small groups can tolerate higher concurrency
  const results = [];

  for (let i = 0; i < GROUPS.length; i += BATCH) {
    const batch = GROUPS.slice(i, i + BATCH);
    const batchResults = await Promise.all(batch.map(g => fetchGroup(g, cache)));
    results.push(...batchResults);
  }

  const starlinkJSON = await fetchGroupJSON('starlink', cache);
  if (starlinkJSON.length > 0) {
    console.log(`[TLEFetcher] Starlink JSON bonus → ${starlinkJSON.length} satellites`);
    results.push(starlinkJSON);
  }

  return results;
}

async function fetchGroup(group, cache) {
  const cached = await cache.get(group);
  if (cached) return cached;

  const url = `${CELESTRAK_BASE}?GROUP=${group}&FORMAT=TLE`;
  console.log(`[TLEFetcher] Fetching group '${group}'...`);

  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'text/plain' },
    });

    if (!res.ok) {
      console.warn(`[TLEFetcher] ${group} fetch failed: HTTP ${res.status}`);
      return [];
    }

    const text = await res.text();

    if (text.trim().startsWith('<')) {
      console.warn(`[TLEFetcher] ${group} returned HTML (group may be unavailable)`);
      return [];
    }

    const tles = parseTLEText(text);
    console.log(`[TLEFetcher] ${group} → ${tles.length} satellites`);

    await cache.set(group, tles);
    return tles;

  } catch (err) {
    console.warn(`[TLEFetcher] ${group} fetch error:`, err.message);
    return [];
  }
}

async function fetchGroupJSON(group, cache) {
  const cacheKey = `${group}__json`;
  if (cache) {
    const cached = await cache.get(cacheKey);
    if (cached) return cached;
  }

  const url = `${CELESTRAK_BASE}?GROUP=${group}&FORMAT=JSON`;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return [];

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return [];

    const tleText = data
      .filter(o => o.TLE_LINE1 && o.TLE_LINE2)
      .map(o => `${o.OBJECT_NAME}\n${o.TLE_LINE1}\n${o.TLE_LINE2}`)
      .join('\n');

    const tles = parseTLEText(tleText);

    if (cache && tles.length > 0) await cache.set(cacheKey, tles);
    return tles;

  } catch (err) {
    console.debug(`[TLEFetcher] JSON fetch for '${group}' failed:`, err.message);
    return [];
  }
}

function mergeAndDedup(groupArrays) {
  const byNorad = new Map();

  for (const group of groupArrays) {
    for (const sat of group) {
      byNorad.set(sat.norad, sat);  // last write wins
    }
  }

  return Array.from(byNorad.values());
}
