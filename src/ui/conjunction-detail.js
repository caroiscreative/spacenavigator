
function fmtDuration(sec) {
  if (sec === null || sec === undefined) return '—';
  if (sec < 60)  return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (m < 60)  return `${m}m ${s.toString().padStart(2,'0')}s`;
  const h  = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm.toString().padStart(2,'0')}m`;
}

function riskColor(risk) {
  if (risk === 'critical') return '#FF1744';
  if (risk === 'warning')  return '#FF6D00';
  return '#FFD600';
}

function catLabel(cat) {
  const m = { leo:'LEO', geo:'GEO', meo:'MEO', heo:'HEO',
               debris:'Debris', active:'Active',
               starlink:'Starlink', oneweb:'OneWeb' };
  return m[cat] ?? (cat ? cat.toUpperCase() : 'Unknown');
}


function narrativeRisk(c) {
  const tcaStr  = fmtDuration(c._tcaSec);
  const tcaDist = c._tcaDistKm != null
    ? (c._tcaDistKm < 10 ? c._tcaDistKm.toFixed(1) : Math.round(c._tcaDistKm)) + ' km'
    : null;

  if (c.risk === 'critical') {
    return `Closest approach ${tcaDist ? `of ${tcaDist}` : 'under 5 km'}`
      + (c._tcaSec ? ` in ${tcaStr}` : '')
      + `. At LEO velocities a collision would generate thousands of debris fragments`
      + ` and risk Kessler cascade.`;
  }
  if (c.risk === 'warning') {
    return `Close approach predicted`
      + (c._tcaSec ? ` in ~${tcaStr}` : '')
      + (tcaDist ? ` — minimum separation ~${tcaDist}` : '')
      + `. Collision probability is low but warrants tracking refinement before TCA.`;
  }
  return `Routine screening conjunction`
    + (tcaDist ? ` — predicted separation ${tcaDist}` : '')
    + (c._tcaSec ? ` in ~${tcaStr}` : '')
    + `. No significant risk under current data.`;
}

export function createConjunctionDetail() {
  const panel = document.getElementById('conj-detail');
  if (!panel) {
    console.warn('[ConjDetail] #conj-detail not found');
    return { show: () => {}, hide: () => {}, isVisible: () => false };
  }

  let _onClose = null;   // optional callback when panel is closed

  function show(c, posA, posB, simTimeMs) {
    if (!c) return;

    const color   = riskColor(c.risk);
    const curDist = c.distKm < 10 ? c.distKm.toFixed(2) : c.distKm.toFixed(1);
    const tcaStr  = c._tcaSec    != null ? fmtDuration(c._tcaSec) : '—';
    const tcaDistStr = c._tcaDistKm != null
      ? (c._tcaDistKm < 10 ? c._tcaDistKm.toFixed(2) : c._tcaDistKm.toFixed(1)) + ' km'
      : '—';

    const nameA = c.nameA.length > 18 ? c.nameA.slice(0, 18) + '…' : c.nameA;
    const nameB = c.nameB.length > 18 ? c.nameB.slice(0, 18) + '…' : c.nameB;

    panel.style.setProperty('--cd-risk-color', color);

    panel.innerHTML = `
      <div class="cd-header">
        <span class="cd-title">⚡ CONJUNCTION EVENT</span>
        <span class="cd-badge" style="color:${color};border-color:${color}">${c.risk.toUpperCase()}</span>
        <span class="cd-close" id="cd-close-btn">×</span>
      </div>

      <div class="cd-objects">
        <div class="cd-obj">
          <div class="cd-obj-name" title="${c.nameA}">${nameA}</div>
          <div class="cd-obj-cat">${catLabel(c.catA)}</div>
        </div>
        <div class="cd-vs">↔</div>
        <div class="cd-obj cd-obj-right">
          <div class="cd-obj-name" title="${c.nameB}">${nameB}</div>
          <div class="cd-obj-cat">${catLabel(c.catB)}</div>
        </div>
      </div>

      <div class="cd-stats">
        <div class="cd-stat-row">
          <span class="cd-stat-label">Current Separation</span>
          <span class="cd-stat-val" style="color:${color}">${curDist} km</span>
        </div>
        <div class="cd-stat-row">
          <span class="cd-stat-label">Time to TCA</span>
          <span class="cd-stat-val">${tcaStr}</span>
        </div>
        <div class="cd-stat-row">
          <span class="cd-stat-label">Pred. Sep. at TCA</span>
          <span class="cd-stat-val">${tcaDistStr}</span>
        </div>
      </div>

      <div class="cd-section">
        <div class="cd-section-label">Risk Analysis</div>
        <div class="cd-body-text">${narrativeRisk(c)}</div>
      </div>

      ${c._tcaSec != null ? `
      <div class="cd-section cd-tca-action">
        <button class="cd-jump-btn" id="cd-jump-tca-btn">
          ⏱ Jump to TCA  (+${fmtDuration(c._tcaSec)})
        </button>
      </div>` : ''}

      <div class="cd-viewport-note">
        <span class="cd-note-icon">◈</span>
        Colored line in viewport = live separation gap between the two objects.
        Scroll to zoom in on the pair.
      </div>
    `;

    panel.classList.add('visible');

    // Position detail panel flush to the right of the risk panel.
    // Must happen AFTER classList.add so offsetWidth is measurable.
    const riskEl = document.getElementById('risk-panel');
    if (riskEl && riskEl.classList.contains('visible')) {
      const rr        = riskEl.getBoundingClientRect();
      const pw        = panel.offsetWidth || 300;   // fallback to CSS width
      const gap       = 20;
      const idealLeft = rr.right + gap;
      // If it would spill off-screen, open to the LEFT of the risk panel instead
      const fitsRight = idealLeft + pw <= window.innerWidth - gap;
      panel.style.right = 'auto';
      panel.style.left  = fitsRight
        ? idealLeft + 'px'
        : Math.max(gap, rr.left - pw - gap) + 'px';
      panel.style.top   = rr.top + 'px';
    }

    document.getElementById('cd-close-btn')?.addEventListener('click', hide);

    document.getElementById('cd-jump-tca-btn')?.addEventListener('click', () => {
      if (c._tcaSec == null) return;
      const baseMs   = simTimeMs ?? Date.now();
      const targetMs = baseMs + c._tcaSec * 1000;
      window.dispatchEvent(new CustomEvent('jump-to-time', { detail: targetMs }));
    });
  }

  function hide() {
    panel.classList.remove('visible');
    if (_onClose) _onClose();
  }

  function isVisible() { return panel.classList.contains('visible'); }

  function onClose(fn) { _onClose = fn; }

  const _escHandler = (e) => {
    if (e.key === 'Escape' && isVisible()) hide();
  };
  window.addEventListener('keydown', _escHandler);

  function destroy() {
    window.removeEventListener('keydown', _escHandler);
  }

  return { show, hide, isVisible, onClose, destroy };
}
