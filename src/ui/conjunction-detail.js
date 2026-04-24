
const GM_SCENE = 3.986e5 / (500 * 500 * 500);   // ≈ 3.189e-3 scene³ s⁻²

function approxVelocity(px, py, pz) {
  const r     = Math.sqrt(px*px + py*py + pz*pz);
  if (r < 1e-6) return [0, 0, 0];
  const speed = Math.sqrt(GM_SCENE / r);
  const eqLen = Math.sqrt(pz*pz + px*px);
  if (eqLen < 1e-6) return [0, 0, 0];
  return [-pz/eqLen * speed, 0, px/eqLen * speed];
}

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

function isDebris(cat, name) {
  return cat === 'debris'
      || (typeof name === 'string' && (name.includes('DEB') || name.includes('R/B')));
}

function narrativeRisk(c) {
  const tcaStr  = fmtDuration(c._tcaSec);
  const tcaDist = c._tcaDistKm != null
    ? (c._tcaDistKm < 10 ? c._tcaDistKm.toFixed(1) : Math.round(c._tcaDistKm)) + ' km'
    : null;

  if (c.risk === 'critical') {
    return `Objects are on a trajectory to pass within ${tcaDist ?? 'under 5 km'} of each other`
      + (c._tcaSec ? ` in approximately ${tcaStr}` : '')
      + `. At typical LEO orbital velocities (7–8 km/s), a collision at this range`
      + ` would generate thousands of debris fragments, threatening adjacent orbital shells`
      + ` and potentially triggering Kessler Syndrome cascade in this band.`;
  }
  if (c.risk === 'warning') {
    return `A close approach is predicted`
      + (c._tcaSec ? ` in ~${tcaStr}` : '')
      + (tcaDist ? ` with minimum separation of ~${tcaDist}` : '')
      + `. While immediate collision probability is low, the proximity warrants`
      + ` updated state-vector refinement and possible maneuver coordination before TCA.`;
  }
  return `Objects will pass within 100 km`
    + (c._tcaSec ? `, with closest approach in ~${tcaStr}` : '')
    + (tcaDist ? ` (~${tcaDist} predicted separation)` : '')
    + `. Routine conjunction under standard screening criteria.`
    + ` No significant collision risk under current orbital data.`;
}

function narrativeAvoidance(c) {
  const debA = isDebris(c.catA, c.nameA);
  const debB = isDebris(c.catB, c.nameB);
  const tcaMin = c._tcaSec != null ? Math.floor(c._tcaSec / 60) : null;

  if (c.risk === 'critical') {
    if (debA && debB) {
      return 'Both objects are uncontrolled debris — no maneuver is possible. '
           + 'Notify relevant satellite operators in the vicinity and log the event in '
           + 'conjunction tracking systems (Space-Track CDM, LeoLabs).';
    }
    const urgency = tcaMin != null && tcaMin < 30
      ? '⚠ IMMEDIATE action required.'
      : 'Action required before TCA.';
    const debSide = debA ? c.nameA : debB ? c.nameB : null;
    return urgency + ' '
      + (debSide
          ? `${debSide} is uncontrolled — the active satellite operator must initiate avoidance. `
          : 'Controlled satellite operators should initiate emergency avoidance maneuver analysis. ')
      + 'Issue a Conjunction Data Message (CDM) to all stakeholders. '
      + 'Contact Space-Track.org and the satellite operator NOC immediately.';
  }

  if (c.risk === 'warning') {
    if (debA && debB) {
      return 'Both objects are uncontrolled. Monitor via Space-Track.org. '
           + 'Alert operators of any active satellites in the local orbit region.';
    }
    return 'Maneuver analysis recommended. Acquire additional tracking passes to refine '
         + 'state vectors before TCA. Coordinate with the satellite operator if an '
         + 'avoidance burn is warranted. Typical decision threshold: Pc > 1×10⁻⁴.';
  }

  return 'No action required at this time. Continue monitoring at next tracking pass. '
       + 'Reassess if current separation trends below 25 km or if updated TLEs '
       + 'change the close-approach prediction significantly.';
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

    const [vAx, vAy, vAz] = approxVelocity(posA[0], posA[1], posA[2]);
    const [vBx, vBy, vBz] = approxVelocity(posB[0], posB[1], posB[2]);
    const dvx = vAx - vBx, dvy = vAy - vBy, dvz = vAz - vBz;
    const relVelKms = Math.sqrt(dvx*dvx + dvy*dvy + dvz*dvz) * 500;

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
        <div class="cd-stat-row">
          <span class="cd-stat-label">Relative Velocity</span>
          <span class="cd-stat-val">~${relVelKms.toFixed(2)} km/s</span>
        </div>
      </div>

      <div class="cd-section">
        <div class="cd-section-label">Risk Analysis</div>
        <div class="cd-body-text">${narrativeRisk(c)}</div>
      </div>

      <div class="cd-section">
        <div class="cd-section-label">Recommended Action</div>
        <div class="cd-body-text">${narrativeAvoidance(c)}</div>
      </div>

      ${c._tcaSec != null ? `
      <div class="cd-section cd-tca-action">
        <button class="cd-jump-btn" id="cd-jump-tca-btn">
          ⏱ Jump to TCA  (+${fmtDuration(c._tcaSec)})
        </button>
      </div>` : ''}
    `;

    panel.classList.add('visible');

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
