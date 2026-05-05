
// ── Fleet definitions — order determines display priority ────────────────────
const FLEETS = [
  { id: 'starlink', label: 'Starlink',       operator: 'SpaceX',   color: '#4FC3F7' },
  { id: 'oneweb',   label: 'OneWeb',         operator: 'OneWeb',   color: '#80CBC4' },
  { id: 'gps',      label: 'GPS',            operator: 'USAF',     color: '#81C784' },
  { id: 'galileo',  label: 'Galileo',        operator: 'ESA / EU', color: '#CE93D8' },
  { id: 'glonass',  label: 'GLONASS',        operator: 'Roscosmos',color: '#FFB74D' },
  { id: 'iridium',  label: 'Iridium',        operator: 'Iridium',  color: '#F48FB1' },
  { id: 'station',  label: 'Space Stations', operator: 'Multi',    color: '#FFFFFF' },
  { id: 'geo',      label: 'GEO Belt',       operator: 'Various',  color: '#CE93D8' },
  { id: 'meo',      label: 'MEO',            operator: 'Various',  color: '#A5D6A7' },
  { id: 'other',    label: 'Other LEO',      operator: 'Various',  color: '#607D8B' },
  { id: 'debris',   label: 'Debris',         operator: '',         color: '#EF5350' },
];

function classifyTle(tle) {
  if (tle.category === 'station') return 'station';
  if (tle.category === 'debris')  return 'debris';
  if (tle.category === 'starlink') return 'starlink';
  if (tle.category === 'oneweb')   return 'oneweb';
  if (tle.category === 'geo')      return 'geo';
  if (tle.category === 'meo')      return 'meo';
  const n = (tle.name || '').toUpperCase();
  if (n.includes('STARLINK'))                                        return 'starlink';
  if (n.includes('ONEWEB'))                                         return 'oneweb';
  if (n.match(/NAVSTAR|GPS\s+(IIR|IIF|III|BIIF|BIII)/))           return 'gps';
  if (n.includes('GALILEO'))                                        return 'galileo';
  if (n.includes('GLONASS'))                                        return 'glonass';
  if (n.includes('IRIDIUM'))                                        return 'iridium';
  return 'other';
}

// Classify a conjunction event participant by its embedded name + category strings
function classifyByCat(name, cat) {
  if (cat === 'station') return 'station';
  if (cat === 'debris')  return 'debris';
  if (cat === 'starlink') return 'starlink';
  if (cat === 'oneweb')   return 'oneweb';
  if (cat === 'geo')      return 'geo';
  if (cat === 'meo')      return 'meo';
  return classifyTle({ name, category: cat });
}

function avgAltKm(norads, tleMap) {
  let sum = 0, cnt = 0;
  for (const norad of norads) {
    const t = tleMap.get(norad);
    if (!t) continue;
    const n = t.meanMotion;
    if (!n || n <= 0) continue;
    const n_rad_s = n * (2 * Math.PI) / 86400;
    const a_km    = Math.cbrt(3.986004418e5 / (n_rad_s * n_rad_s));
    sum += (a_km - 6371);
    cnt++;
  }
  return cnt ? Math.round(sum / cnt) : 0;
}

function kpBar(kp, color) {
  const pct = kp !== null ? Math.min(100, (kp / 9) * 100) : 0;
  const kpLabel = kp !== null ? kp.toFixed(1) : '—';
  return `
    <div class="op-kp-track">
      <div class="op-kp-fill" style="width:${pct}%;background:${color}"></div>
    </div>
    <span class="op-kp-val" style="color:${color}">${kpLabel}</span>`;
}

function weatherImpact(altKm, kp) {
  if (kp === null || kp === undefined) {
    return { level: 'unknown', label: 'No data', text: 'Space weather unavailable.', color: 'var(--text-dim)' };
  }
  if (altKm < 600) {
    if (kp >= 7) return { level: 'severe',  label: 'Severe drag', text: 'Major atmospheric drag increase. Orbital decay accelerated — maneuver budget under pressure.', color: 'var(--red)' };
    if (kp >= 5) return { level: 'warning', label: 'Elevated drag', text: 'Storm-level heating expands atmosphere. Altitude maintenance burns may be needed sooner.', color: 'var(--amber)' };
    if (kp >= 4) return { level: 'caution', label: 'Minor drag', text: 'Slightly elevated drag. Within nominal operational range.', color: 'var(--yellow)' };
    return { level: 'nominal', label: 'Nominal', text: 'Quiet geomagnetic conditions. Drag environment nominal for this orbit band.', color: 'var(--green)' };
  }
  if (altKm < 2000) {
    if (kp >= 7) return { level: 'warning', label: 'Elevated drag', text: 'Significant drag increase at this altitude. Monitor fuel budget.', color: 'var(--amber)' };
    if (kp >= 5) return { level: 'caution', label: 'Minor drag', text: 'Moderate storm. Drag slightly elevated but manageable.', color: 'var(--yellow)' };
    return { level: 'nominal', label: 'Nominal', text: 'Nominal drag environment for this orbit band.', color: 'var(--green)' };
  }
  if (altKm < 25000) {
    if (kp >= 7) return { level: 'severe',  label: 'Radiation storm', text: 'Inner belt enhanced. Single-event effects (SEE) risk elevated — safe mode may be required.', color: 'var(--red)' };
    if (kp >= 5) return { level: 'warning', label: 'Radiation risk', text: 'Radiation belts enhanced. Monitor SEE rates and solar panel degradation.', color: 'var(--amber)' };
    return { level: 'nominal', label: 'Nominal', text: 'Normal MEO radiation environment. No action required.', color: 'var(--green)' };
  }
  // GEO
  if (kp >= 7) return { level: 'severe',  label: 'Surface charging', text: 'Severe geomagnetic storm. Surface charging risk. Uplink interference possible. Ground team alert.', color: 'var(--red)' };
  if (kp >= 5) return { level: 'warning', label: 'Charging risk', text: 'Storm conditions. Minor charging risk. Monitor anomaly logs.', color: 'var(--amber)' };
  if (kp >= 4) return { level: 'caution', label: 'Unsettled', text: 'Mildly unsettled. GEO environment generally stable but monitor.', color: 'var(--yellow)' };
  return { level: 'nominal', label: 'Nominal', text: 'Quiet geomagnetic conditions. Nominal GEO operations.', color: 'var(--green)' };
}

function kpColorForKp(kp) {
  if (kp === null || kp === undefined) return 'var(--text-dim)';
  if (kp >= 7) return 'var(--red)';
  if (kp >= 5) return 'var(--amber)';
  if (kp >= 4) return 'var(--yellow)';
  return 'var(--green)';
}

function riskColor(risk) {
  if (risk === 'critical') return '#FF1744';
  if (risk === 'warning')  return '#FF6D00';
  return '#FFD600';
}

function shortName(name = '') {
  return name
    .replace(/^STARLINK-/, 'SL-')
    .replace(/^ONEWEB-/,   'OW-')
    .replace(/^IRIDIUM-?/, 'IR-')
    .replace(/^COSMOS-/,   'C-')
    .replace(/^NAVSTAR /,  'GPS ')
    .replace(/^FENGYUN-/,  'FY-')
    .slice(0, 18);
}

// ── Panel factory ─────────────────────────────────────────────────────────────
export function createOperatorPanel({ onSelectFleet, onClear, onSelectConjunction }) {
  const panel   = document.getElementById('operator-panel');
  const listEl  = document.getElementById('op-list');
  const titleEl = document.getElementById('op-total');

  if (!panel) {
    console.warn('[OperatorPanel] #operator-panel not found');
    return { show: () => {}, hide: () => {}, toggle: () => {}, isVisible: () => false,
             populate: () => {}, updateConjunctions: () => {}, updateWeather: () => {} };
  }

  document.getElementById('op-close')?.addEventListener('click', () => { hide(); onClear?.(); });
  document.getElementById('op-clear')?.addEventListener('click', () => {
    _activeFleet = null;
    _view        = 'list';
    _detailFleet = null;
    _render();
    onClear?.();
  });

  let _tles        = [];
  let _tleMap      = new Map();    // norad → tle
  let _groups      = new Map();    // fleetId → Set<norad>
  let _conjCounts  = new Map();    // fleetId → number
  let _conjByFleet = new Map();    // fleetId → [conjunction events]
  let _activeFleet = null;
  let _weatherData = null;
  let _view        = 'list';       // 'list' | 'detail'
  let _detailFleet = null;

  // ── Data population ──────────────────────────────────────────────────────
  function populate(tles) {
    _tles   = tles;
    _tleMap = new Map(tles.map(t => [t.norad, t]));
    _groups = new Map(FLEETS.map(f => [f.id, new Set()]));
    for (const tle of tles) {
      _groups.get(classifyTle(tle))?.add(tle.norad);
    }
    if (_view === 'list') _render();
    else if (_detailFleet) _renderDetail(_detailFleet);
  }

  function updateConjunctions(conjData) {
    _conjByFleet = new Map(FLEETS.map(f => [f.id, []]));
    _conjCounts.clear();
    if (!conjData) {
      if (_view === 'list') _render();
      return;
    }
    for (const ev of conjData) {
      const fa = classifyByCat(ev.nameA, ev.catA);
      const fb = classifyByCat(ev.nameB, ev.catB);
      // Add event to each involved fleet (deduplicate — don't double-count same fleet)
      const seen = new Set();
      for (const fid of [fa, fb]) {
        if (seen.has(fid)) continue;
        seen.add(fid);
        _conjByFleet.get(fid)?.push(ev);
        _conjCounts.set(fid, (_conjCounts.get(fid) ?? 0) + 1);
      }
    }
    if (_view === 'list') _render();
    else if (_detailFleet) _renderDetail(_detailFleet);
  }

  function updateWeather(data) {
    _weatherData = data;
    if (_view === 'detail' && _detailFleet) _renderDetail(_detailFleet);
  }

  // ── List view render ──────────────────────────────────────────────────────
  function _render() {
    if (!listEl) return;
    listEl.innerHTML = '';
    listEl.style.maxHeight = '380px';

    let totalActive = 0;
    for (const f of FLEETS) {
      const set = _groups.get(f.id);
      if (set && f.id !== 'debris') totalActive += set.size;
    }
    if (titleEl) titleEl.textContent = `${totalActive.toLocaleString()} active satellites`;

    for (const fleet of FLEETS) {
      const norads = _groups.get(fleet.id);
      if (!norads || norads.size === 0) continue;

      const isActive   = _activeFleet === fleet.id;
      const conjCount  = _conjCounts.get(fleet.id) ?? 0;
      const alt        = avgAltKm(norads, _tleMap);
      const altLabel   = alt > 0 ? `${alt.toLocaleString()} km avg` : '';

      const row = document.createElement('div');
      row.className = 'op-row' + (isActive ? ' op-row-active' : '');
      row.innerHTML = `
        <div class="op-row-left">
          <span class="op-dot" style="background:${fleet.color};box-shadow:0 0 6px ${fleet.color}55;"></span>
          <div class="op-info">
            <span class="op-name">${fleet.label}</span>
            <span class="op-meta">${fleet.operator ? fleet.operator + (altLabel ? ' · ' + altLabel : '') : altLabel}</span>
          </div>
        </div>
        <div class="op-row-right">
          ${conjCount > 0 ? `<span class="op-conj-badge">${conjCount} ⚠</span>` : ''}
          <span class="op-count">${norads.size.toLocaleString()}</span>
          <span class="op-chevron">›</span>
        </div>`;

      row.addEventListener('click', () => {
        _activeFleet = fleet.id;
        onSelectFleet?.(new Set(norads), fleet);
        _renderDetail(fleet);
      });

      listEl.appendChild(row);
    }
  }

  // ── Detail / dashboard view ───────────────────────────────────────────────
  function _renderDetail(fleet) {
    if (!listEl) return;
    _view        = 'detail';
    _detailFleet = fleet;
    listEl.innerHTML = '';
    listEl.style.maxHeight = '520px';

    const norads     = _groups.get(fleet.id) || new Set();
    const alt        = avgAltKm(norads, _tleMap);
    const conjs      = _conjByFleet.get(fleet.id) || [];
    const kp         = _weatherData?.kp ?? null;
    const kpClass    = _weatherData?.kpClass ?? 'quiet';
    const impact     = weatherImpact(alt, kp);
    const kpCol      = kpColorForKp(kp);
    const altLabel   = alt > 0 ? `${alt.toLocaleString()} km` : '— km';
    const conjCount  = conjs.length;

    if (titleEl) titleEl.textContent = `${fleet.label} · ${norads.size.toLocaleString()} sats`;

    // ── Back bar ──────────────────────────────────────────────────────────
    const backBar = document.createElement('div');
    backBar.className = 'op-back-bar';
    backBar.innerHTML = `
      <button class="op-back-btn">‹ All Fleets</button>
      <span class="op-detail-name" style="color:${fleet.color}">${fleet.label}</span>`;
    backBar.querySelector('.op-back-btn').addEventListener('click', () => {
      _view        = 'list';
      _detailFleet = null;
      _activeFleet = null;
      onClear?.();
      _render();
    });
    listEl.appendChild(backBar);

    // ── Stats strip ───────────────────────────────────────────────────────
    const statsStrip = document.createElement('div');
    statsStrip.className = 'op-stats-strip';
    statsStrip.innerHTML = `
      <div class="op-stat-cell">
        <span class="op-stat-val">${norads.size.toLocaleString()}</span>
        <span class="op-stat-lbl">Satellites</span>
      </div>
      <div class="op-stat-divider"></div>
      <div class="op-stat-cell">
        <span class="op-stat-val">${altLabel}</span>
        <span class="op-stat-lbl">Avg altitude</span>
      </div>
      <div class="op-stat-divider"></div>
      <div class="op-stat-cell">
        <span class="op-stat-val" style="color:${conjCount > 0 ? 'var(--amber)' : 'var(--green)'}">${conjCount}</span>
        <span class="op-stat-lbl">Conjunctions</span>
      </div>`;
    listEl.appendChild(statsStrip);

    // ── Weather section ───────────────────────────────────────────────────
    const wxSection = document.createElement('div');
    wxSection.className = 'op-section';
    wxSection.innerHTML = `
      <div class="op-section-title">Space Weather</div>
      <div class="op-wx-block">
        <div class="op-wx-kp">
          <span class="op-wx-kp-label">Kp index</span>
          <div class="op-wx-kp-row">
            ${kpBar(kp, kpCol)}
          </div>
          <span class="op-wx-class" style="color:${kpCol}">${kpClass.toUpperCase()}</span>
        </div>
        <div class="op-wx-impact">
          <span class="op-wx-impact-label" style="color:${impact.color}">${impact.label}</span>
          <span class="op-wx-impact-text">${impact.text}</span>
        </div>
      </div>`;
    listEl.appendChild(wxSection);

    // ── Conjunctions section ──────────────────────────────────────────────
    const conjSection = document.createElement('div');
    conjSection.className = 'op-section';

    const conjHeader = document.createElement('div');
    conjHeader.className = 'op-section-title';
    conjHeader.textContent = conjCount > 0
      ? `Conjunction Alerts  (${conjCount})`
      : 'Conjunction Alerts';
    conjSection.appendChild(conjHeader);

    if (conjCount === 0) {
      const none = document.createElement('div');
      none.className = 'op-conj-empty';
      none.textContent = 'No active conjunctions involving this constellation.';
      conjSection.appendChild(none);
    } else {
      const conjList = document.createElement('div');
      conjList.className = 'op-conj-list';
      const shown = conjs.slice(0, 8);
      shown.forEach(ev => {
        const col   = riskColor(ev.risk);
        const distF = ev.distKm < 10 ? ev.distKm.toFixed(1) : Math.round(ev.distKm);
        const item  = document.createElement('div');
        item.className = 'op-conj-item';
        item.innerHTML = `
          <span class="op-conj-dot" style="color:${col}">●</span>
          <span class="op-conj-names">
            <span class="op-conj-a">${shortName(ev.nameA)}</span>
            <span class="op-conj-sep">↔</span>
            <span class="op-conj-b">${shortName(ev.nameB)}</span>
          </span>
          <span class="op-conj-dist" style="color:${col}">${distF} km</span>`;
        item.addEventListener('click', () => {
          conjList.querySelectorAll('.op-conj-item').forEach(el => el.classList.remove('op-conj-selected'));
          item.classList.add('op-conj-selected');
          onSelectConjunction?.(ev);
        });
        conjList.appendChild(item);
      });
      conjSection.appendChild(conjList);
      if (conjs.length > 8) {
        const more = document.createElement('div');
        more.className = 'op-conj-more';
        more.textContent = `+${conjs.length - 8} more`;
        conjSection.appendChild(more);
      }
    }
    listEl.appendChild(conjSection);

    // ── Satellite roster ──────────────────────────────────────────────────
    const satSection = document.createElement('div');
    satSection.className = 'op-section op-section-last';

    const satHeader = document.createElement('div');
    satHeader.className = 'op-section-title';
    satHeader.textContent = `Satellites  (${norads.size.toLocaleString()})`;
    satSection.appendChild(satHeader);

    const rosterEl = document.createElement('div');
    rosterEl.className = 'op-roster';

    // Gather TLE objects for this fleet
    const fleetTles = [];
    for (const norad of norads) {
      const t = _tleMap.get(norad);
      if (t) fleetTles.push(t);
    }
    // Sort alphabetically; show up to 20
    fleetTles.sort((a, b) => a.name.localeCompare(b.name));
    const rosterShown = fleetTles.slice(0, 20);
    rosterShown.forEach(t => {
      const satAlt = (() => {
        const n = t.meanMotion;
        if (!n || n <= 0) return null;
        const nr = n * (2 * Math.PI) / 86400;
        return Math.round(Math.cbrt(3.986004418e5 / (nr * nr)) - 6371);
      })();
      const altStr = satAlt !== null ? `${satAlt.toLocaleString()} km` : '—';
      const satRow = document.createElement('div');
      satRow.className = 'op-sat-row';
      satRow.innerHTML = `
        <span class="op-sat-name">${shortName(t.name)}</span>
        <span class="op-sat-alt">${altStr}</span>`;
      rosterEl.appendChild(satRow);
    });
    if (fleetTles.length > 20) {
      const hint = document.createElement('div');
      hint.className = 'op-roster-hint';
      hint.textContent = `Showing 20 of ${fleetTles.length.toLocaleString()} — use Explorer for full list`;
      rosterEl.appendChild(hint);
    }
    satSection.appendChild(rosterEl);
    listEl.appendChild(satSection);
  }

  // ── Panel visibility ──────────────────────────────────────────────────────
  function show() {
    panel.classList.remove('hidden');
  }

  function hide() {
    panel.classList.add('hidden');
    _view        = 'list';
    _detailFleet = null;
    _activeFleet = null;
  }

  function toggle() {
    const visible = !panel.classList.contains('hidden');
    if (visible) hide(); else show();
    return !visible;
  }

  function isVisible() { return !panel.classList.contains('hidden'); }

  return { show, hide, toggle, isVisible, populate, updateConjunctions, updateWeather };
}
