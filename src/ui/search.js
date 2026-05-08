
import { CONSTELLATION_CATALOG } from '../layers/constellations.js';

const CONST_LIST = Object.entries(CONSTELLATION_CATALOG).map(([abbr, info]) => ({
  abbr,
  name:    info.name,
  nameLow: info.name.toLowerCase(),
  abbrLow: abbr.toLowerCase(),
  kind:    'constellation',
}));

export function createSearch(getTleData, onSelect, flyTo, skyOpts = {}) {
  const overlay = document.getElementById('search-overlay');
  const input   = document.getElementById('search-input');
  const results = document.getElementById('search-results');

  if (!overlay || !input || !results) {
    console.warn('[Search] DOM elements not found');
    return { open: () => {}, close: () => {} };
  }

  function open() {
    overlay.classList.remove('hidden');
    input.value = '';
    results.innerHTML = '';
    requestAnimationFrame(() => input.focus());
  }

  function close() {
    overlay.classList.add('hidden');
    results.innerHTML = '';
  }

  function doSearch() {
    const raw = input.value.trim();
    if (!raw) { results.innerHTML = ''; return; }

    const q = raw.toLowerCase();
    const items = [];

    const tles = getTleData();
    for (let i = 0; i < tles.length && items.length < 6; i++) {
      const tle = tles[i];
      if (tle.name.toLowerCase().includes(q) || String(tle.norad).includes(q)) {
        items.push({
          kind: 'sat',
          label: tle.name,
          sub: `${tle.norad} · ${(tle.category ?? 'leo').toUpperCase()}`,
          satIdx: i,
          tle,
        });
      }
    }

    if (skyOpts.getSkyObjects) {
      const dsos = skyOpts.getSkyObjects();
      for (const dso of dsos) {
        if (items.length >= 10) break;
        const haystack = (dso.name + ' ' + (dso.designation ?? '') + ' ' + (dso.constellation ?? '')).toLowerCase();
        if (haystack.includes(q)) {
          items.push({
            kind: 'dso',
            label: dso.name,
            sub: `${dso.designation ?? ''} · ${dso.constellation ?? ''}`.replace(/^ · | · $/,''),
            dso,
          });
        }
      }
    }

    const constHits = CONST_LIST.filter(c =>
      c.nameLow.includes(q) || c.abbrLow === q
    ).sort((a, b) => {

      const aStart = a.nameLow.startsWith(q) ? 0 : 1;
      const bStart = b.nameLow.startsWith(q) ? 0 : 1;
      return aStart - bStart;
    }).slice(0, 4);

    for (const c of constHits) {
      if (items.length >= 12) break;
      items.push({
        kind: 'constellation',
        label: c.name,
        sub: `Constellation · ${c.abbr}`,
        abbr: c.abbr,
      });
    }

    renderResults(items);
  }

  function renderResults(items) {
    results.innerHTML = '';

    for (const item of items) {
      const li = document.createElement('li');
      li.dataset.label = item.label;

      const badge = document.createElement('span');
      badge.style.cssText = 'opacity:0.4; font-size:11px; margin-left:5px; text-transform:uppercase;';

      if (item.kind === 'sat') {
        li.textContent = item.label;
        badge.textContent = item.sub;
        li.appendChild(badge);
        li.addEventListener('click', () => {
          onSelect(item.satIdx, item.tle);
          const dist = flyDistForCategory(item.tle.category);
          flyTo?.(dist);
          close();
        });
      } else if (item.kind === 'dso') {
        const typePrefix = document.createElement('span');
        typePrefix.style.cssText = 'color:var(--cyan); margin-right:6px; font-size:11px;';
        typePrefix.textContent = '✦';
        li.appendChild(typePrefix);
        li.appendChild(document.createTextNode(item.label));
        badge.textContent = item.sub;
        li.appendChild(badge);
        li.addEventListener('click', () => {
          skyOpts.onSelectDso?.(item.dso);
          close();
        });
      } else if (item.kind === 'constellation') {
        const typePrefix = document.createElement('span');
        typePrefix.style.cssText = 'color:#88aadd; margin-right:6px; font-size:11px;';
        typePrefix.textContent = '⊹';
        li.appendChild(typePrefix);
        li.appendChild(document.createTextNode(item.label));
        badge.textContent = item.sub;
        li.appendChild(badge);
        li.addEventListener('click', () => {
          skyOpts.onSelectConstellation?.(item.abbr);
          close();
        });
      }

      results.appendChild(li);
    }
  }

  input.addEventListener('input', doSearch);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key === 'Enter') {
      const target = results.querySelector('li.active') || results.querySelector('li');
      if (target) target.click();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = Array.from(results.querySelectorAll('li'));
      if (items.length === 0) return;
      const active = results.querySelector('li.active');
      let next;
      if (!active) {
        next = e.key === 'ArrowDown' ? items[0] : items[items.length - 1];
      } else {
        const i = items.indexOf(active);
        active.classList.remove('active');
        next = e.key === 'ArrowDown'
          ? items[(i + 1) % items.length]
          : items[(i - 1 + items.length) % items.length];
      }
      next.classList.add('active');
      next.scrollIntoView({ block: 'nearest' });
      input.value = next.dataset.label ?? next.textContent.trim();
    }
  });

  const _docClickHandler = (e) => {
    if (!overlay.contains(e.target)) close();
  };
  document.addEventListener('click', _docClickHandler);

  function destroy() {
    document.removeEventListener('click', _docClickHandler);
  }

  return { open, close, destroy };
}

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
