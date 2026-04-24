
const HALF_WINDOW_MS  = 7 * 24 * 3600 * 1000;   // 7 days each side
const SLIDER_STEPS    = 100_000;                  // range input resolution
const UPDATE_INTERVAL = 80;                        // ms between display refreshes

function fmtUTC(ms) {
  return new Date(ms).toISOString()
    .replace('T', '  ')
    .replace(/\.\d+Z$/, '  UTC');
}

function fmtShort(ms) {
  return new Date(ms).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
}

export function createTimeControls({ getTime, setTime }) {
  const panel      = document.getElementById('time-panel');
  const dateEl     = document.getElementById('tp-date');
  const slider     = document.getElementById('tp-slider');
  const rangeMinEl = document.getElementById('tp-range-min');
  const rangeMaxEl = document.getElementById('tp-range-max');
  const nowBtn     = document.getElementById('tp-now-btn');
  const closeBtn   = document.getElementById('tp-close-btn');

  if (!panel || !slider) {
    console.warn('[TimeControls] DOM elements not found');
    return { update: () => {}, show: () => {}, hide: () => {}, toggle: () => false,
             isVisible: () => false, jumpTo: () => {} };
  }

  let visible    = false;
  let dragging   = false;
  let anchor     = Date.now();           // centre of the scrubber window
  let lastUpdate = 0;

  function windowMin() { return anchor - HALF_WINDOW_MS; }
  function windowMax() { return anchor + HALF_WINDOW_MS; }

  function updateRangeLabels() {
    if (rangeMinEl) rangeMinEl.textContent = fmtShort(windowMin());
    if (rangeMaxEl) rangeMaxEl.textContent = fmtShort(windowMax());
  }

  function timeToSlider(t) {
    const ratio = (t - windowMin()) / (HALF_WINDOW_MS * 2);
    return Math.round(Math.max(0, Math.min(1, ratio)) * SLIDER_STEPS);
  }

  function sliderToTime(v) {
    return windowMin() + (v / SLIDER_STEPS) * HALF_WINDOW_MS * 2;
  }

  slider.addEventListener('mousedown',  () => { dragging = true; });
  slider.addEventListener('touchstart', () => { dragging = true; }, { passive: true });
  slider.addEventListener('mouseup',    () => { dragging = false; });
  slider.addEventListener('touchend',   () => { dragging = false; });

  slider.addEventListener('input', () => {
    const t = sliderToTime(parseInt(slider.value, 10));
    setTime(t);
    if (dateEl) dateEl.textContent = fmtUTC(t);
  });

  nowBtn?.addEventListener('click', () => {
    jumpTo(Date.now());
  });

  closeBtn?.addEventListener('click', hide);

  window.addEventListener('jump-to-time', e => {
    jumpTo(e.detail);
    if (!visible) show();
  });

  function jumpTo(epochMs) {
    anchor = epochMs;                   // re-centre window on target
    setTime(epochMs);
    updateRangeLabels();
    slider.value = SLIDER_STEPS / 2;   // thumb to centre
    if (dateEl) dateEl.textContent = fmtUTC(epochMs);
  }

  function update() {
    if (!visible) return;
    const now = performance.now();
    if (now - lastUpdate < UPDATE_INTERVAL) return;
    lastUpdate = now;

    const t = getTime();
    if (dateEl) dateEl.textContent = fmtUTC(t);

    if (!dragging) {
      const dist = Math.abs(t - anchor);
      if (dist > HALF_WINDOW_MS * 0.80) {
        anchor = t;
        updateRangeLabels();
      }
      slider.value = timeToSlider(t);
    }
  }

  function show() {
    anchor = getTime();   // centre on current simTime when opening
    updateRangeLabels();
    slider.value = SLIDER_STEPS / 2;
    if (dateEl) dateEl.textContent = fmtUTC(getTime());
    panel.classList.add('visible');
    visible = true;
  }

  function hide() {
    panel.classList.remove('visible');
    visible = false;
  }

  function toggle() {
    visible ? hide() : show();
    return visible;
  }

  function isVisible() { return visible; }

  console.log('[TimeControls] Time scrubber panel created (±7 day window)');
  return { update, show, hide, toggle, isVisible, jumpTo };
}
