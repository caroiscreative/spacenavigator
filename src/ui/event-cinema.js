
/**
 * Event Cinema v2 — non-intrusive bottom-left toast that appears on GOTO.
 * Shows event context, geographic region, and animation status.
 * Does NOT dim the scene — the 3D view stays fully visible.
 *
 * Usage:
 *   import { showEventCinema } from './event-cinema.js';
 *   showEventCinema(ev, {
 *     onReady:    ({ lat, lon, altKm }) => { ... fly camera ... },
 *     onComplete: ()                   => { simTime = ms; },
 *   });
 */

// ── Per-event geographic + display data ──────────────────────────────────────
// lat/lon: approximate center of the event (for camera orientation)
// altKm:   orbital altitude where the event occurred
// region:  human-readable location string
// anim:    whether the 3D scene can show something meaningful at this moment
const EVENT_META = {
  sputnik:         { lat:  51.6, lon:  63.3, altKm:  584, region: 'Kazakhstan · 584 km LEO',         anim: 'active' },
  sputnik2:        { lat:  51.6, lon:  63.3, altKm: 1660, region: 'Kazakhstan · 1,660 km LEO',       anim: 'active' },
  explorer1:       { lat:  28.5, lon: -80.6, altKm: 2531, region: 'Cape Canaveral · 2,531 km MEO',   anim: 'active' },
  gagarin:         { lat:  51.6, lon:  63.3, altKm:  169, region: 'Baikonur · 169 km VLEO',          anim: 'active' },
  telstar:         { lat:  44.5, lon: -69.8, altKm:  952, region: 'Maine, USA · 952 km LEO',          anim: 'active' },
  apollo11:        { lat:  28.5, lon: -80.6, altKm:    0, region: 'Earth–Moon trajectory',            anim: 'none'   },
  skylab:          { lat:  28.5, lon: -80.6, altKm:  435, region: 'Equatorial orbit · 435 km LEO',   anim: 'active' },
  kessler:         { lat:  37.8, lon:-122.4, altKm:    0, region: 'Theoretical — all LEO shells',    anim: 'density'},
  solwind:         { lat:  38.0, lon:-105.0, altKm:  555, region: 'US test · 555 km LEO',            anim: 'none'   },
  hubble:          { lat:  28.5, lon: -80.6, altKm:  547, region: 'Equatorial · 547 km LEO',         anim: 'active' },
  iss_start:       { lat:  51.6, lon:  66.0, altKm:  408, region: 'Baikonur · 408 km ISS orbit',     anim: 'active' },
  iss_habitation:  { lat:  51.6, lon:  66.0, altKm:  408, region: 'ISS orbit · 408 km LEO',          anim: 'active' },
  fengyun:         { lat:  25.0, lon:  98.0, altKm:  865, region: 'Central Asia · 865 km LEO',       anim: 'none'   },
  phoenix:         { lat:  68.2, lon:-125.7, altKm:    0, region: 'Mars — north polar region',       anim: 'none'   },
  cosmos_iridium:  { lat:  72.0, lon:  97.0, altKm:  789, region: 'Siberia · 789 km LEO',            anim: 'none'   },
  kepler:          { lat:  28.5, lon: -80.6, altKm:    0, region: 'Heliocentric orbit',              anim: 'none'   },
  dragon_1:        { lat:  51.6, lon: -66.0, altKm:  408, region: 'ISS orbit · 408 km LEO',          anim: 'active' },
  gwave:           { lat:  30.6, lon: -90.8, altKm:    0, region: 'LIGO, Louisiana USA',             anim: 'none'   },
  india_asat:      { lat:  13.9, lon:  80.2, altKm:  283, region: 'Bay of Bengal · 283 km VLEO',    anim: 'none'   },
  oumuamua:        { lat:   0.0, lon:   0.0, altKm:    0, region: 'Interstellar — Cygnus direction', anim: 'none'   },
  starlink:        { lat:  34.6, lon:-120.6, altKm:  550, region: 'Vandenberg · 550 km LEO',         anim: 'active' },
  russia_asat:     { lat:  62.0, lon:  40.0, altKm:  480, region: 'Northern Russia · 480 km LEO',   anim: 'none'   },
  jwst:            { lat:   5.0, lon: -52.5, altKm:    0, region: 'Kourou · L2 destination',         anim: 'none'   },
  borisov:         { lat:   0.0, lon:   0.0, altKm:    0, region: 'Interstellar — Perseus direction',anim: 'none'   },
};

// ── Animation status descriptions ─────────────────────────────────────────────
const ANIM_STATUS = {
  active:  'Satellites visible in 3D at this altitude',
  density: 'Open Density Map to see orbital shell concentration',
  none:    'Historical event — no live simulation available',
};

// ── Category colors ───────────────────────────────────────────────────────────
const CAT_COLOR = {
  launch:       'var(--blue)',
  debris:       'var(--red)',
  astronomy:    'var(--amber)',
  interstellar: 'var(--cyan)',
  milestone:    'var(--green)',
};
const CAT_LABEL = {
  launch:       'LAUNCH',
  debris:       'IMPACT EVENT',
  astronomy:    'DISCOVERY',
  interstellar: 'INTERSTELLAR',
  milestone:    'MILESTONE',
};

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
#event-cinema {
  position: fixed;
  bottom: 48px;      /* just above the HUD bar */
  left: var(--space-4);
  z-index: var(--z-modal);
  width: 340px;
  pointer-events: none;
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.3s linear, transform 0.3s ease-out;
}
#event-cinema.ec-visible {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.ec-card {
  background: var(--bg-panel-dense);
  border-top:    2px solid var(--ec-col, var(--cyan));
  border-left:   1px solid var(--ec-col, var(--cyan));
  border-right:  1px solid var(--border-dim);
  border-bottom: 1px solid var(--border-dim);
  position: relative;
}

/* Reticle corners */
.ec-corner {
  position: absolute;
  width: 8px; height: 8px;
  border-color: var(--ec-col, var(--cyan));
  border-style: solid;
  opacity: 0.45;
}
.ec-corner-tl { top: -1px; left: -1px;   border-width: 2px 0 0 2px; }
.ec-corner-tr { top: -1px; right: -1px;  border-width: 2px 2px 0 0; }
.ec-corner-bl { bottom: -1px; left: -1px;  border-width: 0 0 2px 2px; }
.ec-corner-br { bottom: -1px; right: -1px; border-width: 0 2px 2px 0; }

/* Top band: badge + date + skip */
.ec-card-top {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--border-dim);
}
.ec-badge {
  font-size: 10px;
  letter-spacing: 0.14em;
  padding: 1px 6px;
  border: 1px solid currentColor;
  color: var(--ec-col, var(--cyan));
  text-transform: uppercase;
  flex-shrink: 0;
}
.ec-date {
  font-size: var(--text-xs);
  color: var(--text-dim);
  letter-spacing: 0.08em;
  flex: 1;
  min-width: 0;
}
.ec-skip {
  background: transparent;
  border: none;
  color: var(--text-dim);
  font-family: var(--font);
  font-size: 10px;
  letter-spacing: 0.10em;
  padding: 2px 0;
  cursor: pointer;
  text-transform: uppercase;
  flex-shrink: 0;
  transition: color var(--t-fast);
}
.ec-skip:hover { color: var(--white-cold); }

/* Title */
.ec-title {
  padding: var(--space-3) var(--space-3) var(--space-2);
  font-size: 14px;
  font-weight: 400;
  color: var(--white-cold);
  letter-spacing: 0.03em;
  line-height: 1.3;
}

/* Info rows */
.ec-info-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: 4px var(--space-3);
  border-top: 1px solid var(--border-dim);
}
.ec-info-label {
  font-size: 10px;
  letter-spacing: 0.12em;
  color: var(--text-secondary);
  text-transform: uppercase;
  white-space: nowrap;
  flex-shrink: 0;
  padding-top: 1px;
  width: 60px;
}
.ec-info-value {
  font-size: var(--text-xs);
  color: var(--text-primary);
  letter-spacing: 0.03em;
  line-height: 1.45;
}
.ec-info-value.ec-anim-none  { color: var(--text-dim); font-style: italic; }
.ec-info-value.ec-anim-ok    { color: var(--green); }
.ec-info-value.ec-anim-hint  { color: var(--amber); }
`;

// ── State ─────────────────────────────────────────────────────────────────────
let _overlay     = null;
let _cssInjected = false;
let _timerId     = null;
let _cleanup     = null;

function _injectCSS() {
  if (_cssInjected) return;
  _cssInjected = true;
  const s = document.createElement('style');
  s.id = 'event-cinema-css';
  s.textContent = CSS;
  document.head.appendChild(s);
}

function _getOrCreate() {
  if (_overlay) return _overlay;

  _overlay = document.createElement('div');
  _overlay.id = 'event-cinema';
  _overlay.setAttribute('role', 'status');
  _overlay.setAttribute('aria-live', 'polite');
  _overlay.innerHTML = `
    <div class="ec-card">
      <span class="ec-corner ec-corner-tl" aria-hidden="true"></span>
      <span class="ec-corner ec-corner-tr" aria-hidden="true"></span>
      <span class="ec-corner ec-corner-bl" aria-hidden="true"></span>
      <span class="ec-corner ec-corner-br" aria-hidden="true"></span>
      <div class="ec-card-top">
        <span class="ec-badge" id="ec-badge"></span>
        <span class="ec-date"  id="ec-date"></span>
        <button class="ec-skip" id="ec-skip">SKIP ✕</button>
      </div>
      <div class="ec-title" id="ec-title"></div>
      <div class="ec-info-row">
        <span class="ec-info-label">REGION</span>
        <span class="ec-info-value" id="ec-region"></span>
      </div>
      <div class="ec-info-row">
        <span class="ec-info-label">3D VIEW</span>
        <span class="ec-info-value" id="ec-anim"></span>
      </div>
    </div>
  `;
  document.body.appendChild(_overlay);
  return _overlay;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Show the event toast.
 * @param {object} ev   - History event (id, title, date, category)
 * @param {object} opts
 * @param {function} opts.onReady    - Called with { lat, lon, altKm } immediately
 * @param {function} opts.onComplete - Called after 7s or on skip
 */
export function showEventCinema(ev, { onReady, onComplete } = {}) {
  _injectCSS();
  const overlay = _getOrCreate();

  _cancelRunning();

  const meta     = EVENT_META[ev.id] ?? { lat: 0, lon: 0, altKm: 400, region: 'Earth orbit', anim: 'active' };
  const color    = CAT_COLOR[ev.category]  ?? 'var(--cyan)';
  const badgeLbl = CAT_LABEL[ev.category]  ?? ev.category.toUpperCase();
  const animType = meta.anim ?? 'none';
  const animText = ANIM_STATUS[animType] ?? ANIM_STATUS.none;
  const animCls  = animType === 'active' ? 'ec-anim-ok' : animType === 'density' ? 'ec-anim-hint' : 'ec-anim-none';

  // Apply color to card
  overlay.querySelector('.ec-card').style.setProperty('--ec-col', color);

  // Fill content
  const badge = overlay.querySelector('#ec-badge');
  badge.textContent   = badgeLbl;
  badge.style.color   = color;

  overlay.querySelector('#ec-date').textContent   = ev.date ?? '';
  overlay.querySelector('#ec-title').textContent  = ev.title ?? '';
  overlay.querySelector('#ec-region').textContent = meta.region;

  const animEl = overlay.querySelector('#ec-anim');
  animEl.textContent = animText;
  animEl.className   = `ec-info-value ${animCls}`;

  // Notify caller → camera fly + optional satellite selection
  onReady?.({ lat: meta.lat, lon: meta.lon, altKm: meta.altKm, anim: animType });

  // Show
  overlay.classList.add('ec-visible');

  // ESC key
  function onKeyDown(e) {
    if (e.key === 'Escape') { document.removeEventListener('keydown', onKeyDown); finish(); }
  }
  document.addEventListener('keydown', onKeyDown);

  // Skip button
  overlay.querySelector('#ec-skip').addEventListener('click', finish, { once: true });

  function finish() {
    _cancelRunning();
    document.removeEventListener('keydown', onKeyDown);
    overlay.classList.remove('ec-visible');
    onComplete?.();
  }

  _cleanup = finish;
  _timerId = setTimeout(finish, 7000);
}

function _cancelRunning() {
  clearTimeout(_timerId);
  _timerId = null;
}

/** Imperatively hide (e.g. if user navigates elsewhere) */
export function hideEventCinema() {
  _cleanup?.();
  _cleanup = null;
  _overlay?.classList.remove('ec-visible');
  _cancelRunning();
}
