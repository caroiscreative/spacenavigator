
import { parseKpForecast } from './drag-forecast.js';

const REFRESH_MS = 15 * 60 * 1000;   // 15-minute refresh

const BASE = '/swpc';

const ENDPOINTS = {
  kp:       `${BASE}/json/planetary_k_index_1m.json`,
  flares:   `${BASE}/json/goes/primary/xray-flares-latest.json`,
  flares7d: `${BASE}/json/goes/primary/xray-flares-7-day.json`,
  alerts:   `${BASE}/products/alerts.json`,
  forecast: `${BASE}/products/noaa-planetary-k-index-forecast.json`,
  xrays:    `${BASE}/json/goes/primary/xrays-6-hour.json`,
  swPlasma: `${BASE}/products/solar-wind/plasma-7-day.json`,
  swMag:    `${BASE}/products/solar-wind/mag-7-day.json`,
  scales:   `${BASE}/products/noaa-scales.json`,         // Official R/S/G scale + 24h probabilities
  sfi:      `${BASE}/json/f107_cm_flux.json`,            // Solar Flux Index (F10.7 cm) in sfu
};

// ── Time-series archives (kept in memory between refreshes) ────────────────
// These raw arrays let getAtTime() binary-search historical data.
// plasma: [[time_tag, density, speed, temperature], ...]  (~7 days, 1-min intervals)
// mag:    [[time_tag, bx, by, bz, ...], ...]              (~7 days, 1-min intervals)
// xray:   [{time_tag, energy, flux}, ...]                 (~6 hours, 1-min intervals)
// flares7d: raw flare objects with begin_time / end_time  (~7 days)
const _archive = {
  plasmaTs:  [],   // pre-parsed timestamps (ms) aligned with plasmaRows
  plasmaRows:[],   // raw rows [[t, density, speed, temp], ...]
  magTs:     [],   // pre-parsed timestamps aligned with magRows
  magRows:   [],   // raw rows [[t, bx, by, bz, ...], ...]
  xrayTs:    [],   // pre-parsed timestamps aligned with xrayRows
  xrayRows:  [],   // raw 0.1-0.8nm entries [{time_tag, flux}, ...]
  flares7d:  [],   // raw 7-day flare objects
};

/** Binary-search sorted timestamp array for the index whose value is closest to target. */
function _bisect(ts, targetMs) {
  if (ts.length === 0) return -1;
  let lo = 0, hi = ts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ts[mid] < targetMs) lo = mid + 1;
    else hi = mid;
  }
  // lo is the first index >= target; check lo-1 too
  if (lo > 0 && Math.abs(ts[lo - 1] - targetMs) <= Math.abs(ts[lo] - targetMs)) {
    return lo - 1;
  }
  return lo;
}

/** Parse time_tag strings to ms — handles "2026-01-15 10:00:00.000" and ISO format. */
function _parseTs(tag) {
  // NOAA uses "YYYY-MM-DD HH:MM:SS.sss" — replace space with T for ISO parsing
  return new Date(tag.replace(' ', 'T') + (tag.includes('T') ? '' : 'Z')).getTime();
}

export function createSpaceWeather() {
  const data = {
    kp:             null,       // Kp index 0.0 – 9.0
    kpClass:        'quiet',    // quiet | unsettled | storm | severe
    flareClass:     '—',        // A / B / C / M / X (current/latest)
    flareIntensity: null,       // numeric suffix, e.g. 2.3 → "M2.3"
    alertCount:     0,
    kpForecast:     [],         // Array<{time, kp, observed}> — 72h, 3h intervals
    // ── Solar health ────────────────────────────────────────────────
    xrayFlux:       null,       // W/m² — real-time 0.1-0.8nm flux
    xrayClass:      'B',        // A | B | C | M | X
    solarWindSpeed: null,       // km/s
    bzNT:           null,       // nT — IMF Bz component (negative = southward = geoeffective)
    recentFlares:   [],         // Array<{cls, beginTime, durationMin}> last 5, newest first
    // NOAA official severity scales — R (radio), S (radiation), G (geomagnetic)
    noaaScales: {
      R: 0, RText: 'none',           // current R0-R5
      S: 0, SText: 'none',           // current S0-S5
      G: 0, GText: 'none',           // current G0-G5
      R24hMinorProb: 0,              // % probability of R1+ in next 24h
      R24hMajorProb: 0,              // % probability of R3+ in next 24h
      S24hProb:      0,              // % probability of any S event in next 24h
      G24h:          0,              // expected G level next 24h
      G24hText:      null,           // e.g. "minor", "moderate"
    },
    sfi:            null,       // Solar Flux Index — F10.7 cm radio flux in sfu
    // ────────────────────────────────────────────────────────────────
    lastUpdate:     null,       // Date
    error:          false,
  };

  const listeners = [];
  function onUpdate(fn) { listeners.push(fn); }
  function emit()       { listeners.forEach(fn => fn({ ...data })); }

  function kpToClass(kp) {
    if (kp === null) return 'quiet';
    if (kp >= 7)     return 'severe';
    if (kp >= 5)     return 'storm';
    if (kp >= 4)     return 'unsettled';
    return 'quiet';
  }

  async function fetchKp() {
    const res = await fetch(ENDPOINTS.kp, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Kp HTTP ${res.status}`);
    const arr = await res.json();
    if (!Array.isArray(arr) || arr.length === 0) return;

    for (let i = arr.length - 1; i >= 0; i--) {
      const entry = arr[i];
      const raw = entry?.kp_index ?? entry?.kp ?? (Array.isArray(entry) ? entry[1] : null);
      const val = parseFloat(raw);
      if (!isNaN(val)) {
        data.kp      = val;
        data.kpClass = kpToClass(val);
        return;
      }
    }
  }

  async function fetchFlares() {
    const res = await fetch(ENDPOINTS.flares, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Flares HTTP ${res.status}`);
    const arr = await res.json();
    if (!Array.isArray(arr) || arr.length === 0) return;

    const latest = arr[arr.length - 1];
    // current_class for ongoing flares, class/currentClass for completed
    const cls = (
      latest?.current_class ?? latest?.class ?? latest?.currentClass ?? ''
    ).trim();
    if (cls.length >= 1) {
      data.flareClass     = cls[0].toUpperCase();
      const intensity     = parseFloat(cls.slice(1));
      data.flareIntensity = isNaN(intensity) ? null : intensity;
    }
  }

  async function fetchRecentFlares() {
    const res = await fetch(ENDPOINTS.flares7d, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Flares7d HTTP ${res.status}`);
    const arr = await res.json();
    if (!Array.isArray(arr)) return;

    // Archive the full raw array for historical lookup
    _archive.flares7d = arr;

    // Keep last 5 C-class and above, most recent first (for live display)
    const significant = arr
      .filter(f => f.max_class && /^[CMX]/i.test(f.max_class))
      .slice(-5)
      .reverse();

    data.recentFlares = significant.map(f => {
      const beginT = new Date(f.begin_time);
      const endT   = f.end_time ? new Date(f.end_time) : null;
      const durationMin = (endT && !isNaN(endT.getTime()) && !isNaN(beginT.getTime()))
        ? Math.round((endT - beginT) / 60000)
        : null;
      return {
        cls:         f.max_class ?? '—',
        beginTime:   isNaN(beginT.getTime()) ? null : beginT,
        durationMin,
      };
    });
  }

  async function fetchAlerts() {
    const res = await fetch(ENDPOINTS.alerts, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Alerts HTTP ${res.status}`);
    const arr = await res.json();
    if (!Array.isArray(arr)) return;

    const cutoff = Date.now() - 86_400_000;
    data.alertCount = arr.filter(a => {
      const ts = new Date(a.issue_datetime ?? a.issued ?? 0).getTime();
      return ts > cutoff;
    }).length;
  }

  async function fetchForecast() {
    const res = await fetch(ENDPOINTS.forecast, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Forecast HTTP ${res.status}`);
    const raw = await res.json();
    data.kpForecast = parseKpForecast(raw);
  }

  async function fetchXray() {
    const res = await fetch(ENDPOINTS.xrays, { cache: 'no-store' });
    if (!res.ok) throw new Error(`XRay HTTP ${res.status}`);
    const arr = await res.json();
    if (!Array.isArray(arr) || arr.length === 0) return;

    // Use only the 0.1-0.8nm band — this is the standard flare classification band
    const band = arr.filter(e => e.energy === '0.1-0.8nm');
    const entry = band.length > 0 ? band[band.length - 1] : arr[arr.length - 1];
    const flux = parseFloat(entry.flux ?? entry.observed_flux);
    if (isNaN(flux)) return;

    data.xrayFlux = flux;
    if      (flux >= 1e-4) data.xrayClass = 'X';
    else if (flux >= 1e-5) data.xrayClass = 'M';
    else if (flux >= 1e-6) data.xrayClass = 'C';
    else if (flux >= 1e-7) data.xrayClass = 'B';
    else                   data.xrayClass = 'A';

    // ── Archive ──────────────────────────────────────────────────────
    const xrayBand = band.length > 0 ? band : arr;
    _archive.xrayTs   = xrayBand.map(e => _parseTs(e.time_tag));
    _archive.xrayRows = xrayBand.map(e => parseFloat(e.flux ?? e.observed_flux));
  }

  async function fetchSolarWind() {
    const [plasmaRes, magRes] = await Promise.allSettled([
      fetch(ENDPOINTS.swPlasma, { cache: 'no-store' }),
      fetch(ENDPOINTS.swMag,    { cache: 'no-store' }),
    ]);

    if (plasmaRes.status === 'fulfilled' && plasmaRes.value.ok) {
      const plasma = await plasmaRes.value.json();
      // Format: [[header], [time_tag, density, speed, temperature], ...]
      if (Array.isArray(plasma) && plasma.length > 1) {
        const rows = plasma.slice(1);   // drop header row
        const row  = rows[rows.length - 1];
        const speed = parseFloat(row[2]);
        if (!isNaN(speed) && speed > 0) data.solarWindSpeed = speed;

        // ── Archive ────────────────────────────────────────────────
        _archive.plasmaTs   = rows.map(r => _parseTs(r[0]));
        _archive.plasmaRows = rows;
      }
    }

    if (magRes.status === 'fulfilled' && magRes.value.ok) {
      const mag = await magRes.value.json();
      // Format: [[header: time_tag,bx_gsm,by_gsm,bz_gsm,...], ...]
      if (Array.isArray(mag) && mag.length > 1) {
        const rows = mag.slice(1);   // drop header row
        const row  = rows[rows.length - 1];
        const bz = parseFloat(row[3]);
        if (!isNaN(bz)) data.bzNT = bz;

        // ── Archive ────────────────────────────────────────────────
        _archive.magTs   = rows.map(r => _parseTs(r[0]));
        _archive.magRows = rows;
      }
    }
  }

  async function fetchScales() {
    const res = await fetch(ENDPOINTS.scales, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Scales HTTP ${res.status}`);
    const obj = await res.json();

    // "0" = current observed; "1" = 24h forecast
    const current  = obj['0'];
    const forecast = obj['1'];

    if (current) {
      data.noaaScales.R     = parseInt(current.R?.Scale  ?? '0') || 0;
      data.noaaScales.S     = parseInt(current.S?.Scale  ?? '0') || 0;
      data.noaaScales.G     = parseInt(current.G?.Scale  ?? '0') || 0;
      data.noaaScales.RText = current.R?.Text ?? 'none';
      data.noaaScales.SText = current.S?.Text ?? 'none';
      data.noaaScales.GText = current.G?.Text ?? 'none';
    }

    if (forecast) {
      data.noaaScales.R24hMinorProb = parseInt(forecast.R?.MinorProb ?? '0') || 0;
      data.noaaScales.R24hMajorProb = parseInt(forecast.R?.MajorProb ?? '0') || 0;
      data.noaaScales.S24hProb      = parseInt(forecast.S?.Prob      ?? '0') || 0;
      data.noaaScales.G24h          = parseInt(forecast.G?.Scale     ?? '0') || 0;
      data.noaaScales.G24hText      = forecast.G?.Text ?? null;
    }
  }

  async function fetchSfi() {
    const res = await fetch(ENDPOINTS.sfi, { cache: 'no-store' });
    if (!res.ok) throw new Error(`SFI HTTP ${res.status}`);
    const arr = await res.json();
    if (!Array.isArray(arr) || arr.length === 0) return;

    // Prefer the most recent Noon reading (best quality); fall back to any last entry
    const noonReadings = arr.filter(e => e.reporting_schedule === 'Noon').reverse();
    const entry = noonReadings[0] ?? arr[arr.length - 1];
    const sfi = parseFloat(entry.flux);
    if (!isNaN(sfi) && sfi > 0) data.sfi = sfi;
  }

  async function refresh() {
    const results = await Promise.allSettled([
      fetchKp(),
      fetchFlares(),
      fetchAlerts(),
      fetchForecast(),
      fetchXray(),
      fetchSolarWind(),
      fetchRecentFlares(),
      fetchScales(),
      fetchSfi(),
    ]);

    data.error = results.every(r => r.status === 'rejected');
    if (data.error) {
      console.warn('[SpaceWeather] All fetches failed — check network / proxy');
    }

    data.lastUpdate = new Date();
    emit();

    const kpStr    = data.kp !== null ? data.kp.toFixed(1) : '?';
    const flareStr = data.xrayClass !== 'B' ? data.xrayClass : '—';
    const bzStr    = data.bzNT !== null ? `Bz ${data.bzNT.toFixed(1)}nT` : '';
    console.log(`[SpaceWeather] Updated — Kp ${kpStr} (${data.kpClass}) | X-ray ${flareStr} | ${bzStr} | Alerts ${data.alertCount}`);
  }

  refresh();
  const timer = setInterval(refresh, REFRESH_MS);

  function dispose() { clearInterval(timer); }

  /**
   * Returns a weather snapshot for a given simulation time.
   *
   * @param {number} simTimeMs  Simulation timestamp in milliseconds.
   * @returns {{
   *   isLive: boolean,
   *   histTime: Date|null,
   *   historicalUnavailable: boolean,
   *   kp: number|null,
   *   kpClass: string,
   *   xrayFlux: number|null,
   *   xrayClass: string,
   *   solarWindSpeed: number|null,
   *   bzNT: number|null,
   *   recentFlares: Array,
   *   noaaScales: object,
   *   sfi: number|null,
   *   alertCount: number,
   *   kpForecast: Array,
   *   lastUpdate: Date|null,
   *   error: boolean,
   * }}
   *
   * Strategy:
   *  • Within 5 minutes of now → live data, isLive = true
   *  • Within 7-day solar-wind archive → historical lookup, isLive = false
   *  • Outside window → live data with historicalUnavailable = true
   *
   * NOTE: Kp history is only ~6 hours from NOAA (1-min endpoint).
   * For historical times we use Kp=null (unavailable), but solar wind
   * speed and Bz are available for the full 7-day window.
   */
  function getAtTime(simTimeMs) {
    const nowMs      = Date.now();
    const diffMs     = simTimeMs - nowMs;
    const LIVE_WINDOW = 5 * 60 * 1000;    // 5 minutes
    const MAX_HIST    = 7.5 * 86_400_000; // 7.5 days

    // ── Live window ────────────────────────────────────────────────
    if (Math.abs(diffMs) <= LIVE_WINDOW) {
      return { ...data, isLive: true, histTime: null, historicalUnavailable: false };
    }

    // ── Future or beyond archive ───────────────────────────────────
    if (diffMs > LIVE_WINDOW || (nowMs - simTimeMs) > MAX_HIST) {
      return { ...data, isLive: false, histTime: null, historicalUnavailable: true };
    }

    // ── Historical lookup (past, within 7-day window) ──────────────
    const histTime = new Date(simTimeMs);
    const result   = {
      ...data,
      isLive:                false,
      histTime,
      historicalUnavailable: false,
      // Start with nulls — fill from archives where available
      kp:             null,
      kpClass:        'quiet',
      solarWindSpeed: null,
      bzNT:           null,
      xrayFlux:       null,
      xrayClass:      'B',
      recentFlares:   [],
    };

    // Solar wind speed (7-day plasma archive)
    if (_archive.plasmaTs.length > 0) {
      const i     = _bisect(_archive.plasmaTs, simTimeMs);
      if (i >= 0) {
        const row   = _archive.plasmaRows[i];
        const speed = parseFloat(row[2]);
        if (!isNaN(speed) && speed > 0) result.solarWindSpeed = speed;
      }
    }

    // IMF Bz (7-day mag archive)
    if (_archive.magTs.length > 0) {
      const i  = _bisect(_archive.magTs, simTimeMs);
      if (i >= 0) {
        const row = _archive.magRows[i];
        const bz  = parseFloat(row[3]);
        if (!isNaN(bz)) result.bzNT = bz;
      }
    }

    // X-ray flux (6-hour archive)
    if (_archive.xrayTs.length > 0) {
      const i = _bisect(_archive.xrayTs, simTimeMs);
      if (i >= 0) {
        const flux = _archive.xrayRows[i];
        if (!isNaN(flux) && flux > 0) {
          result.xrayFlux  = flux;
          if      (flux >= 1e-4) result.xrayClass = 'X';
          else if (flux >= 1e-5) result.xrayClass = 'M';
          else if (flux >= 1e-6) result.xrayClass = 'C';
          else if (flux >= 1e-7) result.xrayClass = 'B';
          else                   result.xrayClass = 'A';
        }
      }
    }

    // Recent flares — keep flares that were active at simTime
    if (_archive.flares7d.length > 0) {
      const significant = _archive.flares7d
        .filter(f => {
          if (!f.max_class || !/^[CMX]/i.test(f.max_class)) return false;
          const begin = new Date(f.begin_time).getTime();
          // Include flares that started at or before simTime (show context)
          return !isNaN(begin) && begin <= simTimeMs;
        })
        .slice(-5)
        .reverse();

      result.recentFlares = significant.map(f => {
        const beginT = new Date(f.begin_time);
        const endT   = f.end_time ? new Date(f.end_time) : null;
        const durationMin = (endT && !isNaN(endT.getTime()) && !isNaN(beginT.getTime()))
          ? Math.round((endT - beginT) / 60000)
          : null;
        return {
          cls:         f.max_class ?? '—',
          beginTime:   isNaN(beginT.getTime()) ? null : beginT,
          durationMin,
        };
      });
    }

    return result;
  }

  return {
    onUpdate,
    getData:   () => ({ ...data }),
    getAtTime,
    refresh,
    dispose,
  };
}
