
import { ALL_DSOS } from '../data/galaxy-catalog.js';

const GALAXY_TYPES    = new Set(['spiral', 'elliptical', 'irregular']);
const NEBULA_TYPES    = new Set(['emission', 'planetary', 'remnant', 'reflection']);
const BLACKHOLE_TYPES = new Set(['blackhole']);

const INTERSTELLAR_OBJECTS = [
  {
    name:  "1I / ʻOumuamua",
    sub:   "First interstellar object · 2017",
    color: '#CE93D8',
    imageUrl:    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/This_artist%27s_impression_shows_the_first_interstellar_object_discovered_in_the_Solar_System%2C_%60Oumuamua.jpg/480px-This_artist%27s_impression_shows_the_first_interstellar_object_discovered_in_the_Solar_System%2C_%60Oumuamua.jpg',
    imageCredit: 'ESO / M. Kornmesser (artist concept)',
    rows: [
      ['Type',       'Unknown (comet / asteroid)'],
      ['Eccentricity', '1.2011 (hyperbolic)'],
      ['Perihelion', 'Sep 9, 2017 · 0.255 AU'],
      ['Inclination', '122.7°'],
      ['Speed at ∞', '26.3 km/s'],
      ['Discovered', 'Oct 19, 2017 — R. Weryk'],
    ],
  },
  {
    name:  "2I / Borisov",
    sub:   "First interstellar comet · 2019",
    color: '#80DEEA',
    imageUrl:    'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/2I_Borisov_HST.png/480px-2I_Borisov_HST.png',
    imageCredit: 'NASA / ESA / D. Jewitt (UCLA) — Hubble',
    rows: [
      ['Type',       'Active comet (CO, H₂O coma)'],
      ['Eccentricity', '3.3564 (hyperbolic)'],
      ['Perihelion', 'Dec 8, 2019 · 2.006 AU'],
      ['Inclination', '44.1°'],
      ['Speed at ∞', '32.1 km/s'],
      ['Discovered', 'Aug 30, 2019 — G. Borisov'],
    ],
  },
  {
    name:  "3I / ATLAS",
    sub:   "Third interstellar object · 2025",
    color: '#FFB347',
    imageUrl:    null,
    imageCredit: null,
    rows: [
      ['Type',       'Active comet'],
      ['Eccentricity', '>1 (hyperbolic)'],
      ['Perihelion', 'Oct 2025 · ~0.4 AU'],
      ['Inclination', '~160°'],
      ['Speed at ∞', '~67 km/s'],
      ['Discovered', 'Jul 1, 2025 — ATLAS survey'],
    ],
  },
];

const SAT_CATEGORY_META = {
  starlink: { label: 'Starlink',       color: '#4FC3F7', sub: 'SpaceX broadband constellation' },
  leo:      { label: 'LEO',            color: '#4FC3F7', sub: 'Low Earth Orbit operational' },
  geo:      { label: 'GEO',            color: '#FFB300', sub: 'Geostationary operational' },
  oneweb:   { label: 'OneWeb',         color: '#80DEEA', sub: 'LEO broadband constellation' },
  meo:      { label: 'MEO / GNSS',     color: '#A5D6A7', sub: 'GPS · GLONASS · Galileo · BeiDou' },
  station:  { label: 'Space Stations', color: '#FFFFFF', sub: 'ISS · Tiangong · crewed' },
};

const DEBRIS_GROUP_META = {
  fengyun:  { label: 'Fengyun',          color: '#FF4455', sub: 'Chinese weather sat · ASAT test 2007' },
  cosmos:   { label: 'Cosmos',           color: '#FF6B6B', sub: 'Russian satellites & rocket bodies' },
  iridium:  { label: 'Iridium',          color: '#FF4455', sub: 'Iridium–Cosmos collision · 2009' },
  breeze:   { label: 'Breeze-M',         color: '#FF6B6B', sub: 'Russian Proton upper stage' },
  sl:       { label: 'SL Rocket Bodies', color: '#FF8A80', sub: 'Soviet / Russian rocket stages' },
  cz:       { label: 'Long March (CZ)',  color: '#FF8A80', sub: 'Chinese rocket stages' },
  ariane:   { label: 'Ariane',           color: '#FF6B6B', sub: 'European rocket stages' },
  delta:    { label: 'Delta',            color: '#FF8A80', sub: 'US rocket stages' },
  titan:    { label: 'Titan',            color: '#FF8A80', sub: 'US rocket stages' },
  atlas:    { label: 'Atlas',            color: '#FF8A80', sub: 'US rocket stages' },
  other:    { label: 'Other',            color: '#EF5350', sub: 'Various missions' },
};

function debrisGroupKey(name) {
  const n = name.toUpperCase();
  if (n.includes('FENGYUN'))  return 'fengyun';
  if (n.includes('COSMOS'))   return 'cosmos';
  if (n.includes('IRIDIUM'))  return 'iridium';
  if (n.includes('BREEZE'))   return 'breeze';
  if (/\bSL-\d/.test(n))      return 'sl';
  if (/\bCZ-/.test(n))        return 'cz';
  if (n.includes('ARIANE'))   return 'ariane';
  if (n.includes('DELTA'))    return 'delta';
  if (n.includes('TITAN'))    return 'titan';
  if (n.includes('ATLAS'))    return 'atlas';
  return 'other';
}

const MAX_RESULTS = 15;

function flyDistForCategory(category) {
  switch (category) {
    case 'station':  return 20;
    case 'starlink': return 20;
    case 'oneweb':   return 20;
    case 'leo':      return 20;
    case 'debris':   return 20;
    case 'meo':      return 50;
    case 'geo':      return 100;
    default:         return 25;
  }
}

function catColor(cat) {
  switch (cat) {
    case 'station':  return '#FFFFFF';
    case 'starlink':
    case 'oneweb':
    case 'leo':      return '#4FC3F7';
    case 'geo':      return '#FFB300';
    case 'meo':      return '#A5D6A7';
    case 'debris':   return '#EF5350';
    default:         return '#78909C';
  }
}

export function createExplorerPanel({ onSelectDso, getTleData, onSelectSat, onSelectGroup, flyTo }) {
  const panelEl = document.getElementById('explorer-panel');
  if (!panelEl) return null;

  const bodyEl    = panelEl.querySelector('#explorer-body');
  const countEl   = panelEl.querySelector('#explorer-count');
  const searchWrap = panelEl.querySelector('#exp-search-wrap');
  const searchInput = panelEl.querySelector('#exp-search-input');

  let activeTab   = 'galaxies';
  let activeGroup = null;   // null = group list view; string = drilled-in group key

  panelEl.querySelector('#explorer-close')
    ?.addEventListener('click', hide);

  panelEl.querySelectorAll('.exp-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeTab = tab.dataset.tab;
      syncTabs();
      renderBody();
    });
  });

  searchInput?.addEventListener('input', () => renderBody());
  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); searchInput.value = ''; renderBody(); }
    if (e.key === 'Enter') {
      const first = bodyEl.querySelector('.exp-row');
      if (first) first.click();
    }
  });

  function formatDist(dso) {
    const d = dso.distance;
    const u = dso.distUnit;
    if (u === 'Gly') return `${d} Gly`;
    if (u === 'Mly') return `${d} Mly`;
    if (d >= 10000) return `${(d / 1000).toFixed(0)}k ly`;
    if (d >= 1000)  return `${(d / 1000).toFixed(1)}k ly`;
    return `${d.toLocaleString()} ${u}`;
  }

  function typeLabel(type) {
    const labels = {
      spiral:     'Spiral',
      elliptical: 'Elliptical',
      irregular:  'Irregular',
      emission:   'Emission',
      planetary:  'Planetary',
      remnant:    'Remnant',
      reflection: 'Reflection',
      blackhole:  'Black Hole',
    };
    return labels[type] ?? type;
  }

  function makeDsoRow(dso, valueText) {
    const el = document.createElement('div');
    el.className = 'exp-row';
    el.innerHTML = `
      <span class="exp-dot" style="background:${dso.color}"></span>
      <span class="exp-name">${dso.name}</span>
      <span class="exp-val">${valueText}</span>`;
    el.addEventListener('click', () => {
      bodyEl.querySelectorAll('.exp-row.selected').forEach(r => r.classList.remove('selected'));
      el.classList.add('selected');
      onSelectDso(dso);
    });
    return el;
  }

  function makeIntlCard(obj) {
    const card = document.createElement('div');
    card.className = 'exp-intl-card';
    const imgHtml = obj.imageUrl ? `
      <div class="exp-intl-thumb-wrap">
        <img class="exp-intl-thumb"
             src="${obj.imageUrl}"
             alt="${obj.name}"
             loading="lazy"
             onerror="this.parentElement.style.display='none'">
        <span class="exp-intl-thumb-credit">${obj.imageCredit ?? ''}</span>
      </div>` : '';
    card.innerHTML = `
      <div class="exp-intl-name" style="color:${obj.color}">${obj.name}</div>
      <div class="exp-intl-sub">${obj.sub}</div>
      ${imgHtml}
      ${obj.rows.map(([l, v]) => `
        <div class="exp-intl-row">
          <span class="exp-intl-label">${l}</span>
          <span class="exp-intl-val">${v}</span>
        </div>`).join('')}`;
    return card;
  }

  function makeSatRow(idx, tle) {
    const el = document.createElement('div');
    el.className = 'exp-row';
    const color = catColor(tle.category);
    const norad = tle.norad ?? '—';
    el.innerHTML = `
      <span class="exp-dot" style="background:${color}"></span>
      <span class="exp-name">${tle.name}</span>
      <span class="exp-val exp-norad">${norad}</span>`;
    el.addEventListener('click', () => {
      bodyEl.querySelectorAll('.exp-row.selected').forEach(r => r.classList.remove('selected'));
      el.classList.add('selected');
      if (onSelectSat) onSelectSat(idx, tle);
    });
    return el;
  }

  function renderSatBody(debrisOnly) {
    bodyEl.innerHTML = '';
    const tles = getTleData ? getTleData() : [];

    if (!tles.length) {
      bodyEl.innerHTML = '<div class="exp-empty">TLE data loading…</div>';
      countEl.textContent = '—';
      return;
    }

    if (activeGroup === null) {
      if (searchWrap) searchWrap.classList.add('hidden');
      renderGroupList(tles, debrisOnly);
    } else {
      if (searchWrap) searchWrap.classList.remove('hidden');
      renderIndividualList(tles, debrisOnly);
    }
  }

  function renderGroupList(tles, debrisOnly) {
    const countMap = {};
    let total = 0;

    for (const tle of tles) {
      if (debrisOnly ? tle.category !== 'debris' : tle.category === 'debris') continue;
      const key = debrisOnly ? debrisGroupKey(tle.name) : tle.category;
      countMap[key] = (countMap[key] || 0) + 1;
      total++;
    }

    const groups = Object.entries(countMap)
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);

    countEl.textContent = `${total.toLocaleString()} tracked`;

    const maxCount = groups[0]?.count || 1;

    groups.forEach(({ key, count }) => {
      const meta = debrisOnly
        ? (DEBRIS_GROUP_META[key] || { label: key, color: '#EF5350', sub: '' })
        : (SAT_CATEGORY_META[key] || { label: key, color: '#4FC3F7', sub: '' });

      const pct = Math.max(4, (count / maxCount) * 100).toFixed(1);

      const el = document.createElement('div');
      el.className = 'exp-group-row';
      el.innerHTML = `
        <div class="exp-group-top">
          <span class="exp-dot" style="background:${meta.color}"></span>
          <span class="exp-group-label">${meta.label}</span>
          <span class="exp-group-count">${count.toLocaleString()}</span>
          <span class="exp-group-chev">›</span>
        </div>
        <div class="exp-group-sub">${meta.sub}</div>
        <div class="exp-group-bar-track">
          <div class="exp-group-bar" style="width:${pct}%;background:${meta.color}22;border-right:2px solid ${meta.color}80"></div>
        </div>`;

      el.addEventListener('click', () => {
        if (onSelectGroup) {
          const norads = new Set();
          for (const t of tles) {
            if (debrisOnly ? t.category !== 'debris' : t.category === 'debris') continue;
            const k = debrisOnly ? debrisGroupKey(t.name) : t.category;
            if (k === key && t.norad != null) norads.add(t.norad);
          }
          onSelectGroup(norads);
        }
        activeGroup = key;
        if (searchInput) searchInput.value = '';
        renderBody();
      });

      bodyEl.appendChild(el);
    });
  }

  function renderIndividualList(tles, debrisOnly) {
    const query = (searchInput?.value ?? '').trim().toLowerCase();

    const meta = debrisOnly
      ? (DEBRIS_GROUP_META[activeGroup] || { label: activeGroup, color: '#EF5350' })
      : (SAT_CATEGORY_META[activeGroup] || { label: activeGroup, color: '#4FC3F7' });

    const backEl = document.createElement('div');
    backEl.className = 'exp-back-row';
    backEl.innerHTML = `
      <button class="exp-back-btn">‹ Back</button>
      <span class="exp-back-label" style="color:${meta.color}">${meta.label}</span>
      <button class="exp-select-all-btn">Select All</button>`;
    backEl.querySelector('.exp-back-btn').addEventListener('click', () => {
      if (onSelectGroup) onSelectGroup(null);  // clear globe highlight
      activeGroup = null;
      if (searchInput) searchInput.value = '';
      renderBody();
    });
    backEl.querySelector('.exp-select-all-btn').addEventListener('click', () => {
      if (!onSelectGroup) return;
      const norads = new Set();
      for (const t of tles) {
        if (debrisOnly ? t.category !== 'debris' : t.category === 'debris') continue;
        const k = debrisOnly ? debrisGroupKey(t.name) : t.category;
        if (k === activeGroup && t.norad != null) norads.add(t.norad);
      }
      onSelectGroup(norads);
    });
    bodyEl.appendChild(backEl);

    let groupTotal  = 0;
    let queryHits   = 0;
    const hits      = [];

    for (let i = 0; i < tles.length; i++) {
      const tle = tles[i];
      if (debrisOnly ? tle.category !== 'debris' : tle.category === 'debris') continue;
      const key = debrisOnly ? debrisGroupKey(tle.name) : tle.category;
      if (key !== activeGroup) continue;
      groupTotal++;

      if (!query) {
        if (hits.length < MAX_RESULTS) hits.push(i);
      } else {
        const match =
          tle.name.toLowerCase().includes(query) ||
          String(tle.norad ?? '').includes(query);
        if (match) {
          queryHits++;
          if (hits.length < MAX_RESULTS) hits.push(i);
        }
      }
    }

    if (query) {
      countEl.textContent = `${queryHits} result${queryHits !== 1 ? 's' : ''}`;
    } else {
      countEl.textContent = `${groupTotal.toLocaleString()} objects`;
    }

    if (query && queryHits === 0) {
      const empty = document.createElement('div');
      empty.className = 'exp-empty';
      empty.textContent = 'No results';
      bodyEl.appendChild(empty);
      return;
    }

    hits.forEach(i => bodyEl.appendChild(makeSatRow(i, tles[i])));

    const shown    = hits.length;
    const hasMore  = query ? queryHits > shown : groupTotal > shown;
    if (hasMore) {
      const total  = query ? queryHits : groupTotal;
      const hint   = document.createElement('div');
      hint.className = 'exp-empty-hint';
      hint.textContent = `Showing ${shown} of ${total.toLocaleString()} — search to filter`;
      bodyEl.appendChild(hint);
    }
  }

  function renderBody() {
    const isOrbitTab = activeTab === 'satellites' || activeTab === 'debris';
    if (!isOrbitTab && searchWrap) searchWrap.classList.add('hidden');

    if (activeTab === 'galaxies') {
      const items = ALL_DSOS.filter(d => GALAXY_TYPES.has(d.type));
      countEl.textContent = `${items.length} objects`;
      bodyEl.innerHTML = '';
      items.forEach(dso => bodyEl.appendChild(makeDsoRow(dso, formatDist(dso))));

    } else if (activeTab === 'blackholes') {
      const items = ALL_DSOS.filter(d => BLACKHOLE_TYPES.has(d.type));
      countEl.textContent = `${items.length} objects`;
      bodyEl.innerHTML = '';
      items.forEach(dso => bodyEl.appendChild(makeDsoRow(dso, dso.mass ?? '—')));

    } else if (activeTab === 'nebulas') {
      const items = ALL_DSOS.filter(d => NEBULA_TYPES.has(d.type));
      countEl.textContent = `${items.length} objects`;
      bodyEl.innerHTML = '';
      items.forEach(dso => bodyEl.appendChild(makeDsoRow(dso, formatDist(dso))));

    } else if (activeTab === 'interstellar') {
      countEl.textContent = `${INTERSTELLAR_OBJECTS.length} objects`;
      bodyEl.innerHTML = '';
      INTERSTELLAR_OBJECTS.forEach(obj => bodyEl.appendChild(makeIntlCard(obj)));

    } else if (activeTab === 'satellites') {
      renderSatBody(false);

    } else if (activeTab === 'debris') {
      renderSatBody(true);
    }
  }

  function syncTabs() {
    panelEl.querySelectorAll('.exp-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.tab === activeTab));
    if (activeGroup !== null && onSelectGroup) onSelectGroup(null);
    activeGroup = null;
    if (searchInput) searchInput.value = '';
  }

  function show() {
    panelEl.classList.add('visible');
    syncTabs();
    renderBody();
  }

  function hide() {
    panelEl.classList.remove('visible');
  }

  function toggle() {
    if (panelEl.classList.contains('visible')) hide(); else show();
  }

  function isVisible() { return panelEl.classList.contains('visible'); }

  return { show, hide, toggle, isVisible };
}
