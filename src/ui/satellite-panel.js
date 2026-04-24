
import * as THREE from 'three/webgpu';

const GM              = 398600.4418;
const EARTH_RADIUS_KM = 6371.0;
const KM_PER_UNIT     = 500;

const CATEGORY_LABEL = {
  station:  'SPACE STATION',
  starlink: 'STARLINK',
  oneweb:   'ONEWEB',
  debris:   'DEBRIS / R.B.',
  geo:      'GEOSTATIONARY',
  meo:      'MEDIUM ORBIT',
  leo:      'LOW EARTH ORBIT',
};

const CATEGORY_COLOR = {
  station:  '#FFFFFF',
  starlink: '#4FC3F7',
  oneweb:   '#80CBC4',
  debris:   '#EF5350',
  geo:      '#CE93D8',
  meo:      '#81C784',
  leo:      '#4FC3F7',
};

const PIECE_ROLE = {
  A: 'Primary payload',
  B: 'Secondary object',
  C: 'Tertiary object',
};
function pieceRole(p) {
  if (!p) return '';
  if (p === 'A') return 'Primary payload';
  if (/^[A-Z]$/.test(p)) return 'Co-manifested object';
  return 'Debris fragment';
}

export function createSatellitePanel(getTLECatalog = () => []) {
  const panel = document.getElementById('sat-panel');
  if (!panel) {
    console.warn('[SatPanel] #sat-panel element not found in DOM');
    return { show: () => {}, hide: () => {}, isVisible: () => false };
  }

  document.getElementById('sat-panel-close')
    ?.addEventListener('click', () => hide());

  function show(tle, position) {
    const radiusKm  = position.length() * KM_PER_UNIT;
    const altKm     = Math.max(0, radiusKm - EARTH_RADIUS_KM);
    const velKms    = Math.sqrt(GM / radiusKm);
    const periodMin = 1440 / tle.meanMotion;

    const catLabel = CATEGORY_LABEL[tle.category] ?? tle.category.toUpperCase();
    const catColor = CATEGORY_COLOR[tle.category] ?? '#4FC3F7';

    panel.querySelector('#sp-name').textContent  = tle.name;
    panel.querySelector('#sp-norad').textContent = tle.norad;
    panel.querySelector('#sp-type').textContent  = catLabel;
    panel.querySelector('#sp-type').style.color  = catColor;

    panel.querySelector('#sp-alt').textContent    = `${altKm.toFixed(0)} km`;
    panel.querySelector('#sp-vel').textContent    = `${velKms.toFixed(2)} km/s`;
    panel.querySelector('#sp-inc').textContent    = `${tle.inclDeg.toFixed(2)}°`;
    panel.querySelector('#sp-period').textContent = formatPeriod(periodMin);

    _renderLaunchGroup(tle);

    _renderSatThumb(tle);

    panel.classList.remove('hidden');
  }

  function hide() {
    panel.classList.add('hidden');
    window.dispatchEvent(new CustomEvent('launch-group-clear'));
  }

  function isVisible() {
    return !panel.classList.contains('hidden');
  }

  function _renderLaunchGroup(tle) {
    let section = document.getElementById('sp-launch-section');
    if (!section) return;

    if (!tle.launchGroup) {
      section.style.display = 'none';
      return;
    }
    section.style.display = '';

    const header = document.getElementById('sp-launch-group-id');
    if (header) {
      header.textContent = tle.launchGroup;
    }

    const role = document.getElementById('sp-launch-piece');
    if (role) {
      role.textContent = tle.launchPiece
        ? `Piece ${tle.launchPiece} — ${pieceRole(tle.launchPiece)}`
        : '—';
    }

    const yearEl = document.getElementById('sp-launch-year');
    if (yearEl) yearEl.textContent = tle.launchYear ?? '—';

    const catalog = getTLECatalog();
    const siblings = catalog.filter(
      t => t.launchGroup === tle.launchGroup && t.norad !== tle.norad,
    );
    const allInGroup = [tle, ...siblings];

    const countEl = document.getElementById('sp-launch-count');
    if (countEl) {
      countEl.textContent = siblings.length > 0
        ? `${allInGroup.length} objects tracked`
        : 'Only tracked object in this launch';
    }

    const listEl = document.getElementById('sp-launch-list');
    if (listEl) {
      if (siblings.length === 0) {
        listEl.innerHTML = '<div class="sp-launch-empty">No co-manifested objects in catalog</div>';
      } else {
        listEl.innerHTML = siblings.map(s => {
          const piece  = s.launchPiece ?? '?';
          const role   = pieceRole(piece);
          const color  = CATEGORY_COLOR[s.category] ?? '#4FC3F7';
          return `<div class="sp-sibling-row">
            <span class="sp-sibling-piece" style="color:${color}">${piece}</span>
            <span class="sp-sibling-name">${s.name}</span>
            <span class="sp-sibling-norad">${s.norad}</span>
          </div>`;
        }).join('');
      }
    }

    const btnHighlight = document.getElementById('sp-launch-highlight');
    if (btnHighlight) {
      if (siblings.length > 0) {
        btnHighlight.style.display = '';
        const freshBtn = btnHighlight.cloneNode(true);
        btnHighlight.parentNode.replaceChild(freshBtn, btnHighlight);
        freshBtn.addEventListener('click', () => {
          const norads = new Set(allInGroup.map(t => t.norad));
          window.dispatchEvent(new CustomEvent('launch-group-select', {
            detail: { launchGroup: tle.launchGroup, norads },
          }));
          freshBtn.classList.toggle('active');
        });
      } else {
        btnHighlight.style.display = 'none';
      }
    }
  }

  const SAT_IMAGES = {
    25544: {  // ISS — photo from STS-134 fly-around, May 2011
      url:    'https://images-assets.nasa.gov/image/iss027e036027/iss027e036027~small.jpg',
      credit: 'NASA',
    },
    20580: {  // Hubble Space Telescope — SM4 servicing mission photo, 2009
      url:    'https://images-assets.nasa.gov/image/sts125-s-1/sts125-s-1~small.jpg',
      credit: 'NASA',
    },
    43205: {  // Tiangong Space Station — Shenzhou-14 rendezvous photo, 2022
      url:    'https://images-assets.nasa.gov/image/tiangong-space-station/tiangong-space-station~small.jpg',
      credit: 'CNSA',
    },
  };

  function _renderSatThumb(tle) {
    const wrap   = document.getElementById('sp-sat-thumb-wrap');
    const img    = document.getElementById('sp-sat-thumb');
    const credit = document.getElementById('sp-sat-credit');
    if (!wrap || !img) return;

    const match = SAT_IMAGES[tle.norad];
    if (match) {
      img.alt    = tle.name;
      img.onerror = () => { wrap.classList.add('hidden'); };
      img.src    = match.url;
      credit.textContent = match.credit;
      wrap.classList.remove('hidden');
    } else {
      wrap.classList.add('hidden');
      img.src = '';
    }
  }

  return { show, hide, isVisible };
}

function formatPeriod(minutes) {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return `${h}h ${m}m`;
  }
  return `${minutes.toFixed(1)} min`;
}
