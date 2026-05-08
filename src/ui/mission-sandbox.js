
import * as THREE from 'three/webgpu';

const MU_KM3  = 3.986004418e5;
const RE_KM   = 6371;
const KM_PER_UNIT = 500;

function lifetimeYears(altKm, Bc = 0.01) {

  if (altKm > 2000) return Infinity;
  if (altKm > 1500) return 500;
  if (altKm > 1200) return 200;
  if (altKm > 1000) return 100;
  if (altKm > 900)  return 50;
  if (altKm > 800)  return 25;
  if (altKm > 700)  return 10;
  if (altKm > 600)  return 3;
  if (altKm > 500)  return 1;
  if (altKm > 400)  return 0.25;
  if (altKm > 300)  return 0.08;
  return 0.02;
}

function lifetimeLabel(altKm) {
  const y = lifetimeYears(altKm);
  if (!isFinite(y)) return '> 500 years (effectively permanent)';
  if (y >= 100)   return `~${Math.round(y)} years`;
  if (y >= 1)     return `~${y.toFixed(1)} years`;
  if (y >= 1/12)  return `~${Math.round(y * 12)} months`;
  return `~${Math.round(y * 365)} days`;
}

function orbitalPeriodMin(altKm) {
  const a = RE_KM + altKm;
  return (2 * Math.PI * Math.sqrt(a * a * a / MU_KM3)) / 60;
}

function orbitalVelocityKms(altKm) {
  return Math.sqrt(MU_KM3 / (RE_KM + altKm));
}

function dvHohmann(altKm) {
  const r1 = RE_KM + 408;
  const r2 = RE_KM + altKm;
  const v1 = Math.sqrt(MU_KM3 / r1);
  const v2 = Math.sqrt(MU_KM3 / r2);
  const vt1 = Math.sqrt(MU_KM3 * (2 / r1 - 2 / (r1 + r2)));
  const vt2 = Math.sqrt(MU_KM3 * (2 / r2 - 2 / (r1 + r2)));
  const dv1 = Math.abs(vt1 - v1);
  const dv2 = Math.abs(v2 - vt2);
  return dv1 + dv2;
}

function coverageHalfAngleDeg(altKm, minElev = 5) {
  const rho = RE_KM / (RE_KM + altKm);
  const eta = Math.acos(Math.sin(minElev * Math.PI / 180) / rho);
  const lambda = Math.PI / 2 - minElev * Math.PI / 180 - eta;
  return lambda * 180 / Math.PI;
}

function coverageAreaKm2(altKm) {
  const halfAngle = coverageHalfAngleDeg(altKm) * Math.PI / 180;
  return 2 * Math.PI * RE_KM * RE_KM * (1 - Math.cos(halfAngle));
}

function satsForGlobalCoverage(altKm, inclDeg) {
  const halfAngle = coverageHalfAngleDeg(altKm) * Math.PI / 180;
  const coveragePct = (1 - Math.cos(halfAngle));

  const planes = Math.ceil(Math.PI / (2 * halfAngle));
  const perPlane = Math.ceil(Math.PI / halfAngle);
  return planes * perPlane;
}

export function createMissionSandbox(scene, onClose) {
  const panel    = document.getElementById('mission-panel');
  const altSlider = document.getElementById('ms-alt-slider');
  const inclSlider= document.getElementById('ms-incl-slider');
  const altVal   = document.getElementById('ms-alt-val');
  const inclVal  = document.getElementById('ms-incl-val');

  if (!panel) {
    console.warn('[MissionSandbox] #mission-panel not found');
    return { show: () => {}, hide: () => {}, toggle: () => {}, isVisible: () => false, dispose: () => {} };
  }

  document.getElementById('ms-close')?.addEventListener('click', () => { hide(); onClose?.(); });

  const orbitGeo = new THREE.BufferGeometry();
  const SEGMENTS = 128;
  const orbitPositions = new Float32Array((SEGMENTS + 1) * 3);
  orbitGeo.setAttribute('position', new THREE.BufferAttribute(orbitPositions, 3));
  const orbitMat = new THREE.LineBasicMaterial({
    color: 0x00E5FF,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest:  false,
  });
  const orbitLine = new THREE.Line(orbitGeo, orbitMat);
  orbitLine.visible     = false;
  orbitLine.renderOrder = 999;
  scene.add(orbitLine);

  const eqGeo = new THREE.BufferGeometry();
  const eqPos = new Float32Array((SEGMENTS + 1) * 3);
  for (let i = 0; i <= SEGMENTS; i++) {
    const theta = (i / SEGMENTS) * 2 * Math.PI;
    const r = RE_KM / KM_PER_UNIT;
    eqPos[i * 3]     = r * Math.cos(theta);
    eqPos[i * 3 + 1] = 0;
    eqPos[i * 3 + 2] = r * Math.sin(theta);
  }
  eqGeo.setAttribute('position', new THREE.BufferAttribute(eqPos, 3));
  const eqMat = new THREE.LineBasicMaterial({
    color: 0x888888,
    transparent: true,
    opacity: 0.25,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest:  false,
  });
  const eqLine = new THREE.Line(eqGeo, eqMat);
  eqLine.visible     = false;
  eqLine.renderOrder = 999;
  scene.add(eqLine);

  let _currentAlt  = 550;
  let _currentIncl = 53;

  function _updateOrbit(altKm, inclDeg) {
    const r = (RE_KM + altKm) / KM_PER_UNIT;
    const inclRad = inclDeg * Math.PI / 180;

    for (let i = 0; i <= SEGMENTS; i++) {
      const theta = (i / SEGMENTS) * 2 * Math.PI;

      const x = r * Math.cos(theta);
      const y = r * Math.sin(theta) * Math.sin(inclRad);
      const z = r * Math.sin(theta) * Math.cos(inclRad);
      orbitPositions[i * 3]     = x;
      orbitPositions[i * 3 + 1] = y;
      orbitPositions[i * 3 + 2] = z;
    }
    orbitGeo.attributes.position.needsUpdate = true;
    orbitGeo.computeBoundingSphere();
  }

  function _updateResults(altKm, inclDeg) {
    const period   = orbitalPeriodMin(altKm);
    const velKms   = orbitalVelocityKms(altKm);
    const dv       = dvHohmann(altKm);
    const coverage = coverageAreaKm2(altKm);
    const life     = lifetimeLabel(altKm);
    const sats     = satsForGlobalCoverage(altKm, inclDeg);

    const periodHours = period >= 60 ? `${(period / 60).toFixed(2)} h` : `${period.toFixed(1)} min`;
    const coveragePct = Math.min(100, (coverage / (4 * Math.PI * RE_KM * RE_KM) * 100)).toFixed(1);

    let orbitType = 'LEO';
    if (altKm > 35000 && altKm < 36500) orbitType = 'GEO';
    else if (altKm >= 2000) orbitType = 'MEO';
    else if (inclDeg >= 95 && inclDeg <= 105) orbitType = 'SSO';
    else if (inclDeg >= 85) orbitType = 'Polar';
    else if (inclDeg <= 5) orbitType = 'Equatorial';

    let radEnv = 'Low';
    if (altKm > 1500 && altKm < 5000) radEnv = '⚠ Van Allen Inner Belt';
    else if (altKm >= 5000 && altKm < 15000) radEnv = '⚠⚠ Intense Radiation';
    else if (altKm >= 15000 && altKm < 20000) radEnv = '⚠ Van Allen Outer Belt';

    const rows = [
      ['Orbit type',       orbitType],
      ['Altitude',         `${altKm.toLocaleString()} km`],
      ['Inclination',      `${inclDeg}°`],
      ['Orbital period',   periodHours],
      ['Orbital velocity', `${velKms.toFixed(3)} km/s`],
      ['Δv from ISS',      `${(dv * 1000).toFixed(0)} m/s (altitude only)`],
      ['Coverage per sat', `${(coverage / 1e6).toFixed(2)}M km² (${coveragePct}% of Earth)`],
      ['Sats for global',  `~${sats.toLocaleString()} satellites`],
      ['Atm. lifetime',    life],
      ['Radiation env.',   radEnv],
    ];

    const resultsEl = document.getElementById('ms-results');
    if (!resultsEl) return;
    resultsEl.innerHTML = rows.map(([label, val]) => `
      <div class="ms-result-row">
        <span class="ms-result-label">${label}</span>
        <span class="ms-result-val">${val}</span>
      </div>`).join('');
  }

  function _onAltChange() {
    _currentAlt = parseInt(altSlider.value, 10);
    altVal.textContent = `${_currentAlt.toLocaleString()} km`;
    _updateOrbit(_currentAlt, _currentIncl);
    _updateResults(_currentAlt, _currentIncl);
  }

  function _onInclChange() {
    _currentIncl = parseInt(inclSlider.value, 10);
    inclVal.textContent = `${_currentIncl}°`;
    _updateOrbit(_currentAlt, _currentIncl);
    _updateResults(_currentAlt, _currentIncl);
  }

  altSlider?.addEventListener('input', _onAltChange);
  inclSlider?.addEventListener('input', _onInclChange);

  document.querySelectorAll('[data-ms-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const alt  = parseInt(btn.dataset.msAlt,  10);
      const incl = parseInt(btn.dataset.msIncl, 10);
      if (altSlider)  { altSlider.value  = alt;  altVal.textContent  = `${alt.toLocaleString()} km`; }
      if (inclSlider) { inclSlider.value = incl; inclVal.textContent = `${incl}°`; }
      _currentAlt  = alt;
      _currentIncl = incl;
      _updateOrbit(alt, incl);
      _updateResults(alt, incl);
    });
  });

  function show() {
    panel.classList.remove('hidden');
    orbitLine.visible = true;
    eqLine.visible    = true;
    _updateOrbit(_currentAlt, _currentIncl);
    _updateResults(_currentAlt, _currentIncl);
  }

  function hide() {
    panel.classList.add('hidden');
    orbitLine.visible = false;
    eqLine.visible    = false;
  }

  function toggle() {
    const visible = !panel.classList.contains('hidden');
    if (visible) hide(); else show();
    return !visible;
  }

  function isVisible() { return !panel.classList.contains('hidden'); }

  function dispose() {
    scene.remove(orbitLine);
    scene.remove(eqLine);
    orbitGeo.dispose();
    orbitMat.dispose();
    eqGeo.dispose();
    eqMat.dispose();
  }

  return { show, hide, toggle, isVisible, dispose };
}
