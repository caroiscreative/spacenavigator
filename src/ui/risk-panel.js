
export function createRiskPanel({ onSelect } = {}) {
  const panel   = document.getElementById('risk-panel');
  const listEl  = document.getElementById('risk-panel-list');
  const countEl = document.getElementById('risk-panel-count');
  const timeEl  = document.getElementById('risk-panel-scan-time');

  if (!panel || !listEl) {
    console.warn('[RiskPanel] Required DOM elements not found');
    return { update: () => {}, show: () => {}, hide: () => {}, toggle: () => false, isVisible: () => false, deselect: () => {} };
  }

  let currentConjunctions = [];
  let selectedEntry       = null;   // currently highlighted .risk-entry element

  listEl.addEventListener('click', e => {
    const entry = e.target.closest('[data-conj-idx]');
    if (!entry) return;
    const idx = parseInt(entry.dataset.conjIdx, 10);
    if (isNaN(idx) || !currentConjunctions[idx]) return;

    if (selectedEntry) selectedEntry.classList.remove('selected');
    entry.classList.add('selected');
    selectedEntry = entry;

    if (onSelect) onSelect(currentConjunctions[idx]);
  });

  function riskDot(risk) {
    return `<span class="risk-dot risk-${risk}">●</span>`;
  }

  function shortName(name) {
    return name
      .replace(/^STARLINK-/, 'SL-')
      .replace(/^ONEWEB-/,   'OW-')
      .replace(/^IRIDIUM-?/, 'IR-')
      .replace(/^COSMOS-/,   'C-')
      .replace(/^FENGYUN-/,  'FY-')
      .slice(0, 18);
  }

  function formatTCA(sec) {
    if (sec === null || sec === undefined) return null;
    if (sec < 60)  return '< 1 min';
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    if (m < 60)  return `${m}m ${s.toString().padStart(2,'0')}s`;
    const h  = Math.floor(m / 60);
    const rm = m % 60;
    return `${h}h ${rm.toString().padStart(2,'0')}m`;
  }

  let lastUpdateTime = 0;

  function update(data) {
    let conjunctions, totalFound;
    if (Array.isArray(data)) {
      conjunctions = data;
      totalFound   = data.length;
    } else {
      conjunctions = data.conjunctions ?? [];
      totalFound   = data.totalFound   ?? conjunctions.length;
    }

    currentConjunctions = conjunctions;

    const now = performance.now();
    if (now - lastUpdateTime < 1000) return;
    lastUpdateTime = now;

    if (!panel.classList.contains('visible')) return;

    if (countEl) {
      if (totalFound === 0) {
        countEl.textContent = 'No warnings';
      } else {
        const shown = conjunctions.length;
        countEl.textContent = shown < totalFound
          ? `Top ${shown} of ${totalFound} events`
          : `${totalFound} event${totalFound !== 1 ? 's' : ''}`;
      }
    }

    const prevSelectedIdx = selectedEntry
      ? parseInt(selectedEntry.dataset.conjIdx, 10)
      : null;

    if (conjunctions.length === 0) {
      listEl.innerHTML = '<div class="risk-none">Scanning — no conjunctions found within 100 km</div>';
      selectedEntry = null;
    } else {
      listEl.innerHTML = conjunctions.map((c, i) => {
        const km  = c.distKm < 10 ? c.distKm.toFixed(2) : c.distKm.toFixed(1);
        const dot = riskDot(c.risk);
        const a   = shortName(c.nameA);
        const b   = shortName(c.nameB);

        const tcaTime = formatTCA(c._tcaSec);
        let tcaHtml = '';
        if (tcaTime !== null) {
          const tcaDist = c._tcaDistKm != null
            ? ` → ~${c._tcaDistKm < 10 ? c._tcaDistKm.toFixed(1) : Math.round(c._tcaDistKm)} km`
            : '';
          tcaHtml = `<div class="risk-tca">TCA ${tcaTime}${tcaDist}</div>`;
        }

        const selectedClass = (i === prevSelectedIdx) ? ' selected' : '';
        return `<div class="risk-entry${selectedClass}" data-conj-idx="${i}">
          <div class="risk-row">
            ${dot}
            <span class="risk-names" title="${c.nameA} ↔ ${c.nameB}">${a} ↔ ${b}</span>
            <span class="risk-dist">${km} km</span>
          </div>${tcaHtml}
        </div>`;
      }).join('');

      if (prevSelectedIdx !== null) {
        selectedEntry = listEl.querySelector(`[data-conj-idx="${prevSelectedIdx}"]`) ?? null;
      }
    }

    if (timeEl) {
      const t = new Date();
      timeEl.textContent = `Scanned ${t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    }
  }

  function show()   { panel.classList.add('visible'); }
  function hide()   { panel.classList.remove('visible'); }
  function toggle() {
    panel.classList.toggle('visible');
    return panel.classList.contains('visible');
  }
  function isVisible() { return panel.classList.contains('visible'); }

  function deselect() {
    if (selectedEntry) { selectedEntry.classList.remove('selected'); selectedEntry = null; }
  }

  return { update, show, hide, toggle, isVisible, deselect };
}
