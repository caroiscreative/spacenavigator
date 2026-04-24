
const WINDOW    = 60;       // rolling sample count (60 frames ≈ 1 s at 60 fps)
const REFRESH_MS = 400;     // panel text refresh interval

const _starts  = {};                          // { name: performance.now() }
const _buffers = {};                          // { name: Float32Array(WINDOW) }
let   _renderer = null;                       // THREE renderer reference (optional)
let   _visible  = false;
let   _lastRefresh = 0;

const _panel = document.createElement('div');
_panel.id    = 'perf-panel';
Object.assign(_panel.style, {
  position:        'fixed',
  top:             '12px',
  right:           '12px',
  background:      'rgba(0,0,0,0.82)',
  border:          '1px solid rgba(255,255,255,0.12)',
  borderRadius:    '6px',
  padding:         '10px 14px',
  fontFamily:      '"JetBrains Mono", "Fira Code", monospace',
  fontSize:        '11px',
  lineHeight:      '1.7',
  color:           '#e8e8e8',
  pointerEvents:   'none',
  zIndex:          '9999',
  minWidth:        '200px',
  display:         'none',
  backdropFilter:  'blur(6px)',
  whiteSpace:      'pre',
});
document.body.appendChild(_panel);

function _avg(name) {
  const buf = _buffers[name];
  if (!buf) return 0;
  let sum = 0;
  for (let i = 0; i < WINDOW; i++) sum += buf[i];
  return sum / WINDOW;
}

function _color(ms) {
  if (ms < 4)  return '#4fc3f7';   // blue  — excellent
  if (ms < 8)  return '#81c784';   // green — good
  if (ms < 12) return '#ffb74d';   // amber — ok
  return '#ef5350';                // red   — over budget
}

function _bar(ms, maxMs = 16) {
  const filled = Math.round(Math.min(1, ms / maxMs) * 10);
  return '▓'.repeat(filled) + '░'.repeat(10 - filled);
}

function _fmt(ms) {
  return ms < 0.05 ? ' <0.1' : ms.toFixed(1).padStart(5);
}

export function begin(name) {
  _starts[name] = performance.now();
}

export function end(name) {
  if (_starts[name] === undefined) return;
  const dt = performance.now() - _starts[name];
  if (!_buffers[name]) _buffers[name] = new Float32Array(WINDOW);
  _buffers[name].copyWithin(0, 1);
  _buffers[name][WINDOW - 1] = dt;
  delete _starts[name];
}

export function setRenderer(renderer) {
  _renderer = renderer;
}

export function tick(now) {
  if (!_visible) return;
  if (now - _lastRefresh < REFRESH_MS) return;
  _lastRefresh = now;

  const frameMs  = _avg('frame');
  const renderMs = _avg('render');
  const fps      = frameMs > 0 ? Math.round(1000 / frameMs) : 0;

  let draws = 0, tris = 0, geos = 0, texs = 0;
  if (_renderer?.info) {
    const ri = _renderer.info;
    draws = ri.render?.drawCalls  ?? 0;
    tris  = ri.render?.triangles  ?? 0;
    geos  = ri.memory?.geometries ?? 0;
    texs  = ri.memory?.textures   ?? 0;
  }

  let memStr = '';
  if (performance.memory) {
    const mb = (performance.memory.usedJSHeapSize / 1048576).toFixed(0);
    memStr = `\n  JS heap   ${mb.padStart(5)} MB`;
  }

  const SYSTEMS = [
    ['render',      'Renderer'],
    ['earth',       'Earth   '],
    ['solar',       'Planets '],
    ['satellites',  'Sats    '],
    ['risk',        'Risk    '],
    ['debris',      'Debris  '],
    ['asteroids',   'Asteroid'],
    ['trail',       'Trail   '],
    ['navigation',  'Nav     '],
  ];

  const rows = SYSTEMS
    .map(([key, label]) => {
      const ms = _avg(key);
      if (ms < 0.01) return null;  // skip idle systems
      const c = _color(ms);
      return `  ${label}  <span style="color:${c}">${_fmt(ms)} ms</span>`;
    })
    .filter(Boolean)
    .join('\n');

  const frameColor  = _color(frameMs);
  const fpsColor    = fps >= 55 ? '#81c784' : fps >= 30 ? '#ffb74d' : '#ef5350';

  _panel.innerHTML =
    `<span style="color:#aaa;font-size:10px;letter-spacing:1px">── PERF ──</span>\n` +
    `  <span style="color:${fpsColor}">FPS  ${fps.toString().padStart(4)}</span>  ` +
    `<span style="color:#aaa">[ ${_bar(frameMs)} ]</span>\n` +
    `  <span style="color:${frameColor}">Frame${_fmt(frameMs)} ms</span>\n` +
    `\n` +
    rows +
    `\n\n` +
    `<span style="color:#555">  draw calls  ${draws}\n` +
    `  triangles   ${(tris / 1000).toFixed(0)}k\n` +
    `  geometries  ${geos}\n` +
    `  textures    ${texs}` +
    memStr +
    `</span>`;
}

export function toggle() {
  _visible = !_visible;
  _panel.style.display = _visible ? 'block' : 'none';
  if (_visible) _lastRefresh = 0;   // force immediate refresh
  return _visible;
}

export function isVisible() {
  return _visible;
}
