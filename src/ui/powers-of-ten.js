
import * as THREE from 'three/webgpu';

// Cinematic zoom waypoints (scene units, 1 unit = 500 km)
const WAYPOINTS = [
  { dist: 20,    holdMs: 2200, line1: 'LOW EARTH ORBIT',     line2: '400 km — Satellites & Space Station' },
  { dist: 85,    holdMs: 2400, line1: 'GEOSTATIONARY BELT',  line2: '36,000 km — Weather & Communications Satellites' },
  { dist: 780,   holdMs: 2600, line1: 'THE MOON\'S DISTANCE',line2: '384,000 km — Our nearest neighbor' },
  { dist: 3500,  holdMs: 2800, line1: 'INNER SOLAR SYSTEM',  line2: '~11 AU — Within the asteroid belt' },
  { dist: 22000, holdMs: 3000, line1: 'BEYOND NEPTUNE',      line2: '~73 AU — The edge of our Solar System' },
  { dist: 88000, holdMs: 4500, line1: 'INTERSTELLAR SPACE',  line2: 'The stars are light-years apart' },
];

// Travel durations between consecutive waypoints (ms)
const TRAVEL_MS = [3500, 4500, 5500, 6500, 7500];

// Log-space lerp for smooth zoom through orders of magnitude
function logLerp(a, b, t) {
  return Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * t);
}

// Smooth ease in-out
function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

export function createPowersOfTen(camera, controls) {
  // ── DOM refs ──────────────────────────────────────────────────────
  const overlay      = document.getElementById('pot-overlay');
  const line1El      = document.getElementById('pot-line1');
  const line2El      = document.getElementById('pot-line2');
  const progressFill = document.getElementById('pot-progress-fill');
  const labelWrap    = document.getElementById('pot-label');

  if (!overlay) {
    console.warn('[PowersOfTen] #pot-overlay not found');
    return { start: () => {}, stop: () => {}, update: () => {}, isActive: () => false };
  }

  // ── State ─────────────────────────────────────────────────────────
  let _active      = false;
  let _phase       = 'idle';   // 'hold' | 'travel' | 'done'
  let _wpIdx       = 0;        // current waypoint index
  let _phaseStart  = 0;        // performance.now() when current phase started
  let _dir         = new THREE.Vector3();
  let _labelVisible= false;
  let _totalMs     = 0;        // total sequence duration
  let _elapsedMs   = 0;        // total elapsed across all phases

  // Pre-compute total duration
  _totalMs = WAYPOINTS.reduce((acc, wp) => acc + wp.holdMs, 0)
           + TRAVEL_MS.reduce((acc, ms) => acc + ms, 0);

  // ── Helpers ───────────────────────────────────────────────────────
  function _showLabel(line1, line2) {
    if (!line1El || !line2El || !labelWrap) return;
    line1El.textContent = line1;
    line2El.textContent = line2;
    labelWrap.style.transition = 'none';
    labelWrap.style.opacity = '0';
    labelWrap.style.transform = 'translateY(12px)';
    // Force reflow then animate in
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

  // ── Public: start ─────────────────────────────────────────────────
  function start() {
    if (_active) return;
    _active     = true;
    _wpIdx      = 0;
    _elapsedMs  = 0;

    // Capture current camera direction (unit vector from origin)
    _dir.copy(camera.position).normalize();
    if (_dir.lengthSq() < 0.001) _dir.set(0, 1, 0);

    // Reset controls target to origin, disable user interaction
    controls.target.set(0, 0, 0);
    controls.enabled = false;

    // Teleport to first waypoint immediately
    camera.position.copy(_dir.clone().multiplyScalar(WAYPOINTS[0].dist));

    // Show overlay
    overlay.style.display = 'flex';
    overlay.style.opacity = '0';
    overlay.offsetHeight;
    overlay.style.transition = 'opacity 0.6s ease';
    overlay.style.opacity    = '1';

    _setProgress(0);

    // Begin first HOLD phase
    _phase      = 'hold';
    _phaseStart = performance.now();
    _showLabel(WAYPOINTS[0].line1, WAYPOINTS[0].line2);
  }

  // ── Public: stop ─────────────────────────────────────────────────
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

  // ── Public: update (call every frame) ────────────────────────────
  function update() {
    if (!_active) return;

    const now     = performance.now();
    const elapsed = now - _phaseStart;

    // ── HOLD phase ────────────────────────────────────────────────
    if (_phase === 'hold') {
      const holdDur = WAYPOINTS[_wpIdx].holdMs;

      // Keep camera at waypoint distance
      camera.position.copy(_dir.clone().multiplyScalar(WAYPOINTS[_wpIdx].dist));

      _elapsedMs += Math.min(elapsed - (_phaseStart === now ? 0 : 0), 0); // handled below

      if (elapsed >= holdDur) {
        // Advance
        if (_wpIdx >= WAYPOINTS.length - 1) {
          // Finished last hold — done
          _phase = 'done';
          setTimeout(stop, 1200);
          return;
        }
        // Start travel to next waypoint
        _hideLabel();
        _phase      = 'travel';
        _phaseStart = now;
      }
    }

    // ── TRAVEL phase ──────────────────────────────────────────────
    else if (_phase === 'travel') {
      const travelDur = TRAVEL_MS[_wpIdx];
      const t         = Math.min(1.0, elapsed / travelDur);
      const ease      = easeInOut(t);

      const fromDist = WAYPOINTS[_wpIdx].dist;
      const toDist   = WAYPOINTS[_wpIdx + 1].dist;
      const newDist  = logLerp(fromDist, toDist, ease);

      camera.position.copy(_dir.clone().multiplyScalar(newDist));

      if (t >= 1.0) {
        // Arrived at next waypoint
        _wpIdx++;
        _phase      = 'hold';
        _phaseStart = now;
        _showLabel(WAYPOINTS[_wpIdx].line1, WAYPOINTS[_wpIdx].line2);
      }
    }

    // ── Progress bar (rough estimate across full sequence) ────────
    const totalPrev = _computeElapsed(_wpIdx, _phase, now - _phaseStart);
    _setProgress(Math.min(1, totalPrev / _totalMs));

    // ── Keep near/far planes updated ─────────────────────────────
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
