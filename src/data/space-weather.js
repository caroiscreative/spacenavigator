
import { parseKpForecast } from './drag-forecast.js';

const REFRESH_MS = 15 * 60 * 1000;

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
  scales:   `${BASE}/products/noaa-scales.json`,
  sfi:      `${BASE}/json/f107_cm_flux.json`,
};

const _archive = {
  plasmaTs:  [],
  plasmaRows:[],
  magTs:     [],
  magRows:   [],
  xrayTs:    [],
  xrayRows:  [],
  flares7d:  [],
};

function _bisect(ts, targetMs) {
  if (ts.length === 0) return -1;
  let lo = 0, hi = ts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ts[mid] < targetMs) lo = mid + 1;
    else hi = mid;
  }

  if (lo > 0 && Math.abs(ts[lo - 1] - targetMs) <= Math.abs(ts[lo] - targetMs)) {
    return lo - 1;
  }
  return lo;
}

function _parseTs(tag) {

  return new Date(tag.replace(' ', 'T') + (tag.includes('T') ? '' : 'Z')).getTime();
}

export function createSpaceWeather() {
  const data = {
    kp:             null,
    kpClass:        'quiet',
    flareClass:     '—',
    flareIntensity: null,
    alertCount:     0,
    kpForecast:     [],

    xrayFlux:       null,
    xrayClass:      'B',
    solarWindSpeed: null,
    bzNT:           null,
    recentFlares:   [],

    noaaScales: {
      R: 0, RText: 'none',
      S: 0, SText: 'none',
      G: 0, GText: 'none',
      R24hMinorProb: 0,
      R24hMajorProb: 0,
      S24hProb:      0,
      G24h:          0,
      G24hText:      null,
    },
    sfi:            null,

    lastUpdate:     null,
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

    _archive.flares7d = arr;

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

      if (Array.isArray(plasma) && plasma.length > 1) {
        const rows = plasma.slice(1);
        const row  = rows[rows.length - 1];
        const speed = parseFloat(row[2]);
        if (!isNaN(speed) && speed > 0) data.solarWindSpeed = speed;

        _archive.plasmaTs   = rows.map(r => _parseTs(r[0]));
        _archive.plasmaRows = rows;
      }
    }

    if (magRes.status === 'fulfilled' && magRes.value.ok) {
      const mag = await magRes.value.json();

      if (Array.isArray(mag) && mag.length > 1) {
        const rows = mag.slice(1);
        const row  = rows[rows.length - 1];
        const bz = parseFloat(row[3]);
        if (!isNaN(bz)) data.bzNT = bz;

        _archive.magTs   = rows.map(r => _parseTs(r[0]));
        _archive.magRows = rows;
      }
    }
  }

  async function fetchScales() {
    const res = await fetch(ENDPOINTS.scales, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Scales HTTP ${res.status}`);
    const obj = await res.json();

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

  function getAtTime(simTimeMs) {
    const nowMs      = Date.now();
    const diffMs     = simTimeMs - nowMs;
    const LIVE_WINDOW = 5 * 60 * 1000;
    const MAX_HIST    = 7.5 * 86_400_000;

    if (Math.abs(diffMs) <= LIVE_WINDOW) {
      return { ...data, isLive: true, histTime: null, historicalUnavailable: false };
    }

    if (diffMs > LIVE_WINDOW || (nowMs - simTimeMs) > MAX_HIST) {
      return { ...data, isLive: false, histTime: null, historicalUnavailable: true };
    }

    const histTime = new Date(simTimeMs);
    const result   = {
      ...data,
      isLive:                false,
      histTime,
      historicalUnavailable: false,

      kp:             null,
      kpClass:        'quiet',
      solarWindSpeed: null,
      bzNT:           null,
      xrayFlux:       null,
      xrayClass:      'B',
      recentFlares:   [],
    };

    if (_archive.plasmaTs.length > 0) {
      const i     = _bisect(_archive.plasmaTs, simTimeMs);
      if (i >= 0) {
        const row   = _archive.plasmaRows[i];
        const speed = parseFloat(row[2]);
        if (!isNaN(speed) && speed > 0) result.solarWindSpeed = speed;
      }
    }

    if (_archive.magTs.length > 0) {
      const i  = _bisect(_archive.magTs, simTimeMs);
      if (i >= 0) {
        const row = _archive.magRows[i];
        const bz  = parseFloat(row[3]);
        if (!isNaN(bz)) result.bzNT = bz;
      }
    }

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

    if (_archive.flares7d.length > 0) {
      const significant = _archive.flares7d
        .filter(f => {
          if (!f.max_class || !/^[CMX]/i.test(f.max_class)) return false;
          const begin = new Date(f.begin_time).getTime();

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
