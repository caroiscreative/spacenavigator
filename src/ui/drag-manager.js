
const TOOL_STORAGE_KEY = 'sn_panel_pos_v4';  // v4 — clears old left-side positions
const PANEL_WIDTH      = 300;                 // px — uniform panel width
const DOCK_ID          = 'panel-dock';
const MARGIN           = 8;                   // min px from viewport edges (floated panels)

const INFO_PANEL_IDS = new Set([
  'sat-panel', 'planet-panel', 'dso-panel', 'sun-panel',
]);

const FLOAT_ONLY_IDS = new Set(['time-panel', 'explorer-panel']);

const PANEL_CONFIGS = [
  { id: 'sat-panel',      handleSel: '#sat-panel-header',          visibleWhen: el => !el.classList.contains('hidden') },
  { id: 'planet-panel',   handleSel: '#planet-panel .planet-name', visibleWhen: el => !el.classList.contains('hidden') },
  { id: 'dso-panel',      handleSel: '#dso-panel-header',          visibleWhen: el => el.classList.contains('visible') },
  { id: 'sun-panel',      handleSel: '#sun-panel-header',          visibleWhen: el => el.classList.contains('visible') },
  { id: 'explorer-panel', handleSel: '#explorer-header',           visibleWhen: el => el.classList.contains('visible') },
  { id: 'intl-panel',     handleSel: '#intl-panel-header',         visibleWhen: el => !el.classList.contains('hidden') },
  { id: 'risk-panel',     handleSel: '#risk-panel-header',         visibleWhen: el => el.classList.contains('visible') },
  { id: 'conj-detail',    handleSel: '#conj-detail .cd-header',    visibleWhen: el => el.classList.contains('visible') },
  { id: 'weather-panel',  handleSel: '#weather-panel-header',      visibleWhen: el => el.classList.contains('visible') },
  { id: 'heat-explainer', handleSel: '#heat-explainer-header',     visibleWhen: el => el.classList.contains('visible') },
  { id: 'time-panel',     handleSel: '#tp-header',                 visibleWhen: el => el.classList.contains('visible') },
];

function loadToolPositions() {
  try { return JSON.parse(localStorage.getItem(TOOL_STORAGE_KEY) || '{}'); }
  catch { return {}; }
}

function saveToolPosition(id, left, top) {
  const all = loadToolPositions();
  all[id] = { left, top };
  try { localStorage.setItem(TOOL_STORAGE_KEY, JSON.stringify(all)); }
  catch {  }
}

const sessionDragPos = {};

let _dock = null;

function getDock() {
  if (!_dock) _dock = document.getElementById(DOCK_ID);
  return _dock;
}

function moveIntoDock(panel) {
  const d = getDock();
  if (!d) return;

  panel.style.position  = 'relative';
  panel.style.left      = 'auto';
  panel.style.top       = 'auto';
  panel.style.right     = 'auto';
  panel.style.bottom    = 'auto';
  panel.style.transform = 'none';
  panel.style.width     = '100%';
  panel.style.zIndex    = '';

  if (panel.parentElement === d) return; // already in dock; styles updated above

  const myIdx = PANEL_CONFIGS.findIndex(c => c.id === panel.id);
  let inserted = false;
  for (const child of Array.from(d.children)) {
    const childIdx = PANEL_CONFIGS.findIndex(c => c.id === child.id);
    if (childIdx > myIdx) {
      d.insertBefore(panel, child);
      inserted = true;
      break;
    }
  }
  if (!inserted) d.appendChild(panel);
}

function detachToFloat(panel, screenLeft, screenTop) {
  const d = getDock();
  if (d && panel.parentElement === d) {
    document.body.appendChild(panel);
  }
  panel.style.position  = 'fixed';
  panel.style.width     = PANEL_WIDTH + 'px';
  panel.style.transform = 'none';
  applyPosition(panel, screenLeft, screenTop);
}

function isInDock(panel) {
  const d = getDock();
  return !!d && panel.parentElement === d;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function applyPosition(el, left, top) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w  = el.offsetWidth  || PANEL_WIDTH;
  const h  = el.offsetHeight || 120;

  left = clamp(left, MARGIN, vw - w - MARGIN);
  top  = clamp(top,  MARGIN, vh - Math.min(h, 60) - MARGIN);

  el.style.left   = left + 'px';
  el.style.top    = top  + 'px';
  el.style.right  = 'auto';
  el.style.bottom = 'auto';
}

function attachDrag(config, panel) {
  const handle = document.querySelector(config.handleSel);
  if (!handle) return () => {};

  let dragging = false;
  let startX, startY, startLeft, startTop;

  function onMouseDown(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = panel.getBoundingClientRect();

    if (isInDock(panel)) {
      detachToFloat(panel, rect.left, rect.top);
    }

    dragging = true;
    handle.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';

    startLeft = panel.getBoundingClientRect().left;
    startTop  = panel.getBoundingClientRect().top;
    startX    = e.clientX;
    startY    = e.clientY;

    panel.style.zIndex = '500';

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',   onMouseUp);
  }

  function onMouseMove(e) {
    if (!dragging) return;
    applyPosition(
      panel,
      startLeft + (e.clientX - startX),
      startTop  + (e.clientY - startY),
    );
  }

  function onMouseUp() {
    if (!dragging) return;
    dragging = false;
    handle.style.cursor = '';
    document.body.style.userSelect = '';
    panel.style.zIndex = '';

    const rect = panel.getBoundingClientRect();
    sessionDragPos[config.id] = { left: rect.left, top: rect.top };

    if (!INFO_PANEL_IDS.has(config.id) && !FLOAT_ONLY_IDS.has(config.id)) {
      saveToolPosition(config.id, rect.left, rect.top);
    }

    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup',   onMouseUp);
  }

  handle.addEventListener('mousedown', onMouseDown);

  return function cleanup() {
    handle.removeEventListener('mousedown', onMouseDown);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup',   onMouseUp);
  };
}

export function initDragManager() {
  const toolPositions = loadToolPositions();

  PANEL_CONFIGS.forEach(config => {
    const panel = document.getElementById(config.id);
    if (!panel) return;

    let cleanupDrag = null;

    function onPanelBecameVisible() {
      if (cleanupDrag) cleanupDrag();

      requestAnimationFrame(() => {
        const isFloat = FLOAT_ONLY_IDS.has(config.id);
        const isInfo  = INFO_PANEL_IDS.has(config.id);

        if (isFloat) {
          cleanupDrag = attachDrag(config, panel);
          return;
        }

        const saved = sessionDragPos[config.id] ?? toolPositions[config.id];

        if (!isInfo && saved) {
          detachToFloat(panel, saved.left, saved.top);
        } else {
          moveIntoDock(panel);
        }

        cleanupDrag = attachDrag(config, panel);
      });
    }

    function onPanelBecameHidden() {
      if (INFO_PANEL_IDS.has(config.id)) {
        delete sessionDragPos[config.id];
        moveIntoDock(panel);
      }
      if (cleanupDrag) { cleanupDrag(); cleanupDrag = null; }
    }

    const observer = new MutationObserver(() => {
      if (config.visibleWhen(panel)) {
        onPanelBecameVisible();
      } else {
        onPanelBecameHidden();
      }
    });

    observer.observe(panel, { attributes: true, attributeFilter: ['class'] });

    if (config.visibleWhen(panel)) onPanelBecameVisible();
  });
}

export function resetPanelPosition(id) {
  delete sessionDragPos[id];
  const all = loadToolPositions();
  delete all[id];
  try { localStorage.setItem(TOOL_STORAGE_KEY, JSON.stringify(all)); }
  catch {  }
}

export function resetAllPanelPositions() {
  Object.keys(sessionDragPos).forEach(k => delete sessionDragPos[k]);
  try { localStorage.removeItem(TOOL_STORAGE_KEY); }
  catch {  }
}
