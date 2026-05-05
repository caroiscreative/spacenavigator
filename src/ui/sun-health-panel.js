
/**
 * Sun Health Panel — tabbed panel for The Sun.
 *
 * Tab 1 – INFO:  static physical facts (existing content)
 * Tab 2 – HEALTH: live solar weather data from spaceWeather
 *
 * Callbacks:
 *   onViewRealSize()  — called when user clicks "VIEW REAL SIZE"
 *   onOpenWeather()   — called when user clicks "SPACE WEATHER ↗"
 */

// SDO direct image URLs — NASA serves these publicly, no proxy needed for <img> tags
const SDO_URLS = {
  '304':  'https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_0304.jpg',
  '171':  'https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_0171.jpg',
  'hmi':  'https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_Hmib.jpg',
};

const SDO_LABELS = {
  '304': 'AIA 304Å — Chromosphere',
  '171': 'AIA 171Å — Corona',
  'hmi': 'HMI — Magnetic Field',
};

// Sun–Earth distance in km
const AU_KM = 149_597_870;

export function createSunHealthPanel({ spaceWeather, onViewRealSize, onOpenWeather }) {
  const panel     = document.getElementById('sun-panel');
  if (!panel) return { show: () => {}, hide: () => {}, toggle: () => false, isVisible: () => false };

  // ── DOM refs ────────────────────────────────────────────────────────
  const tabInfo      = panel.querySelector('.sun-tab[data-tab="info"]');
  const tabHealth    = panel.querySelector('.sun-tab[data-tab="health"]');
  const bodyInfo     = panel.querySelector('#sun-body-info');
  const bodyHealth   = panel.querySelector('#sun-body-health');
  const closeBtn     = panel.querySelector('#sun-panel-close');

  const sdoImg       = panel.querySelector('#sun-sdo-img');
  const sdoCredit    = panel.querySelector('#sun-sdo-credit');
  const sdoBtns      = panel.querySelectorAll('.sun-sdo-btn');

  const xrayBarEl    = panel.querySelector('#sun-xray-bar');
  const xrayValEl    = panel.querySelector('#sun-xray-val');
  const xrayClsEl    = panel.querySelector('#sun-xray-cls');
  const swSpeedEl    = panel.querySelector('#sun-sw-speed');
  const bzEl         = panel.querySelector('#sun-bz');
  const sfiEl        = panel.querySelector('#sun-sfi');
  const flaresEl     = panel.querySelector('#sun-flares-list');
  const impactsEl    = panel.querySelector('#sun-impacts');
  const travelEl     = panel.querySelector('#sun-travel-time');
  const holoBtn      = panel.querySelector('#sun-holo-btn');
  const wxBtn        = panel.querySelector('#sun-wx-btn');

  let _activeTab = 'health';   // open on health by default
  let _sdoKey    = '304';
  let _holoActive = false;

  // ── Tab switching ───────────────────────────────────────────────────
  function setTab(tab) {
    _activeTab = tab;
    tabInfo?.classList.toggle('active', tab === 'info');
    tabHealth?.classList.toggle('active', tab === 'health');
    if (bodyInfo)    bodyInfo.style.display    = tab === 'info'   ? '' : 'none';
    if (bodyHealth)  bodyHealth.style.display  = tab === 'health' ? '' : 'none';
  }

  tabInfo?.addEventListener('click',   () => setTab('info'));
  tabHealth?.addEventListener('click', () => setTab('health'));

  // ── SDO wavelength selector ──────────────────────────────────────────
  function setSdo(key) {
    _sdoKey = key;
    if (sdoImg)    sdoImg.src       = SDO_URLS[key] + '?t=' + Math.floor(Date.now() / 600_000);
    if (sdoCredit) sdoCredit.textContent = SDO_LABELS[key] + ' · NASA/SDO · live';
    sdoBtns.forEach(b => b.classList.toggle('active', b.dataset.sdo === key));
  }

  sdoBtns.forEach(b => b.addEventListener('click', () => setSdo(b.dataset.sdo)));

  // ── Close ────────────────────────────────────────────────────────────
  closeBtn?.addEventListener('click', hide);

  // ── VIEW REAL SIZE ───────────────────────────────────────────────────
  if (holoBtn) {
    holoBtn.addEventListener('click', () => {
      _holoActive = !_holoActive;
      holoBtn.classList.toggle('active', _holoActive);
      holoBtn.textContent = _holoActive ? 'HIDE REAL SIZE' : 'VIEW REAL SIZE';
      onViewRealSize?.(_holoActive);
    });
  }

  // ── SPACE WEATHER link ───────────────────────────────────────────────
  wxBtn?.addEventListener('click', () => onOpenWeather?.());

  // ── Color helpers ────────────────────────────────────────────────────
  function xrayColor(cls) {
    switch (cls) {
      case 'X': return '#FF1744';
      case 'M': return '#FF6D00';
      case 'C': return '#FFCA28';
      case 'B': return '#69F0AE';
      default:  return '#888';
    }
  }

  function xrayFluxLabel(flux) {
    if (flux === null) return '—';
    if (flux >= 1e-4) return 'X' + (flux / 1e-4).toFixed(1);
    if (flux >= 1e-5) return 'M' + (flux / 1e-5).toFixed(1);
    if (flux >= 1e-6) return 'C' + (flux / 1e-6).toFixed(1);
    if (flux >= 1e-7) return 'B' + (flux / 1e-7).toFixed(1);
    return 'A' + (flux / 1e-8).toFixed(1);
  }

  function xrayBarPct(flux) {
    if (!flux || flux <= 0) return 0;
    const logMin = -8, logMax = -3;
    return Math.max(2, Math.min((Math.log10(flux) - logMin) / (logMax - logMin) * 100, 100));
  }

  function scaleColor(level) {
    if (!level || level === 0) return '#69F0AE';
    if (level === 1)           return '#FFCA28';
    if (level === 2)           return '#FF6D00';
    return '#FF1744';
  }

  function fmtFlareTime(date) {
    if (!date) return '—';
    const ageMins = Math.round((Date.now() - date.getTime()) / 60000);
    if (ageMins < 90) return `${ageMins}m ago`;
    const ageHrs = Math.round(ageMins / 60);
    if (ageHrs < 24) return `${ageHrs}h ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function flareRadioLabel(cls) {
    const letter = (cls ?? '')[0]?.toUpperCase();
    if (letter === 'X') return { label: 'Severe HF', color: '#FF1744' };
    if (letter === 'M') return { label: 'Major HF',  color: '#FF6D00' };
    if (letter === 'C') return { label: 'Minor HF',  color: '#FFCA28' };
    return null;
  }

  // ── Travel time estimate ─────────────────────────────────────────────
  // The solar wind we measure at L1 already arrived — it left the Sun ~(1AU / speed) ago.
  function solarWindTravelLabel(speedKms) {
    if (!speedKms || speedKms <= 0) return null;
    const travelHrs = AU_KM / speedKms / 3600;
    const hoursAgo  = Math.round(travelHrs);
    const arrivalHrs = Math.round(travelHrs - (Date.now() - Date.now()) / 3_600_000);
    return `Current particles left the Sun ≈${hoursAgo}h ago · ${Math.round(speedKms)} km/s`;
  }

  // ── Health data render ────────────────────────────────────────────────
  function renderHealth(data) {
    // X-ray
    if (xrayBarEl) {
      xrayBarEl.style.width      = `${xrayBarPct(data.xrayFlux)}%`;
      xrayBarEl.style.background = xrayColor(data.xrayClass);
    }
    if (xrayValEl) xrayValEl.textContent = xrayFluxLabel(data.xrayFlux);
    if (xrayClsEl) {
      xrayClsEl.textContent = data.xrayClass ?? 'B';
      xrayClsEl.style.color = xrayColor(data.xrayClass);
    }

    // Solar wind speed
    if (swSpeedEl) {
      swSpeedEl.textContent = data.solarWindSpeed !== null
        ? `${Math.round(data.solarWindSpeed)} km/s`
        : '—';
      swSpeedEl.style.color = (data.solarWindSpeed > 500) ? '#FF6D00' : 'var(--text-secondary)';
    }

    // IMF Bz
    if (bzEl) {
      const bz = data.bzNT;
      if (bz !== null) {
        const sign = bz >= 0 ? '+' : '';
        const dir  = bz < -5 ? ' ↓ SOUTH' : (bz > 5 ? ' ↑ NORTH' : '');
        bzEl.textContent = `${sign}${bz.toFixed(1)} nT${dir}`;
        bzEl.style.color = bz < -20 ? '#FF1744' : bz < -10 ? '#FF6D00' : bz < -5 ? '#FFCA28' : '#69F0AE';
      } else {
        bzEl.textContent = '—';
        bzEl.style.color = 'var(--text-secondary)';
      }
    }

    // Solar Flux Index
    if (sfiEl) {
      const sfi = data.sfi;
      if (sfi !== null) {
        sfiEl.textContent = `${Math.round(sfi)} sfu`;
        sfiEl.style.color = sfi > 200 ? '#FF1744' : sfi > 150 ? '#FF6D00' : sfi > 100 ? '#FFCA28' : '#69F0AE';
      } else {
        sfiEl.textContent = '—';
        sfiEl.style.color = 'var(--text-secondary)';
      }
    }

    // Recent flares
    if (flaresEl) {
      const flares = data.recentFlares ?? [];
      if (flares.length === 0) {
        flaresEl.innerHTML = '<span class="sun-flare-none">No C+ flares in past 7 days</span>';
      } else {
        flaresEl.innerHTML = flares.map(({ cls, beginTime, durationMin }) => {
          const letter   = cls[0]?.toUpperCase() ?? '?';
          const color    = xrayColor(letter);
          const radio    = flareRadioLabel(cls);
          const timeStr  = fmtFlareTime(beginTime);
          const durStr   = durationMin !== null ? `${durationMin}min` : '';
          const meta     = [timeStr, durStr].filter(Boolean).join(' · ');
          const radioHtml = radio
            ? `<span class="sun-flare-effect" style="color:${radio.color};border:1px solid ${radio.color}33;background:${radio.color}18">${radio.label}</span>`
            : '';
          return `<div class="sun-flare-item">
            <span class="sun-flare-cls" style="color:${color}">${cls}</span>
            <span class="sun-flare-meta">${meta}</span>
            ${radioHtml}
          </div>`;
        }).join('');
      }
    }

    // Earth impact summary (NOAA R/S/G)
    if (impactsEl) {
      const sc  = data.noaaScales ?? {};
      function scaleChip(badge, level, text) {
        const col = scaleColor(level);
        return `<span class="sun-scale-chip" style="color:${col};border-color:${col}40;background:${col}12">
          ${badge}${level} ${level > 0 ? text : 'Clear'}
        </span>`;
      }
      impactsEl.innerHTML = scaleChip('R', sc.R ?? 0, sc.RText ?? '')
                          + scaleChip('S', sc.S ?? 0, sc.SText ?? '')
                          + scaleChip('G', sc.G ?? 0, sc.GText ?? '');
    }

    // Solar wind travel time
    if (travelEl) {
      const label = solarWindTravelLabel(data.solarWindSpeed);
      travelEl.textContent = label ?? '';
      travelEl.style.display = label ? '' : 'none';
    }
  }

  // ── Public: refresh (called on weather update) ───────────────────────
  function refresh(data) {
    renderHealth(data);
  }

  // Hook into live weather updates
  spaceWeather.onUpdate(d => {
    if (isVisible()) renderHealth(d);
  });

  // ── Show / hide ──────────────────────────────────────────────────────
  function show() {
    panel.classList.add('visible');
    setTab(_activeTab);
    setSdo(_sdoKey);
    renderHealth(spaceWeather.getData());
  }

  function hide() {
    panel.classList.remove('visible');
    // Reset hologram button state (caller handles actual 3D hologram)
    if (_holoActive) {
      _holoActive = false;
      if (holoBtn) {
        holoBtn.classList.remove('active');
        holoBtn.textContent = 'VIEW REAL SIZE';
      }
      onViewRealSize?.(false);
    }
  }

  function toggle() {
    if (isVisible()) { hide(); return false; }
    show(); return true;
  }

  function isVisible() { return panel.classList.contains('visible'); }

  return { show, hide, toggle, isVisible, refresh };
}
