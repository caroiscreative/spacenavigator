
import {
  HISTORY_EVENTS,
  POPULATION_DATA,
} from '../data/history-events.js';

const CAT_COLOR = {
  launch:       'var(--blue)',
  debris:       'var(--red)',
  astronomy:    'var(--amber)',
  interstellar: 'var(--cyan)',
  milestone:    'var(--green)',
};

const CSS = `
#history-panel {
  position: fixed;
  top: 0; right: 0;
  width: 390px;
  height: 100dvh;
  background: var(--bg-panel-dense);
  border-left: 1px solid var(--border-normal);
  display: flex;
  flex-direction: column;
  z-index: 900;
  font-family: var(--font);
  color: var(--text-primary);
  transform: translateX(100%);
  transition: transform 300ms linear;
}
#history-panel.open { transform: translateX(0); }

.hp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 10px;
  border-bottom: 1px solid var(--border-dim);
  flex-shrink: 0;
}
.hp-title {
  font-size: var(--text-xs);
  letter-spacing: 0.10em;
  color: var(--text-accent);
  font-weight: 700;
  text-transform: uppercase;
}
.hp-close {
  background: transparent;
  border: 1px solid var(--border-dim);
  color: var(--text-dim);
  width: 20px; height: 20px;
  cursor: pointer;
  font-size: 11px;
  line-height: 1;
  padding: 0;
  font-family: var(--font);
  transition: color var(--t-fast), border-color var(--t-fast);
}
.hp-close:hover { color: var(--red); border-color: var(--border-danger); }

.hp-chart-section {
  padding: 10px 16px 8px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border-dim);
}
.hp-chart-label {
  font-size: var(--text-xs);
  letter-spacing: 0.12em;
  color: var(--text-secondary);
  margin-bottom: 6px;
  text-transform: uppercase;
}
#hp-chart-canvas {
  width: 100%;
  height: 110px;
  display: block;
  cursor: crosshair;
}
.hp-chart-tooltip {
  font-size: var(--text-xs);
  color: var(--text-dim);
  margin-top: 4px;
  min-height: 14px;
  letter-spacing: 0.05em;
}

.hp-filters {
  display: flex;
  flex-wrap: wrap;
  border-bottom: 1px solid var(--border-dim);
  flex-shrink: 0;
}
.hp-filter-btn {
  font-family: var(--font);
  font-size: var(--text-xs);
  letter-spacing: 0.10em;
  padding: 7px 10px;
  border: none;
  border-right: 1px solid var(--border-dim);
  background: transparent;
  color: var(--text-dim);
  cursor: pointer;
  text-transform: uppercase;
  transition: color var(--t-fast), background var(--t-fast);
  white-space: nowrap;
}
.hp-filter-btn:last-child { border-right: none; }
.hp-filter-btn:hover  { color: var(--text-secondary); }
.hp-filter-btn.active { color: var(--cyan); background: rgba(0,212,255,0.08); }

.hp-meta-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 16px;
  border-bottom: 1px solid var(--border-dim);
  flex-shrink: 0;
}
.hp-count {
  font-size: var(--text-xs);
  color: var(--text-dim);
  letter-spacing: 0.10em;
}
.hp-now-badge {
  font-size: var(--text-xs);
  letter-spacing: 0.10em;
  color: var(--green);
}

.hp-events {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 0 24px;
  scroll-behavior: smooth;
}
.hp-events::-webkit-scrollbar       { width: 3px; }
.hp-events::-webkit-scrollbar-track { background: transparent; }
.hp-events::-webkit-scrollbar-thumb { background: var(--border-dim); }

.hp-event-card {
  display: flex;
  flex-direction: column;
  padding: 7px 12px 7px 14px;
  border-left: 2px solid transparent;
  background: transparent;
  cursor: pointer;
  transition: background var(--t-fast);
  border-bottom: 1px solid var(--border-dim);
}
.hp-event-card:hover      { background: var(--bg-row-hover); }
.hp-event-card.hp-expanded { background: rgba(0,212,255,0.04); }

.hp-event-top {
  display: flex;
  align-items: center;
  gap: 8px;
}
.hp-event-meta { flex: 1; min-width: 0; }
.hp-event-date {
  font-size: var(--text-xs);
  color: var(--text-dim);
  letter-spacing: 0.08em;
  margin-bottom: 2px;
}
.hp-event-title {
  font-size: var(--text-xs);
  color: var(--text-primary);
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hp-impact-btn {
  font-family: var(--font);
  font-size: var(--text-xs);
  letter-spacing: 0.10em;
  padding: 2px 6px;
  border: 1px solid var(--border-danger);
  background: rgba(255,68,85,0.08);
  color: var(--red);
  cursor: pointer;
  flex-shrink: 0;
  text-transform: uppercase;
  transition: background var(--t-fast);
  white-space: nowrap;
}
.hp-impact-btn:hover { background: rgba(255,68,85,0.18); }

.hp-event-detail {
  margin-top: 6px;
  font-size: var(--text-xs);
  line-height: 1.65;
  color: var(--text-secondary);
  display: none;
  padding-right: 4px;
  letter-spacing: 0.03em;
}
.hp-event-card.hp-expanded .hp-event-detail { display: block; }

.hp-year-group {
  font-size: var(--text-xs);
  letter-spacing: 0.15em;
  color: var(--text-secondary);
  padding: 10px 16px 4px;
  margin-bottom: 0;
  border-bottom: 1px solid var(--border-dim);
  text-transform: uppercase;
}
`;

let cssInjected = false;
function injectCSS() {
  if (cssInjected) return;
  cssInjected = true;
  const style = document.createElement('style');
  style.id = 'history-panel-styles';
  style.textContent = CSS;
  document.head.appendChild(style);
}

const CHART_YEARS = [1957, 1970, 1985, 2000, 2007, 2015, 2021, 2026];

function drawChart(canvas, cursorMs, state) {
  const dpr = window.devicePixelRatio || 1;
  const w   = canvas.clientWidth  * dpr;
  const h   = canvas.clientHeight * dpr;
  if (!w || !h) return;

  if (canvas.width !== w || canvas.height !== h) {
    canvas.width  = w;
    canvas.height = h;
  }

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  const data     = POPULATION_DATA;
  const minYear  = data[0].year;
  const maxYear  = data[data.length - 1].year;
  const maxTotal = data[data.length - 1].total * 1.05;

  const pad = { l: 0, r: 0, t: 6, b: 2 };
  const cw  = w - pad.l - pad.r;
  const ch  = h - pad.t - pad.b;

  function xOf(year)  { return pad.l + ((year - minYear) / (maxYear - minYear)) * cw; }
  function yOf(count) { return pad.t + ch - (count / maxTotal) * ch; }

  ctx.beginPath();
  data.forEach((d, i) => {
    const x = xOf(d.year), y = yOf(d.debris);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.lineTo(xOf(data[data.length - 1].year), h);
  ctx.lineTo(xOf(data[0].year), h);
  ctx.closePath();
  const debrisGrad = ctx.createLinearGradient(0, 0, 0, h);
  debrisGrad.addColorStop(0, 'rgba(255,68,85,0.30)');
  debrisGrad.addColorStop(1, 'rgba(255,68,85,0.03)');
  ctx.fillStyle = debrisGrad;
  ctx.fill();

  ctx.beginPath();
  data.forEach((d, i) => {
    const x = xOf(d.year), y = yOf(d.total);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.lineTo(xOf(data[data.length - 1].year), h);
  ctx.lineTo(xOf(data[0].year), h);
  ctx.closePath();
  const totalGrad = ctx.createLinearGradient(0, 0, 0, h);
  totalGrad.addColorStop(0, 'rgba(79,195,247,0.15)');
  totalGrad.addColorStop(1, 'rgba(79,195,247,0.02)');
  ctx.fillStyle = totalGrad;
  ctx.fill();

  ctx.beginPath();
  data.forEach((d, i) => {
    const x = xOf(d.year), y = yOf(d.total);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = 'rgba(79,195,247,0.75)';
  ctx.lineWidth   = 1.5 * dpr;
  ctx.stroke();

  ctx.beginPath();
  data.forEach((d, i) => {
    const x = xOf(d.year), y = yOf(d.active);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = 'rgba(0,255,136,0.50)';
  ctx.lineWidth   = 1 * dpr;
  ctx.stroke();

  [2007, 2009, 2021].forEach(yr => {
    const d = data.find(d => d.year === yr);
    if (!d) return;
    const x = xOf(d.year), y = yOf(d.total);
    ctx.beginPath();
    ctx.arc(x, y, 3 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = '#FF4455';
    ctx.fill();
  });

  ctx.font         = `${8 * dpr}px "Courier New", monospace`;
  ctx.fillStyle    = 'rgba(79,195,247,0.30)';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'bottom';
  CHART_YEARS.forEach(y => {
    const x = xOf(y);
    ctx.fillText(String(y), x, h - 1 * dpr);
    ctx.beginPath();
    ctx.moveTo(x, pad.t);
    ctx.lineTo(x, h - 10 * dpr);
    ctx.strokeStyle = 'rgba(79,195,247,0.07)';
    ctx.lineWidth   = 0.5 * dpr;
    ctx.stroke();
  });

  if (state.hoveredX !== null) {
    ctx.beginPath();
    ctx.moveTo(state.hoveredX * dpr, pad.t);
    ctx.lineTo(state.hoveredX * dpr, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth   = 1 * dpr;
    ctx.stroke();
  }

  if (cursorMs !== null) {
    const curYear = new Date(cursorMs).getFullYear() + new Date(cursorMs).getMonth() / 12;
    const cx = xOf(curYear);
    ctx.beginPath();
    ctx.moveTo(cx, pad.t);
    ctx.lineTo(cx, h);
    ctx.strokeStyle = 'rgba(0,255,136,0.60)';
    ctx.lineWidth   = 1.5 * dpr;
    ctx.stroke();
  }
}

export function createHistoryPanel({ onJumpToDate, onGotoEvent, onDebrisEvent, onClose } = {}) {
  injectCSS();

  const panel = document.createElement('div');
  panel.id = 'history-panel';

  panel.innerHTML = `
    <div class="hp-header">
      <span class="hp-title">Space History</span>
      <button class="hp-close" id="hp-close-btn" title="Close">✕</button>
    </div>
    <div class="hp-chart-section">
      <div class="hp-chart-label">Tracked objects in Earth orbit</div>
      <canvas id="hp-chart-canvas"></canvas>
      <div class="hp-chart-tooltip" id="hp-chart-tooltip">Hover chart to inspect year</div>
    </div>
    <div class="hp-filters" id="hp-filters"></div>
    <div class="hp-meta-bar">
      <span class="hp-count" id="hp-count"></span>
      <span class="hp-now-badge" id="hp-now-badge"></span>
    </div>
    <div class="hp-events" id="hp-events-list"></div>
  `;

  document.body.appendChild(panel);

  const chartCanvas  = panel.querySelector('#hp-chart-canvas');
  const chartTooltip = panel.querySelector('#hp-chart-tooltip');
  const filterBar    = panel.querySelector('#hp-filters');
  const countEl      = panel.querySelector('#hp-count');
  const nowBadge     = panel.querySelector('#hp-now-badge');
  const eventsList   = panel.querySelector('#hp-events-list');

  let currentSimMs   = Date.now();
  let activeCategory = 'all';
  let chartState     = { hoveredX: null };

  panel.querySelector('#hp-close-btn').addEventListener('click', () => hide());

  const filterDefs = [
    { cat: 'all',          label: 'ALL' },
    { cat: 'launch',       label: 'LAUNCH' },
    { cat: 'debris',       label: 'DEBRIS' },
    { cat: 'astronomy',    label: 'ASTRO' },
    { cat: 'interstellar', label: 'INTERSTELLAR' },
    { cat: 'milestone',    label: 'MILESTONE' },
  ];

  filterDefs.forEach(({ cat, label }) => {
    const btn = document.createElement('button');
    btn.className   = 'hp-filter-btn' + (cat === 'all' ? ' active' : '');
    btn.dataset.cat = cat;
    btn.textContent = label;
    btn.addEventListener('click', () => {
      activeCategory = cat;
      filterBar.querySelectorAll('.hp-filter-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.cat === cat));
      renderEvents();
    });
    filterBar.appendChild(btn);
  });

  function chartYearAtX(clientX) {
    const rect    = chartCanvas.getBoundingClientRect();
    const frac    = (clientX - rect.left) / rect.width;
    const minYear = POPULATION_DATA[0].year;
    const maxYear = POPULATION_DATA[POPULATION_DATA.length - 1].year;
    return minYear + frac * (maxYear - minYear);
  }

  function nearestDataPoint(year) {
    return POPULATION_DATA.reduce((best, d) =>
      Math.abs(d.year - year) < Math.abs(best.year - year) ? d : best
    );
  }

  chartCanvas.addEventListener('mousemove', e => {
    const rect = chartCanvas.getBoundingClientRect();
    chartState.hoveredX = e.clientX - rect.left;
    const year = chartYearAtX(e.clientX);
    const d    = nearestDataPoint(year);
    chartTooltip.textContent =
      `${d.year}  —  ${d.total.toLocaleString()} total  ·  ${d.active.toLocaleString()} active  ·  ${d.debris.toLocaleString()} debris`;
    drawChart(chartCanvas, currentSimMs, chartState);
  });

  chartCanvas.addEventListener('mouseleave', () => {
    chartState.hoveredX = null;
    chartTooltip.textContent = 'Hover chart to inspect year';
    drawChart(chartCanvas, currentSimMs, chartState);
  });

  chartCanvas.addEventListener('click', e => {
    const year   = chartYearAtX(e.clientX);
    const jumpMs = new Date(`${Math.round(year)}-07-01T00:00:00Z`).getTime();
    if (onJumpToDate) onJumpToDate(jumpMs);
  });

  function renderEvents() {
    const filtered = activeCategory === 'all'
      ? HISTORY_EVENTS
      : HISTORY_EVENTS.filter(ev => ev.category === activeCategory);

    countEl.textContent = `${filtered.length} EVENTS`;
    eventsList.innerHTML = '';

    let lastYear = null;

    filtered.forEach(ev => {
      if (ev.year !== lastYear) {
        lastYear = ev.year;
        const groupEl = document.createElement('div');
        groupEl.className   = 'hp-year-group';
        groupEl.textContent = String(ev.year);
        eventsList.appendChild(groupEl);
      }

      const catColor = CAT_COLOR[ev.category] || 'var(--text-dim)';
      const card     = document.createElement('div');
      card.className  = 'hp-event-card';
      card.style.borderLeftColor = catColor;

      const jumpMs  = new Date(ev.date + 'T12:00:00Z').getTime();
      const dateStr = ev.date.slice(0, 10);

      const impactBtn = ev.category === 'debris'
        ? `<button class="hp-impact-btn" title="Orbital impact analysis">IMPACT</button>`
        : '';

      card.innerHTML = `
        <div class="hp-event-top">
          <div class="hp-event-meta">
            <div class="hp-event-date">${dateStr}</div>
            <div class="hp-event-title">${ev.title}</div>
          </div>
          ${impactBtn}
        </div>
        <div class="hp-event-detail">${ev.detail}</div>
      `;

      card.addEventListener('click', e => {
        if (e.target.closest('.hp-impact-btn')) return;
        card.classList.toggle('hp-expanded');
      });

      card.querySelector('.hp-impact-btn')?.addEventListener('click', e => {
        e.stopPropagation();
        onDebrisEvent?.(ev);
      });

      eventsList.appendChild(card);
    });
  }

  function updateNowBadge(ms) {
    const d  = new Date(ms);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dy = String(d.getDate()).padStart(2, '0');
    nowBadge.textContent = `SIM  ${yr}-${mo}-${dy}`;
  }

  const ro = new ResizeObserver(() => {
    drawChart(chartCanvas, currentSimMs, chartState);
  });

  function show() {
    panel.classList.add('open');
    renderEvents();
    drawChart(chartCanvas, currentSimMs, chartState);
    ro.observe(chartCanvas);
  }

  function hide() {
    panel.classList.remove('open');
    ro.disconnect();
    onClose?.();
  }

  function toggle() {
    if (panel.classList.contains('open')) { hide(); return false; }
    show(); return true;
  }

  function updateSimTime(ms) {
    currentSimMs = ms;
    updateNowBadge(ms);
    if (panel.classList.contains('open')) {
      drawChart(chartCanvas, currentSimMs, chartState);
    }
  }

  function isOpen() { return panel.classList.contains('open'); }

  renderEvents();
  return { show, hide, toggle, updateSimTime, isOpen };
}
