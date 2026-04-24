
export function createSearch(getTleData, onSelect, flyTo) {
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

    const q      = raw.toLowerCase();
    const tles   = getTleData();
    const hits   = [];

    for (let i = 0; i < tles.length; i++) {
      const tle = tles[i];
      if (
        tle.name.toLowerCase().includes(q) ||
        String(tle.norad).includes(q)
      ) {
        hits.push(i);
        if (hits.length >= 10) break;
      }
    }

    renderResults(hits, tles);
  }

  function renderResults(indices, tles) {
    results.innerHTML = '';

    for (const idx of indices) {
      const tle = tles[idx];
      const li  = document.createElement('li');

      const cat   = tle.category ?? 'leo';
      const norad = tle.norad ?? '—';
      li.textContent = `${tle.name}`;
      li.dataset.satName = tle.name;

      const badge = document.createElement('span');
      badge.textContent = ` ${norad} · ${cat.toUpperCase()}`;
      badge.style.cssText = 'opacity:0.4; font-size:9px; margin-left:4px';
      li.appendChild(badge);

      li.addEventListener('click', () => {
        selectResult(idx, tle);
      });

      results.appendChild(li);
    }
  }

  function selectResult(idx, tle) {
    onSelect(idx, tle);

    const dist = flyDistForCategory(tle.category);
    if (flyTo) flyTo(dist);

    close();
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
      input.value = next.dataset.satName ?? next.textContent.trim();
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
    case 'station':  return 20;    // LEO — very close
    case 'starlink': return 20;    // LEO
    case 'oneweb':   return 20;    // LEO
    case 'leo':      return 20;    // LEO
    case 'debris':   return 20;    // mixed, default to LEO altitude
    case 'meo':      return 50;    // Medium Earth Orbit
    case 'geo':      return 100;   // GEO — just outside GEO belt
    default:         return 25;
  }
}
