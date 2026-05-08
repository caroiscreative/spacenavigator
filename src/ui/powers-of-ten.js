
import * as THREE from 'three/webgpu';

const WAYPOINTS = [
  { dist: 20,    holdMs: 2200, line1: 'LOW EARTH ORBIT',     line2: '400 km — Satellites & Space Station' },
  { dist: 85,    holdMs: 2400, line1: 'GEOSTATIONARY BELT',  line2: '36,000 km — Weather & Communications Satellites' },
  { dist: 780,   holdMs: 2600, line1: 'THE MOON\'S DISTANCE',line2: '384,000 km — Our nearest neighbor' },
  { dist: 3500,  holdMs: 2800, line1: 'INNER SOLAR SYSTEM',  line2: '~11 AU — Within the asteroid belt' },
  { dist: 22000, holdMs: 3000, line1: 'BEYOND NEPTUNE',      line2: '~73 AU — The edge of our Solar System' },
  { dist: 88000, holdMs: 4500, line1: 'INTERSTELLAR SPACE',  line2: 'The stars are light-years apart' },
];

const TRAVEL_MS = [3500, 4500, 5500, 6500, 7500];

function logLerp(a, b, t) {
  return Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * t);
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

export function createPowersOfTen(camera, controls) {

  const overlay      = document.getElementById('pot-overlay');
  const line1El      = document.getElementById('pot-line1');
  const line2El      = document.getElementById('pot-line2');
  const progressFill = document.getElementById('pot-progress-fill');
  const labelWrap    = document.getElementById('pot-label');

  if (!overlay) {
    console.warn('[PowersOfTen] #pot-overlay not found');
    return { start: () => {}, stop: () => {}, update: () => {}, isActive: () => false };
  }

  let _active      = false;
  let _phase       = 'idle';
  let _wpIdx       = 0;
  let _phaseStart  = 0;
  let _dir         = new THREE.Vector3();
  let _labelVisible= false;
  let _totalMs     = 0;
  let _elapsedMs   = 0;

  _totalMs = WAYPOINTS.reduce((acc, wp) => acc + wp.holdMs, 0)
           + TRAVEL_MS.reduce((acc, ms) => acc + ms, 0);

  function _showLabel(line1, line2) {
    if (!line1El || !line2El || !labelWrap) return;
    line1El.textContent = line1;
    line2El.textContent = line2;
    labelWrap.style.transition = 'none';
    labelWrap.style.opacity = '0';
    labelWrap.style.transform = 'translateY(12px)';

    labelWrap.offsetHeight;
    labelWrap.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    labelWrap.style.opacity = '1';
    labelWrap.style.transform = 'translateY(0)';
    _labelVisible = true;
  }

  function _hideLabel(fast = false) {
    if (!labelWrap || !_labelVisible) return;
    const dur = fast ? '0.2s' : '0.5s';
    labelWrap.style.transition = `opacity ${dur} ease, transform ${dur} ease`;
    labelWrap.style.opacity = '0';
    labelWrap.style.transform = 'translateY(-8px)';
    _labelVisible = false;
  }

  function _setProgress(t) {
    if (progressFill) progressFill.style.width = `${Math.round(t * 100)}%`;
  }

  function start() {
    if (_active) return;
    _active     = true;
    _wpIdx      = 0;
    _elapsedMs  = 0;

    _dir.copy(camera.position).normalize();
    if (_dir.lengthSq() < 0.001) _dir.set(0, 1, 0);

    controls.target.set(0, 0, 0);
    controls.enabled = false;

    camera.position.copy(_dir.clone().multiplyScalar(WAYPOINTS[0].dist));

    overlay.style.display = 'flex';
    overlay.style.opacity = '0';
    overlay.offsetHeight;
    overlay.style.transition = 'opacity 0.6s ease';
    overlay.style.opacity    = '1';

    _setProgress(0);

    _phase      = 'hold';
    _phaseStart = performance.now();
    _showLabel(WAYPOINTS[0].line1, WAYPOINTS[0].line2);
  }

  function stop() {
    if (!_active) return;
    _active  = false;
    _phase   = 'idle';

    controls.enabled = true;

    _hideLabel(true);
    overlay.style.transition = 'opacity 0.4s ease';
    overlay.style.opacity    = '0';
    setTimeout(() => { overlay.style.display = 'none'; }, 450);
  }

  function update() {
    if (!_active) return;

    const now     = performance.now();
    const elapsed = now - _phaseStart;

    if (_phase === 'hold') {
      const holdDur = WAYPOINTS[_wpIdx].holdMs;

      camera.position.copy(_dir.clone().multiplyScalar(WAYPOINTS[_wpIdx].dist));

      _elapsedMs += Math.min(elapsed - (_phaseStart === now ? 0 : 0), 0);

      if (elapsed >= holdDur) {

        if (_wpIdx >= WAYPOINTS.length - 1) {

          _phase = 'done';
          setTimeout(stop, 1200);
          return;
        }

        _hideLabel();
        _phase      = 'travel';
        _phaseStart = now;
      }
    }

    else if (_phase === 'travel') {
      const travelDur = TRAVEL_MS[_wpIdx];
      const t         = Math.min(1.0, elapsed / travelDur);
      const ease      = easeInOut(t);

      const fromDist = WAYPOINTS[_wpIdx].dist;
      const toDist   = WAYPOINTS[_wpIdx + 1].dist;
      const newDist  = logLerp(fromDist, toDist, ease);

      camera.position.copy(_dir.clone().multiplyScalar(newDist));

      if (t >= 1.0) {

        _wpIdx++;
        _phase      = 'hold';
        _phaseStart = now;
        _showLabel(WAYPOINTS[_wpIdx].line1, WAYPOINTS[_wpIdx].line2);
      }
    }

    const totalPrev = _computeElapsed(_wpIdx, _phase, now - _phaseStart);
    _setProgress(Math.min(1, totalPrev / _totalMs));

    const d = camera.position.length();
    camera.near = Math.max(0.0001, d * 5e-5);
    camera.far  = Math.max(2e5, d * 200);
    camera.updateProjectionMatrix();
  }

  function _computeElapsed(wpIdx, phase, phaseElapsed) {
    let total = 0;
    for (let i = 0; i < wpIdx; i++) {
      total += WAYPOINTS[i].holdMs;
      if (i < TRAVEL_MS.length) total += TRAVEL_MS[i];
    }
    total += phaseElapsed;
    return total;
  }

  function isActive() { return _active; }

  return { start, stop, update, isActive };
}
