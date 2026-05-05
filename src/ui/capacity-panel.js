
// Orbital shell definitions with capacity estimates based on published ITU/FCC studies
// Capacity figures are conservative estimates from academic literature and filing data
const SHELLS = [
  {
    id: 'vleo',
    label: 'Very Low Earth Orbit',
    range: '160 – 450 km',
    minKm: 160,  maxKm: 450,
    capacity: 8000,
    note: 'High drag; rapid reentry. SpaceX Starlink Gen2 lower shells.',
    constellations: ['Starlink (lower layers)'],
  },
  {
    id: 'leo1',
    label: 'LEO — 450 to 600 km',
    range: '450 – 600 km',
    minKm: 450, maxKm: 600,
    capacity: 40000,
    note: 'Most congested band. Hub of Starlink Phase 1 & operational debris.',
    constellations: ['Starlink (~550 km)', 'ISS (~408 km)'],
  },
  {
    id: 'leo2',
    label: 'LEO — 600 to 1000 km',
    range: '600 – 1000 km',
    minKm: 600, maxKm: 1000,
    capacity: 30000,
    note: 'Van Allen inner fringe. Iridium, Planet Labs, debris clusters.',
    constellations: ['Iridium (~780 km)', 'Planet Labs', 'Debris bands'],
  },
  {
    id: 'leo3',
    label: 'LEO — 1000 to 2000 km',
    range: '1000 – 2000 km',
    minKm: 1000, maxKm: 2000,
    capacity: 20000,
    note: 'Inner Van Allen belt edge. OneWeb at 1200 km. Long debris lifetime.',
    constellations: ['OneWeb (~1200 km)', 'O3b (historical)'],
  },
  {
    id: 'meo',
    label: 'Medium Earth Orbit',
    range: '2000 – 20,000 km',
    minKm: 2000, maxKm: 20000,
    capacity: 5000,
    note: 'Van Allen radiation belts. GPS, Galileo, GLONASS navigation constellations.',
    constellations: ['GPS (~20,200 km)', 'Galileo (~23,222 km)', 'GLONASS (~19,100 km)'],
  },
  {
    id: 'geo',
    label: 'Geostationary Belt',
    range: '35,786 km (±300 km)',
    minKm: 35486, maxKm: 36086,
    capacity: 1800,
    note: 'Fixed slot allocations by ITU. ~560 active, remainder filed/planned.',
    constellations: ['Weather sats', 'Comms sats', 'Broadcasting'],
  },
];

const MU_KM3 = 3.986004418e5; // km³/s²
const RE_KM  = 6371;

function periodMin(altKm) {
  const a = RE_KM + altKm;
  return (2 * Math.PI * Math.sqrt(a * a * a / MU_KM3)) / 60;
}

function countInShell(tles, minKm, maxKm) {
  let sats = 0, debris = 0;
  for (const t of tles) {
    const n = t.meanMotion;
    if (!n || n <= 0) continue;
    const n_rad_s = n * (2 * Math.PI) / 86400;
    const a_km = Math.cbrt(MU_KM3 / (n_rad_s * n_rad_s));
    const alt = a_km - RE_KM;
    if (alt >= minKm && alt < maxKm) {
      if (t.category === 'debris' || (t.name || '').toUpperCase().includes('DEB')) {
        debris++;
      } else {
        sats++;
      }
    }
  }
  return { sats, debris, total: sats + debris };
}

export function createCapacityPanel({ onClose } = {}) {
  const panel  = document.getElementById('capacity-panel');
  const listEl = document.getElementById('cap-list');

  if (!panel) {
    console.warn('[CapacityPanel] #capacity-panel not found');
    return { show: () => {}, hide: () => {}, toggle: () => {}, isVisible: () => false, populate: () => {} };
  }

  document.getElementById('cap-close')?.addEventListener('click', () => { hide(); onClose?.(); });

  let _populated = false;

  function populate(tles) {
    if (!listEl) return;
    listEl.innerHTML = '';
    _populated = true;

    let totalTracked = 0;
    const shellData = SHELLS.map(sh => {
      const counts = countInShell(tles, sh.minKm, sh.maxKm);
      totalTracked += counts.total;
      const pct = Math.min(1, counts.total / sh.capacity);
      return { ...sh, ...counts, pct };
    });

    const headerEl = document.getElementById('cap-total');
    if (headerEl) headerEl.textContent = `${totalTracked.toLocaleString()} tracked objects`;

    for (const sh of shellData) {
      const pctVal = Math.round(sh.pct * 100);
      const barColor = sh.pct > 0.75 ? '#EF5350' : sh.pct > 0.40 ? '#FFB74D' : '#4FC3F7';
      const statusText = sh.pct > 0.75 ? 'CRITICAL' : sh.pct > 0.40 ? 'ELEVATED' : 'NOMINAL';
      const statusColor = sh.pct > 0.75 ? '#EF5350' : sh.pct > 0.40 ? '#FFB74D' : '#69F0AE';

      const avgAlt = Math.round((sh.minKm + sh.maxKm) / 2);
      const period = sh.id === 'geo' ? '1436.1 min' : `${periodMin(avgAlt).toFixed(1)} min`;

      const card = document.createElement('div');
      card.className = 'cap-card';
      card.innerHTML = `
        <div class="cap-card-header">
          <div class="cap-card-title">
            <span class="cap-shell-label">${sh.label}</span>
            <span class="cap-range">${sh.range}</span>
          </div>
          <span class="cap-status" style="color:${statusColor}">${statusText}</span>
        </div>
        <div class="cap-bar-wrap">
          <div class="cap-bar-track">
            <div class="cap-bar-fill" style="width:${pctVal}%;background:${barColor};box-shadow:0 0 6px ${barColor}55;"></div>
          </div>
          <span class="cap-pct">${pctVal}%</span>
        </div>
        <div class="cap-counts">
          <span class="cap-count-item"><span class="cap-count-val">${sh.sats.toLocaleString()}</span> active</span>
          <span class="cap-count-item"><span class="cap-count-val" style="color:#EF5350">${sh.debris.toLocaleString()}</span> debris</span>
          <span class="cap-count-item"><span class="cap-count-val" style="color:var(--text-dim)">${sh.capacity.toLocaleString()}</span> est. capacity</span>
          <span class="cap-count-item" style="color:var(--text-dim)">T = ${period}</span>
        </div>
        <div class="cap-note">${sh.note}</div>
      `;

      card.addEventListener('click', () => {
        const wasSelected = card.classList.contains('cap-card--selected');
        listEl.querySelectorAll('.cap-card--selected').forEach(c => c.classList.remove('cap-card--selected'));
        if (!wasSelected) {
          card.classList.add('cap-card--selected');
          window.dispatchEvent(new CustomEvent('cap-shell-select', { detail: sh }));
        } else {
          window.dispatchEvent(new CustomEvent('cap-shell-select', { detail: null }));
        }
      });

      listEl.appendChild(card);
    }

    // Footer: methodology note
    const footer = document.createElement('div');
    footer.className = 'cap-footer';
    footer.textContent = 'Capacity estimates based on ITU filing data and published orbital congestion studies. Values are indicative, not regulatory limits.';
    listEl.appendChild(footer);
  }

  function show() { panel.classList.remove('hidden'); }
  function hide() { panel.classList.add('hidden'); }
  function toggle() {
    const visible = !panel.classList.contains('hidden');
    if (visible) hide(); else show();
    return !visible;
  }
  function isVisible() { return !panel.classList.contains('hidden'); }

  return { show, hide, toggle, isVisible, populate };
}
