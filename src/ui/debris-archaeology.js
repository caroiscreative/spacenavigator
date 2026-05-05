
import { POPULATION_DATA, getPopulationAt } from '../data/history-events.js';

// Curated fragment distribution data per debris event
// shells: altitude (km) → approx % of fragments at that band
const DEBRIS_META = {
  solwind: {
    altitudeKm: 555, trackedFragments: 285, totalEstimated: 285, decayYears: 15,
    note: 'Low altitude meant rapid orbital decay — most fragments reentered by ~2000. A cautionary early data point for ASAT tests.',
    shells: [
      { alt: 500, pct: 18 },
      { alt: 550, pct: 42 },
      { alt: 600, pct: 28 },
      { alt: 650, pct: 12 },
    ],
  },
  fengyun: {
    altitudeKm: 865, trackedFragments: 3500, totalEstimated: 150000, decayYears: 100,
    note: 'The single largest debris-creation event in history. Fragments span 400–3,500 km. At 865 km, most will remain in orbit for over a century.',
    shells: [
      { alt: 700, pct: 8  },
      { alt: 750, pct: 14 },
      { alt: 800, pct: 22 },
      { alt: 850, pct: 30 },
      { alt: 900, pct: 16 },
      { alt: 950, pct: 7  },
      { alt: 1050, pct: 3 },
    ],
  },
  cosmos_iridium: {
    altitudeKm: 789, trackedFragments: 2300, totalEstimated: 2300, decayYears: 80,
    note: 'The first accidental satellite collision. Debris concentrated 700–900 km intersects the ISS orbital plane daily. A watershed moment that made orbital congestion undeniable.',
    shells: [
      { alt: 650, pct: 8  },
      { alt: 750, pct: 28 },
      { alt: 800, pct: 35 },
      { alt: 850, pct: 18 },
      { alt: 950, pct: 11 },
    ],
  },
  india_asat: {
    altitudeKm: 283, trackedFragments: 400, totalEstimated: 6500, decayYears: 1,
    note: '90% of debris reentered within weeks due to low altitude. 24 tracked pieces temporarily threatened the ISS. Demonstrates a fourth nation\'s ASAT capability.',
    shells: [
      { alt: 250, pct: 30 },
      { alt: 300, pct: 45 },
      { alt: 350, pct: 18 },
      { alt: 400, pct: 7  },
    ],
  },
  russia_asat: {
    altitudeKm: 480, trackedFragments: 1500, totalEstimated: 15000, decayYears: 5,
    note: 'Debris cloud crossed the ISS orbit 15 times per day. Crew sheltered in Soyuz for 2 hours. Condemned internationally as irresponsible.',
    shells: [
      { alt: 400, pct: 15 },
      { alt: 450, pct: 32 },
      { alt: 500, pct: 35 },
      { alt: 550, pct: 18 },
    ],
  },
};

const CSS = `
/* ── Debris Archaeology panel — design-system compliant ─────────── */
#debris-arch-panel {
  position: fixed;
  top: 50%;
  right: 406px;
  transform: translateY(-50%) translateX(14px);
  opacity: 0;
  pointer-events: none;
  width: 320px;
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
  background: var(--bg-panel-dense);
  border-top:    1px solid var(--border-danger);
  border-left:   1px solid var(--border-danger);
  border-right:  1px solid rgba(255,68,85,0.12);
  border-bottom: 1px solid rgba(255,68,85,0.12);
  font-family: var(--font);
  color: var(--text-primary);
  z-index: var(--z-panel);
  transition: opacity var(--t-slow), transform var(--t-slow);
}
#debris-arch-panel::-webkit-scrollbar       { width: 3px; }
#debris-arch-panel::-webkit-scrollbar-track { background: transparent; }
#debris-arch-panel::-webkit-scrollbar-thumb { background: var(--border-dim); }
#debris-arch-panel.da-open {
  opacity: 1;
  transform: translateY(-50%) translateX(0);
  pointer-events: auto;
}

.da-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid rgba(255,68,85,0.15);
  cursor: default;
}
.da-header-label {
  font-size: var(--text-xs);
  letter-spacing: 0.16em;
  color: var(--red);
  font-weight: 500;
  text-transform: uppercase;
}
.da-close {
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
.da-close:hover { color: var(--red); border-color: var(--border-danger); }

/* Event title / date */
.da-event-title {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--white-cold);
  padding: var(--space-3) var(--space-3) var(--space-1);
  line-height: 1.35;
  letter-spacing: 0.03em;
}
.da-event-date {
  font-size: var(--text-xs);
  color: var(--text-dim);
  padding: 0 var(--space-3) var(--space-2);
  letter-spacing: 0.08em;
}

/* Chips / badges */
.da-chips {
  display: flex;
  gap: var(--space-2);
  padding: 0 var(--space-3) var(--space-3);
  flex-wrap: wrap;
}
.da-chip {
  font-size: var(--text-xs);
  padding: 2px var(--space-2);
  border: 1px solid;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}
.da-chip-alt   { color: var(--blue);  border-color: rgba(79,195,247,0.35);  background: rgba(79,195,247,0.07); }
.da-chip-decay { color: var(--amber); border-color: rgba(255,179,0,0.35);   background: rgba(255,179,0,0.07); }

/* Sections */
.da-section {
  padding: var(--space-2) var(--space-3) var(--space-3);
  border-top: 1px solid var(--border-dim);
}
.da-section-label {
  font-size: var(--text-xs);
  letter-spacing: 0.13em;
  color: var(--text-secondary);
  text-transform: uppercase;
  margin-bottom: var(--space-2);
}

/* Stat grid */
.da-stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2) var(--space-3);
}
.da-stat { display: flex; flex-direction: column; }
.da-stat-val {
  font-size: var(--text-2xl);
  font-weight: 300;
  color: var(--red);
  line-height: 1.15;
  letter-spacing: 0.02em;
}
.da-stat-val.da-neutral { color: var(--text-primary); }
.da-stat-label {
  font-size: var(--text-xs);
  color: var(--text-dim);
  letter-spacing: 0.05em;
  margin-top: 2px;
}

/* Narrative note */
.da-note {
  font-size: var(--text-xs);
  line-height: 1.65;
  color: var(--text-secondary);
  padding: var(--space-2) var(--space-3) var(--space-3);
  border-top: 1px solid var(--border-dim);
  font-style: italic;
  letter-spacing: 0.03em;
}

/* Mini chart */
#da-chart {
  width: 100%;
  height: 68px;
  display: block;
  margin-bottom: var(--space-2);
}

/* Year scrubber slider */
.da-slider-wrap { padding: 0 0 var(--space-2); }
input[type=range].da-slider {
  width: 100%;
  -webkit-appearance: none;
  appearance: none;
  height: 2px;
  outline: none;
  cursor: pointer;
  background: var(--border-dim);
  accent-color: var(--red);
}
input[type=range].da-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px; height: 12px;
  background: var(--red);
  cursor: pointer;
  border: 2px solid var(--bg-panel-dense);
  box-shadow: 0 0 5px rgba(255,68,85,0.55);
}

/* Year stats text */
.da-year-stats {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  letter-spacing: 0.04em;
  line-height: 1.75;
  margin-top: var(--space-1);
}
.da-year-stats strong { color: var(--text-primary); font-weight: 400; }
.da-delta-pos { color: var(--red); }
.da-delta-neg { color: var(--green); }

/* Altitude shell bars */
.da-shell-bar-wrap { display: flex; flex-direction: column; gap: 5px; }
.da-shell-row { display: flex; align-items: center; gap: var(--space-2); }
.da-shell-alt {
  font-size: var(--text-xs);
  color: var(--text-dim);
  width: 52px;
  flex-shrink: 0;
  text-align: right;
  letter-spacing: 0.03em;
}
.da-shell-track {
  flex: 1;
  height: 6px;
  background: rgba(255,68,85,0.08);
}
.da-shell-fill {
  height: 100%;
  background: linear-gradient(90deg, rgba(255,68,85,0.4), var(--red));
  transition: width 0.5s ease-out;
}
.da-shell-pct {
  font-size: var(--text-xs);
  color: rgba(255,68,85,0.6);
  width: 30px;
  flex-shrink: 0;
  letter-spacing: 0.03em;
}

/* Footer action buttons */
.da-footer {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3) var(--space-3);
  border-top: 1px solid var(--border-dim);
}
.da-btn {
  flex: 1;
  font-family: var(--font);
  font-size: var(--text-xs);
  letter-spacing: 0.10em;
  padding: 5px var(--space-2);
  cursor: pointer;
  text-align: center;
  text-transform: uppercase;
  transition: background var(--t-fast), color var(--t-fast), border-color var(--t-fast);
}
.da-btn-event {
  background: rgba(255,68,85,0.10);
  border: 1px solid var(--border-danger);
  color: var(--red);
}
.da-btn-event:hover {
  background: rgba(255,68,85,0.20);
  border-color: var(--red);
}
.da-btn-today {
  background: transparent;
  border: 1px solid var(--border-dim);
  color: var(--text-dim);
}
.da-btn-today:hover {
  background: var(--bg-row-hover);
  color: var(--text-secondary);
  border-color: var(--border-normal);
}
`;

function drawMiniChart(canvas, eventYear, viewYear) {
  const dpr = window.devicePixelRatio || 1;
  const w   = canvas.clientWidth  * dpr;
  const h   = canvas.clientHeight * dpr;
  if (!w || !h) return;
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  const data     = POPULATION_DATA;
  const minYear  = data[0].year;
  const maxYear  = data[data.length - 1].year;
  const maxTotal = data[data.length - 1].total * 1.05;

  const pad = { l: 0, r: 0, t: 4, b: 2 };
  const cw  = w - pad.l - pad.r;
  const ch  = h - pad.t - pad.b;

  const xOf = yr    => pad.l + ((yr - minYear) / (maxYear - minYear)) * cw;
  const yOf = count => pad.t + ch - (count / maxTotal) * ch;

  // Debris area fill
  ctx.beginPath();
  data.forEach((d, i) => {
    const x = xOf(d.year), y = yOf(d.debris);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.lineTo(xOf(data[data.length - 1].year), h);
  ctx.lineTo(xOf(data[0].year), h);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(239,83,80,0.30)');
  grad.addColorStop(1, 'rgba(239,83,80,0.03)');
  ctx.fillStyle = grad;
  ctx.fill();

  // Debris line
  ctx.beginPath();
  data.forEach((d, i) => {
    const x = xOf(d.year), y = yOf(d.debris);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = 'rgba(239,83,80,0.75)';
  ctx.lineWidth   = 1.5 * dpr;
  ctx.stroke();

  // Event year marker — dashed red vertical
  const ex = xOf(eventYear);
  ctx.save();
  ctx.setLineDash([3 * dpr, 2 * dpr]);
  ctx.beginPath();
  ctx.moveTo(ex, pad.t);
  ctx.lineTo(ex, h);
  ctx.strokeStyle = 'rgba(239,83,80,0.90)';
  ctx.lineWidth   = 1.5 * dpr;
  ctx.stroke();
  ctx.restore();

  // View year cursor — green glow line
  if (viewYear > eventYear) {
    const vx = xOf(viewYear);
    const glow = ctx.createLinearGradient(vx - 5 * dpr, 0, vx + 5 * dpr, 0);
    glow.addColorStop(0,   'rgba(105,240,174,0)');
    glow.addColorStop(0.5, 'rgba(105,240,174,0.30)');
    glow.addColorStop(1,   'rgba(105,240,174,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(vx - 5 * dpr, pad.t, 10 * dpr, ch);
    ctx.beginPath();
    ctx.moveTo(vx, pad.t);
    ctx.lineTo(vx, h);
    ctx.strokeStyle = '#69F0AE';
    ctx.lineWidth   = 1.5 * dpr;
    ctx.stroke();
  }

  // Year label at event marker
  ctx.font         = `${9 * dpr}px "SF Mono", monospace`;
  ctx.fillStyle    = 'rgba(239,83,80,0.65)';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(String(eventYear), ex, pad.t + 1 * dpr);
}

function fmtNum(n) { return n.toLocaleString(); }

export function createDebrisArchaeology({ onJumpToDate, onGotoEvent } = {}) {
  if (!document.getElementById('da-styles')) {
    const style = document.createElement('style');
    style.id = 'da-styles';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  const panel = document.createElement('div');
  panel.id = 'debris-arch-panel';
  panel.innerHTML = `
    <div class="da-header">
      <span class="da-header-label">💥 DEBRIS ARCHAEOLOGY</span>
      <button class="da-close" id="da-close-btn" title="Close">✕</button>
    </div>
    <div id="da-event-title" class="da-event-title"></div>
    <div id="da-event-date"  class="da-event-date"></div>
    <div id="da-chips"       class="da-chips"></div>

    <div class="da-section">
      <div class="da-section-label">Immediate Impact</div>
      <div id="da-stat-grid" class="da-stat-grid"></div>
    </div>

    <div id="da-note" class="da-note"></div>

    <div class="da-section">
      <div class="da-section-label">Debris Growth Timeline</div>
      <canvas id="da-chart"></canvas>
      <div class="da-slider-wrap">
        <input type="range" class="da-slider" id="da-slider" min="0" max="100" value="0" />
      </div>
      <div id="da-year-stats" class="da-year-stats"></div>
    </div>

    <div class="da-section">
      <div class="da-section-label">Affected Altitude Shells</div>
      <div id="da-shells" class="da-shell-bar-wrap"></div>
    </div>

    <div class="da-footer">
      <button class="da-btn da-btn-event" id="da-goto-event">▶ JUMP TO EVENT</button>
      <button class="da-btn da-btn-today" id="da-goto-today">▶ JUMP TO TODAY</button>
    </div>
  `;
  document.body.appendChild(panel);

  const closeBtn  = panel.querySelector('#da-close-btn');
  const titleEl   = panel.querySelector('#da-event-title');
  const dateEl    = panel.querySelector('#da-event-date');
  const chipsEl   = panel.querySelector('#da-chips');
  const statGrid  = panel.querySelector('#da-stat-grid');
  const noteEl    = panel.querySelector('#da-note');
  const chartEl   = panel.querySelector('#da-chart');
  const sliderEl  = panel.querySelector('#da-slider');
  const yearStats = panel.querySelector('#da-year-stats');
  const shellsEl  = panel.querySelector('#da-shells');
  const btnEvent  = panel.querySelector('#da-goto-event');
  const btnToday  = panel.querySelector('#da-goto-today');

  let _event     = null;
  let _eventYear = 2000;
  const MAX_YEAR = POPULATION_DATA[POPULATION_DATA.length - 1].year;

  function _sliderYearOf(val) {
    return Math.round(_eventYear + (val / 100) * (MAX_YEAR - _eventYear));
  }

  function _updateStats(viewYear) {
    drawMiniChart(chartEl, _eventYear, viewYear);
    const beforeData = getPopulationAt(_eventYear - 1);
    const atData     = getPopulationAt(viewYear);
    const delta      = atData.debris - beforeData.debris;
    const pct        = beforeData.debris > 0
      ? Math.round(Math.abs(delta) / beforeData.debris * 100) : 0;
    const sign       = delta >= 0 ? '+' : '−';
    const cls        = delta >= 0 ? 'da-delta-pos' : 'da-delta-neg';
    yearStats.innerHTML =
      `<strong>${viewYear}</strong> — ${fmtNum(atData.total)} tracked objects<br>` +
      `${fmtNum(atData.debris)} debris · ` +
      `vs. ${_eventYear - 1}: <span class="${cls}">${sign}${fmtNum(Math.abs(delta))} (${sign}${pct}%)</span>`;
  }

  sliderEl.addEventListener('input', () => {
    const yr = _sliderYearOf(+sliderEl.value);
    _updateStats(yr);
    onJumpToDate?.(new Date(`${yr}-07-01T00:00:00Z`).getTime());
  });

  closeBtn.addEventListener('click', () => hide());

  btnEvent.addEventListener('click', () => {
    if (!_event) return;
    sliderEl.value = 0;
    _updateStats(_eventYear);
    const ms = new Date(_event.date + 'T12:00:00Z').getTime();
    if (onGotoEvent) {
      onGotoEvent(_event, ms);
    } else {
      onJumpToDate?.(ms);
    }
  });

  btnToday.addEventListener('click', () => {
    sliderEl.value = 100;
    _updateStats(MAX_YEAR);
    onJumpToDate?.(Date.now());
  });

  function show(ev) {
    _event     = ev;
    _eventYear = ev.year;
    const meta = DEBRIS_META[ev.id] ?? null;

    // Header
    titleEl.textContent = ev.title;
    dateEl.textContent  = ev.date;

    // Chips
    chipsEl.innerHTML = '';
    if (meta) {
      const altChip = document.createElement('span');
      altChip.className   = 'da-chip da-chip-alt';
      altChip.textContent = `↑ ${meta.altitudeKm} km`;
      chipsEl.appendChild(altChip);

      const decayChip = document.createElement('span');
      decayChip.className   = 'da-chip da-chip-decay';
      decayChip.textContent = meta.decayYears >= 50
        ? `≥${meta.decayYears} yr orbit`
        : `~${meta.decayYears} yr decay`;
      chipsEl.appendChild(decayChip);
    }

    // Stats
    if (meta) {
      const estHtml = meta.totalEstimated > meta.trackedFragments
        ? `<div class="da-stat">
             <div class="da-stat-val da-neutral">~${fmtNum(meta.totalEstimated)}</div>
             <div class="da-stat-label">estimated total pieces</div>
           </div>`
        : '';
      statGrid.innerHTML = `
        <div class="da-stat">
          <div class="da-stat-val">${fmtNum(meta.trackedFragments)}</div>
          <div class="da-stat-label">tracked fragments</div>
        </div>
        ${estHtml}
      `;
      noteEl.textContent  = meta.note;
      noteEl.style.display = '';
    } else {
      statGrid.innerHTML  = '<div class="da-stat"><div class="da-stat-val">—</div><div class="da-stat-label">no data available</div></div>';
      noteEl.style.display = 'none';
    }

    // Shell bars
    if (meta && meta.shells.length > 0) {
      const maxPct = Math.max(...meta.shells.map(s => s.pct));
      shellsEl.innerHTML = meta.shells.map(s => {
        const barW = (s.pct / maxPct * 100).toFixed(1);
        return `<div class="da-shell-row">
          <span class="da-shell-alt">${s.alt} km</span>
          <div class="da-shell-track">
            <div class="da-shell-fill" style="width:${barW}%"></div>
          </div>
          <span class="da-shell-pct">${s.pct}%</span>
        </div>`;
      }).join('');
    } else {
      shellsEl.innerHTML = '<span style="font-size:12px;color:rgba(201,214,227,0.35)">No shell data available</span>';
    }

    // Reset slider to event year
    sliderEl.value = 0;

    panel.classList.add('da-open');

    // Draw chart after layout
    requestAnimationFrame(() => _updateStats(_eventYear));
  }

  function hide() {
    panel.classList.remove('da-open');
    _event = null;
  }

  function isOpen() {
    return panel.classList.contains('da-open');
  }

  return { show, hide, isOpen };
}
