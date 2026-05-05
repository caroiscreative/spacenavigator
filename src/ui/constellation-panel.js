
import { CONSTELLATION_CATALOG } from '../layers/constellations.js';
import { vec3ToRaDec, altAz, bestObservingMonth, bsAsVisibility } from '../utils/sky-math.js';

// Buenos Aires observer coordinates
const BSAS_LAT = -34.6131;
const BSAS_LON = -58.3772;

export function createConstellationPanel(opts = {}) {
  const { onClose } = opts;

  const panel = document.getElementById('constellation-panel');
  if (!panel) {
    console.warn('[ConstellationPanel] #constellation-panel not found in DOM');
    return { show: () => {}, hide: () => {}, update: () => {}, isVisible: () => false };
  }

  let _currentAbbr = null;
  let _currentRA   = null;
  let _currentDec  = null;

  const nameEl     = document.getElementById('cp-name');
  const abbrEl     = document.getElementById('cp-abbr');
  const originEl   = document.getElementById('cp-origin');
  const descEl     = document.getElementById('cp-desc');
  const altEl      = document.getElementById('cp-alt');
  const azEl       = document.getElementById('cp-az');
  const dirEl      = document.getElementById('cp-dir');
  const visTag     = document.getElementById('cp-vis-tag');
  const bestEl     = document.getElementById('cp-best-month');
  const notesEl    = document.getElementById('cp-visibility-note');

  document.getElementById('cp-close')?.addEventListener('click', () => { hide(); onClose?.(); });

  function show(abbr, centroid3d, simTime) {
    const info = CONSTELLATION_CATALOG[abbr];
    if (!info) return;

    _currentAbbr = abbr;

    // Back-convert centroid 3D direction to RA/Dec
    const { raDeg, decDeg } = vec3ToRaDec(centroid3d.x, centroid3d.y, centroid3d.z);
    _currentRA  = raDeg;
    _currentDec = decDeg;

    if (nameEl)   nameEl.textContent   = info.name.toUpperCase();
    if (abbrEl)   abbrEl.textContent   = abbr;
    if (originEl) originEl.textContent = `${info.origin} · ${info.year}`;
    if (descEl)   descEl.textContent   = info.desc;
    if (bestEl)   bestEl.textContent   = bestObservingMonth(raDeg);
    if (notesEl)  notesEl.textContent  = bsAsVisibility(decDeg);

    _refreshSkyPos(simTime ?? Date.now());
    panel.classList.remove('hidden');
  }

  function hide() {
    panel.classList.add('hidden');
    _currentAbbr = null;
    _currentRA   = null;
    _currentDec  = null;
  }

  function isVisible() {
    return !panel.classList.contains('hidden');
  }

  function update(simTime) {
    if (_currentRA === null) return;
    _refreshSkyPos(simTime);
  }

  function _refreshSkyPos(simTime) {
    const sky = altAz(_currentRA, _currentDec, simTime, BSAS_LAT, BSAS_LON);

    if (altEl) altEl.textContent = sky.altDeg.toFixed(1) + '°';
    if (azEl)  azEl.textContent  = sky.azDeg.toFixed(1)  + '°';
    if (dirEl) dirEl.textContent = sky.azCardinal;

    if (visTag) {
      if (sky.visible && sky.altDeg > 10) {
        visTag.textContent = 'VISIBLE';
        visTag.className = 'cp-vis-tag visible';
      } else if (sky.visible) {
        visTag.textContent = 'NEAR HORIZON';
        visTag.className = 'cp-vis-tag near';
      } else {
        visTag.textContent = 'BELOW HORIZON';
        visTag.className = 'cp-vis-tag hidden-sky';
      }
    }
  }

  return { show, hide, update, isVisible };
}
