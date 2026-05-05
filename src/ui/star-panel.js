
import { altAz, bestObservingMonth, bsAsVisibility } from '../utils/sky-math.js';

const BSAS_LAT = -34.6131;
const BSAS_LON = -58.3772;

export function createStarPanel(opts = {}) {
  const { onClose } = opts;

  const panel = document.getElementById('star-panel');
  if (!panel) {
    console.warn('[StarPanel] #star-panel not found');
    return { show: () => {}, hide: () => {}, update: () => {}, isVisible: () => false };
  }

  let _star = null;

  const nameEl    = document.getElementById('sp-name');
  const bayerEl   = document.getElementById('sp-bayer');
  const spectralEl= document.getElementById('sp-spectral');
  const distEl    = document.getElementById('sp-distance');
  const magEl     = document.getElementById('sp-magnitude');
  const cultureEl = document.getElementById('sp-culture');
  const meaningEl = document.getElementById('sp-meaning');
  const descEl    = document.getElementById('sp-desc');
  const altEl     = document.getElementById('sp-alt');
  const azEl      = document.getElementById('sp-az');
  const dirEl     = document.getElementById('sp-dir');
  const visTag    = document.getElementById('sp-vis-tag');
  const bestEl    = document.getElementById('sp-best-month');
  const noteEl    = document.getElementById('sp-visibility-note');
  const dotEl     = document.getElementById('sp-dot');

  document.getElementById('sp-close')?.addEventListener('click', () => { hide(); onClose?.(); });

  function show(star, simTime) {
    _star = star;

    if (nameEl)    nameEl.textContent    = star.name.toUpperCase();
    if (bayerEl)   bayerEl.textContent   = star.bayer;
    if (dotEl)     dotEl.style.background = star.color;
    if (spectralEl)spectralEl.textContent= star.spectral;
    if (distEl)    distEl.textContent    = star.distance < 100
      ? `${star.distance} ly`
      : `${star.distance.toLocaleString()} ly`;
    if (magEl)     magEl.textContent     = star.magnitude.toFixed(2);
    if (cultureEl) cultureEl.textContent = star.culture;
    if (meaningEl) meaningEl.textContent = star.meaning;
    if (descEl)    descEl.textContent    = star.desc;
    if (bestEl)    bestEl.textContent    = bestObservingMonth(star.raDeg);
    if (noteEl)    noteEl.textContent    = bsAsVisibility(star.decDeg);

    _refreshSkyPos(simTime ?? Date.now());
    panel.classList.remove('hidden');
  }

  function hide() {
    panel.classList.add('hidden');
    _star = null;
  }

  function isVisible() {
    return !panel.classList.contains('hidden');
  }

  function update(simTime) {
    if (!_star) return;
    _refreshSkyPos(simTime);
  }

  function _refreshSkyPos(simTime) {
    if (!_star) return;
    const sky = altAz(_star.raDeg, _star.decDeg, simTime, BSAS_LAT, BSAS_LON);

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
