
import {
  HISTORY_EVENTS,
  EVENT_CATEGORIES,
  POPULATION_DATA,
} from '../data/history-events.js';

const CSS = `
#history-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 390px;
  height: 100dvh;
  background: rgba(4, 10, 24, 0.96);
  border-left: 1px solid rgba(79, 195, 247, 0.2);
  display: flex;
  flex-direction: column;
  z-index: 900;
  transform: translateX(100%);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-family: "SF Mono", "Courier New", monospace;
  color: #c9d6e3;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
#history-panel.open {
  transform: translateX(0);
}

.hp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px 10px;
  border-bottom: 1px solid rgba(79, 195, 247, 0.15);
  flex-shrink: 0;
}
.hp-title {
  font-size: 11px;
  letter-spacing: 0.18em;
  color: #4FC3F7;
  font-weight: 700;
}
.hp-close {
  background: none;
  border: 1px solid rgba(79, 195, 247, 0.3);
  color: #4FC3F7;
  width: 24px;
  height: 24px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
  padding: 0;
  transition: background 0.15s;
}
.hp-close:hover { background: rgba(79, 195, 247, 0.15); }

.hp-chart-section {
  padding: 12px 18px 6px;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(79, 195, 247, 0.1);
}
.hp-chart-label {
  font-size: 9px;
  letter-spacing: 0.12em;
  color: rgba(79, 195, 247, 0.6);
  margin-bottom: 6px;
  text-transform: uppercase;
}
#hp-chart-canvas {
  width: 100%;
  height: 110px;
  display: block;
  cursor: crosshair;
  border-radius: 3px;
}
.hp-chart-tooltip {
  font-size: 9px;
  color: rgba(201, 214, 227, 0.7);
  margin-top: 4px;
  min-height: 14px;
  letter-spacing: 0.05em;
}

.hp-year-bar {
  display: flex;
  justify-content: space-between;
  padding: 0 2px;
  margin-top: 3px;
}
.hp-year-bar span {
  font-size: 8px;
  color: rgba(79, 195, 247, 0.4);
  letter-spacing: 0.05em;
  user-select: none;
}

.hp-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  padding: 10px 18px;
  border-bottom: 1px solid rgba(79, 195, 247, 0.1);
  flex-shrink: 0;
}
.hp-filter-btn {
  font-family: inherit;
  font-size: 9px;
  letter-spacing: 0.1em;
  padding: 4px 9px;
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(201, 214, 227, 0.7);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.hp-filter-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #e8f4fd;
}
.hp-filter-btn.active {
  background: rgba(79, 195, 247, 0.15);
  border-color: #4FC3F7;
  color: #4FC3F7;
}

.hp-count {
  padding: 6px 18px 2px;
  font-size: 9px;
  color: rgba(201, 214, 227, 0.4);
  letter-spacing: 0.1em;
  flex-shrink: 0;
}

.hp-events {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 6px 12px 24px;
  scroll-behavior: smooth;
}
.hp-events::-webkit-scrollbar        { width: 4px; }
.hp-events::-webkit-scrollbar-track  { background: transparent; }
.hp-events::-webkit-scrollbar-thumb  { background: rgba(79, 195, 247, 0.2); border-radius: 2px; }

.hp-event-card {
  display: flex;
  flex-direction: column;
  padding: 9px 10px 9px 14px;
  margin-bottom: 5px;
  border-radius: 4px;
  border-left: 3px solid transparent;
  background: rgba(255, 255, 255, 0.04);
  cursor: pointer;
  transition: background 0.15s;
  position: relative;
}
.hp-event-card:hover {
  background: rgba(79, 195, 247, 0.08);
}
.hp-event-card.hp-expanded {
  background: rgba(79, 195, 247, 0.06);
}

.hp-event-top {
  display: flex;
  align-items: center;
  gap: 8px;
}
.hp-event-icon {
  font-size: 15px;
  flex-shrink: 0;
  line-height: 1;
}
.hp-event-meta {
  flex: 1;
  min-width: 0;
}
.hp-event-date {
  font-size: 9px;
  color: rgba(201, 214, 227, 0.45);
  letter-spacing: 0.08em;
  margin-bottom: 2px;
}
.hp-event-title {
  font-size: 11px;
  color: #d8eaf8;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hp-jump-btn {
  font-family: inherit;
  font-size: 8px;
  letter-spacing: 0.1em;
  padding: 3px 7px;
  border-radius: 2px;
  border: 1px solid rgba(255,255,255,0.2);
  background: rgba(255,255,255,0.05);
  color: rgba(201, 214, 227, 0.6);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
  white-space: nowrap;
}
.hp-jump-btn:hover {
  background: rgba(79, 195, 247, 0.18);
  border-color: #4FC3F7;
  color: #4FC3F7;
}

.hp-event-detail {
  margin-top: 7px;
  font-size: 10px;
  line-height: 1.6;
  color: rgba(201, 214, 227, 0.65);
  display: none;
  padding-right: 4px;
}
.hp-event-card.hp-expanded .hp-event-detail {
  display: block;
}

.hp-year-group {
  font-size: 9px;
  letter-spacing: 0.15em;
  color: rgba(79, 195, 247, 0.5);
  padding: 10px 4px 4px;
  margin-bottom: 2px;
  border-bottom: 1px solid rgba(79, 195, 247, 0.08);
}

.hp-now-badge {
  font-size: 9px;
  letter-spacing: 0.1em;
  color: #69F0AE;
  padding: 4px 18px 0;
  flex-shrink: 0;
}
`;

let cssInjected = false;
function injectCSS() {
  if (cssInjected) return;
  cssInjected = true;
  const style = document.createElement('style');
  style.id    = 'history-panel-styles';
  style.textContent = CSS;
  document.head.appendChild(style);
}

const CHART_YEARS = [1957, 1970, 1985, 2000, 2007, 2015, 2021, 2026];

function drawChart(canvas, cursorMs, state) {
  const dpr  = window.devicePixelRatio || 1;
  const w    = canvas.clientWidth  * dpr;
  const h    = canvas.clientHeight * dpr;

  if (canvas.width !== w || canvas.height !== h) {
    canvas.width  = w;
    canvas.height = h;
  }

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  const data    = POPULATION_DATA;
  const minYear = data[0].year;
  const maxYear = data[data.length - 1].year;
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
  debrisGrad.addColorStop(0,   'rgba(239, 83, 80, 0.35)');
  debrisGrad.addColorStop(1,   'rgba(239, 83, 80, 0.04)');
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
  totalGrad.addColorStop(0,   'rgba(79, 195, 247, 0.18)');
  totalGrad.addColorStop(1,   'rgba(79, 195, 247, 0.02)');
  ctx.fillStyle = totalGrad;
  ctx.fill();

  ctx.beginPath();
  data.forEach((d, i) => {
    const x = xOf(d.year), y = yOf(d.total);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = 'rgba(79, 195, 247, 0.75)';
  ctx.lineWidth   = 1.5 * dpr;
  ctx.stroke();

  ctx.beginPath();
  data.forEach((d, i) => {
    const x = xOf(d.year), y = yOf(d.active);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = 'rgba(105, 240, 174, 0.55)';
  ctx.lineWidth   = 1 * dpr;
  ctx.stroke();

  const spikes = [
    { year: 2007, label: 'Fengyun' },
    { year: 2009, label: 'Cosmos×Iridium' },
    { year: 2021, label: 'Russia ASAT' },
  ];
  spikes.forEach(sp => {
    const d = data.find(d => d.year === sp.year);
    if (!d) return;
    const x = xOf(d.year), y = yOf(d.total);
    ctx.beginPath();
    ctx.arc(x, y, 3 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = '#EF5350';
    ctx.fill();
  });

  ctx.font         = `${8 * dpr}px "SF Mono", monospace`;
  ctx.fillStyle    = 'rgba(79, 195, 247, 0.35)';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'bottom';
  CHART_YEARS.forEach(y => {
    const x = xOf(y);
    ctx.fillText(String(y), x, h - 1 * dpr);
    ctx.beginPath();
    ctx.moveTo(x, pad.t);
    ctx.lineTo(x, h - 10 * dpr);
    ctx.strokeStyle = 'rgba(79, 195, 247, 0.08)';
    ctx.lineWidth   = 0.5 * dpr;
    ctx.stroke();
  });

  if (state.hoveredX !== null) {
    ctx.beginPath();
    ctx.moveTo(state.hoveredX * dpr, pad.t);
    ctx.lineTo(state.hoveredX * dpr, h);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth   = 1 * dpr;
    ctx.stroke();
  }

  if (cursorMs !== null) {
    const curYear = new Date(cursorMs).getFullYear() + new Date(cursorMs).getMonth() / 12;
    const cx = xOf(curYear);
    const glowGrad = ctx.createLinearGradient(cx - 6 * dpr, 0, cx + 6 * dpr, 0);
    glowGrad.addColorStop(0,   'rgba(105, 240, 174, 0)');
    glowGrad.addColorStop(0.5, 'rgba(105, 240, 174, 0.35)');
    glowGrad.addColorStop(1,   'rgba(105, 240, 174, 0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(cx - 6 * dpr, pad.t, 12 * dpr, ch);

    ctx.beginPath();
    ctx.moveTo(cx, pad.t);
    ctx.lineTo(cx, h);
    ctx.strokeStyle = '#69F0AE';
    ctx.lineWidth   = 1.5 * dpr;
    ctx.stroke();
  }
}

export function createHistoryPanel({ onJumpToDate } = {}) {
  injectCSS();

  const panel = document.createElement('div');
  panel.id = 'history-panel';

  panel.innerHTML = `
    <div class="hp-header">
      <span class="hp-title">◈ SPACE HISTORY</span>
      <button class="hp-close" id="hp-close-btn" title="Close">✕</button>
    </div>
    <div class="hp-chart-section">
      <div class="hp-chart-label">Tracked objects in Earth orbit</div>
      <canvas id="hp-chart-canvas"></canvas>
      <div class="hp-chart-tooltip" id="hp-chart-tooltip">Hover chart to inspect year</div>
      <div class="hp-year-bar" id="hp-year-bar"></div>
    </div>
    <div class="hp-filters" id="hp-filters"></div>
    <div class="hp-count" id="hp-count"></div>
    <div class="hp-now-badge" id="hp-now-badge"></div>
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
    { cat: 'launch',       label: '🛰 LAUNCH' },
    { cat: 'debris',       label: '💥 DEBRIS' },
    { cat: 'astronomy',    label: '⭐ ASTRO' },
    { cat: 'interstellar', label: '🌠 INTERSTELLAR' },
    { cat: 'milestone',    label: '🏆 MILESTONE' },
  ];

  filterDefs.forEach(({ cat, label }) => {
    const btn = document.createElement('button');
    btn.className    = 'hp-filter-btn' + (cat === 'all' ? ' active' : '');
    btn.dataset.cat  = cat;
    btn.textContent  = label;
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
      `${d.year} — ${d.total.toLocaleString()} tracked objects · ` +
      `${d.active.toLocaleString()} active · ${d.debris.toLocaleString()} debris`;
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

    countEl.textContent = `${filtered.length} events`;
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

      const catColor = (EVENT_CATEGORIES[ev.category] || {}).color || '#888';
      const card     = document.createElement('div');
      card.className  = 'hp-event-card';
      card.style.borderLeftColor = catColor;

      const jumpMs   = new Date(ev.date + 'T12:00:00Z').getTime();
      const dateStr  = ev.date.slice(0, 10);

      card.innerHTML = `
        <div class="hp-event-top">
          <span class="hp-event-icon">${ev.icon}</span>
          <div class="hp-event-meta">
            <div class="hp-event-date">${dateStr}</div>
            <div class="hp-event-title">${ev.title}</div>
          </div>
          <button class="hp-jump-btn" title="Jump to this date">▶ GOTO</button>
        </div>
        <div class="hp-event-detail">${ev.detail}</div>
      `;

      card.addEventListener('click', e => {
        if (e.target.closest('.hp-jump-btn')) return;   // handled separately
        card.classList.toggle('hp-expanded');
      });

      card.querySelector('.hp-jump-btn').addEventListener('click', e => {
        e.stopPropagation();
        if (onJumpToDate) onJumpToDate(jumpMs);
      });

      eventsList.appendChild(card);
    });
  }

  function updateNowBadge(ms) {
    const d = new Date(ms);
    nowBadge.textContent =
      `NOW  ${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
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
  }

  function toggle() {
    if (panel.classList.contains('open')) hide(); else show();
  }

  function updateSimTime(ms) {
    currentSimMs = ms;
    updateNowBadge(ms);
    if (panel.classList.contains('open')) {
      drawChart(chartCanvas, currentSimMs, chartState);
    }
  }

  function isOpen() {
    return panel.classList.contains('open');
  }

  renderEvents();

  return { show, hide, toggle, updateSimTime, isOpen };
}
