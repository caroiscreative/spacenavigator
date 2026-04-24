
const REFRESH_MS = 15 * 60 * 1000;   // 15-minute refresh

const BASE = '/swpc';

const ENDPOINTS = {
  kp:     `${BASE}/json/planetary_k_index_1m.json`,
  flares: `${BASE}/json/goes/primary/xray-flares-latest.json`,
  alerts: `${BASE}/products/alerts.json`,
};

export function createSpaceWeather() {
  const data = {
    kp:             null,       // Kp index 0.0 – 9.0
    kpClass:        'quiet',    // quiet | unsettled | storm | severe
    flareClass:     '—',        // A / B / C / M / X
    flareIntensity: null,       // numeric suffix, e.g. 2.3 → "M2.3"
    alertCount:     0,
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
    const cls = (latest?.class ?? latest?.currentClass ?? '').trim();
    if (cls.length >= 1) {
      data.flareClass     = cls[0].toUpperCase();
      const intensity     = parseFloat(cls.slice(1));
      data.flareIntensity = isNaN(intensity) ? null : intensity;
    }
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

  async function refresh() {
    const results = await Promise.allSettled([
      fetchKp(),
      fetchFlares(),
      fetchAlerts(),
    ]);

    data.error = results.every(r => r.status === 'rejected');
    if (data.error) {
      console.warn('[SpaceWeather] All fetches failed — check network / proxy');
    }

    data.lastUpdate = new Date();
    emit();

    const kpStr    = data.kp !== null ? data.kp.toFixed(1) : '?';
    const flareStr = data.flareClass !== '—'
      ? `${data.flareClass}${data.flareIntensity ?? ''}`
      : '—';
    console.log(`[SpaceWeather] Updated — Kp ${kpStr} (${data.kpClass}) | Flare ${flareStr} | Alerts ${data.alertCount}`);
  }

  refresh();
  const timer = setInterval(refresh, REFRESH_MS);

  function dispose() { clearInterval(timer); }

  return {
    onUpdate,
    getData:  () => ({ ...data }),
    refresh,
    dispose,
  };
}
