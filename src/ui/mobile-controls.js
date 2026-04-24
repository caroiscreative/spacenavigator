
import * as THREE from 'three/webgpu';

export function isMobile() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

const JOYSTICK_RADIUS  = 54;

const THUMB_RADIUS     = 20;

const MAX_ORBIT_RATE   = 1.6;

const CYAN  = 'rgba(0,212,255,0.80)';
const DIM   = 'rgba(255,255,255,0.18)';

export function createMobileControls(camera, orbitControls, canvas, callbacks) {

  if (!isMobile()) return null;

  orbitControls.enableRotate = false;

  document.body.classList.add('mobile-mode');

  const overlay = document.createElement('div');
  overlay.id = 'mobile-overlay';
  overlay.innerHTML = `
    <!-- Top info strip -->
    <div id="mob-top-strip">
      <span id="mob-date">—</span>
      <span id="mob-scale">—</span>
    </div>

    <!-- Layout row: joystick | gap | buttons -->
    <div id="mob-layout-row">

      <!-- Left: joystick zone -->
      <div id="mob-joystick-zone">
        <div id="mob-joystick-label">DRAG TO ORBIT</div>
        <!-- Joystick pad: hidden until touch, positioned by JS -->
        <div id="mob-joystick-pad">
          <div id="mob-joystick-thumb"></div>
        </div>
      </div>

      <!-- Centre gap: pointer-events:none — passes touches to canvas -->
      <div id="mob-gap"></div>

      <!-- Right: action buttons -->
      <div id="mob-right-zone">

        <button class="mob-btn" id="mob-btn-earth">
          <span class="mob-btn-icon">⬡</span>
          <span class="mob-btn-label">EARTH</span>
        </button>

        <button class="mob-btn mob-btn-select" id="mob-btn-select">
          <span class="mob-btn-icon">◎</span>
          <span class="mob-btn-label">SELECT</span>
        </button>

        <div class="mob-btn-row" id="mob-speed-row">
          <button class="mob-btn mob-btn-sm" id="mob-btn-slower">‹‹</button>
          <span id="mob-speed-label">×1</span>
          <button class="mob-btn mob-btn-sm" id="mob-btn-faster">››</button>
        </div>

        <div class="mob-btn-row" id="mob-zoom-row">
          <button class="mob-btn mob-btn-sm" id="mob-btn-zoom-in">＋</button>
          <button class="mob-btn mob-btn-sm" id="mob-btn-zoom-out">－</button>
        </div>

      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const joystickZone  = overlay.querySelector('#mob-joystick-zone');
  const joystickPad   = overlay.querySelector('#mob-joystick-pad');
  const joystickThumb = overlay.querySelector('#mob-joystick-thumb');
  const joystickLabel = overlay.querySelector('#mob-joystick-label');
  const mobDate       = overlay.querySelector('#mob-date');
  const mobScale      = overlay.querySelector('#mob-scale');
  const mobSpeedLabel = overlay.querySelector('#mob-speed-label');

  joystickPad.style.display = 'none';

  let joystickActive    = false;
  let joystickPointerId = -1;
  let joystickOriginX   = 0;
  let joystickOriginY   = 0;
  let joystickDeltaX    = 0;
  let joystickDeltaY    = 0;

  const _sp = new THREE.Spherical();
  const _v  = new THREE.Vector3();

  joystickZone.addEventListener('pointerdown', (e) => {
    if (joystickActive) return;
    joystickActive    = true;
    joystickPointerId = e.pointerId;
    joystickOriginX   = e.clientX;
    joystickOriginY   = e.clientY;
    joystickDeltaX    = 0;
    joystickDeltaY    = 0;

    const px = e.clientX - JOYSTICK_RADIUS;
    const py = e.clientY - JOYSTICK_RADIUS;
    joystickPad.style.left    = `${px}px`;
    joystickPad.style.top     = `${py}px`;
    joystickPad.style.display = 'flex';
    joystickThumb.style.transform = 'translate(-50%, -50%)';
    joystickLabel.style.opacity   = '0';

    joystickZone.setPointerCapture(e.pointerId);
    e.preventDefault();
  }, { passive: false });

  joystickZone.addEventListener('pointermove', (e) => {
    if (!joystickActive || e.pointerId !== joystickPointerId) return;
    const dx = e.clientX - joystickOriginX;
    const dy = e.clientY - joystickOriginY;

    const dist     = Math.sqrt(dx * dx + dy * dy);
    const maxDist  = JOYSTICK_RADIUS - THUMB_RADIUS - 2;
    const clamped  = Math.min(dist, maxDist);
    const angle    = Math.atan2(dy, dx);
    const tx       = Math.cos(angle) * clamped;
    const ty       = Math.sin(angle) * clamped;
    joystickThumb.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px))`;

    joystickDeltaX = dx;
    joystickDeltaY = dy;
    e.preventDefault();
  }, { passive: false });

  function _endJoystick(e) {
    if (e.pointerId !== joystickPointerId) return;
    joystickActive    = false;
    joystickPointerId = -1;
    joystickDeltaX    = 0;
    joystickDeltaY    = 0;
    joystickPad.style.display   = 'none';
    joystickLabel.style.opacity = '0.35';
  }
  joystickZone.addEventListener('pointerup',     _endJoystick);
  joystickZone.addEventListener('pointercancel', _endJoystick);

  overlay.querySelector('#mob-btn-earth').addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    callbacks.backToEarth?.();
  });

  overlay.querySelector('#mob-btn-select').addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('mobile-select'));
  });

  overlay.querySelector('#mob-btn-slower').addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('mobile-speed-change', { detail: -1 }));
  });

  overlay.querySelector('#mob-btn-faster').addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('mobile-speed-change', { detail: +1 }));
  });

  let _zoomInterval = null;

  function _startZoom(direction) {
    if (_zoomInterval) return;
    canvas.dispatchEvent(new WheelEvent('wheel', {
      deltaY: direction * 100, bubbles: true, cancelable: true,
    }));
    _zoomInterval = setInterval(() => {
      canvas.dispatchEvent(new WheelEvent('wheel', {
        deltaY: direction * 100, bubbles: true, cancelable: true,
      }));
    }, 80);
  }

  function _stopZoom() {
    if (_zoomInterval) { clearInterval(_zoomInterval); _zoomInterval = null; }
  }

  const zoomInBtn  = overlay.querySelector('#mob-btn-zoom-in');
  const zoomOutBtn = overlay.querySelector('#mob-btn-zoom-out');

  zoomInBtn.addEventListener('pointerdown',   (e) => { e.stopPropagation(); _startZoom(-1); });
  zoomOutBtn.addEventListener('pointerdown',  (e) => { e.stopPropagation(); _startZoom(+1); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => {
    zoomInBtn.addEventListener(ev,  _stopZoom);
    zoomOutBtn.addEventListener(ev, _stopZoom);
  });

  function update(realDeltaMs) {
    if (!joystickActive) return;
    const dist = Math.sqrt(joystickDeltaX ** 2 + joystickDeltaY ** 2);
    if (dist < 2) return;   // dead zone

    const dt       = realDeltaMs / 1000;
    const norm     = Math.min(1.0, dist / JOYSTICK_RADIUS);
    const angle    = Math.atan2(joystickDeltaY, joystickDeltaX);
    const nx       = Math.cos(angle) * norm;
    const ny       = Math.sin(angle) * norm;
    const dTheta   = nx * MAX_ORBIT_RATE * dt;
    const dPhi     = ny * MAX_ORBIT_RATE * dt;

    _v.copy(camera.position).sub(orbitControls.target);
    _sp.setFromVector3(_v);

    _sp.theta -= dTheta;
    _sp.phi   -= dPhi;
    _sp.phi    = Math.max(0.04, Math.min(Math.PI - 0.04, _sp.phi));  // no pole-flip

    _v.setFromSpherical(_sp);
    camera.position.copy(orbitControls.target).add(_v);
    orbitControls.update();
  }

  function updateDate(str) {
    if (mobDate) mobDate.textContent = str;
  }

  function updateScale(str) {
    if (mobScale) mobScale.textContent = str;
  }

  function updateSpeed(str) {
    if (mobSpeedLabel) mobSpeedLabel.textContent = str;
  }

  function dispose() {
    _stopZoom();
    overlay.remove();
    document.body.classList.remove('mobile-mode');
    orbitControls.enableRotate = true;
  }

  return { update, updateDate, updateScale, updateSpeed, dispose };
}
