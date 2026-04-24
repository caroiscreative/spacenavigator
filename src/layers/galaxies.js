
import * as THREE from 'three/webgpu';
import { ALL_DSOS, DSO_TYPES } from '../data/galaxy-catalog.js';

const SKY_RADIUS  = 9e4;          // must match hyg-loader.js SKY_RADIUS
const DEG         = Math.PI / 180;
const TEX_SIZE    = 128;          // canvas texture resolution — 128 is sharp enough at sky distances

const DEG_TO_SCENE = SKY_RADIUS * DEG;

const SPRITE_MIN  = 400;
const SPRITE_MAX  = 32000;

const BASE_OPACITY = 0.85;

function eqToScene(raDeg, decDeg) {
  const ra  = raDeg  * DEG;
  const dec = decDeg * DEG;
  return new THREE.Vector3(
     Math.cos(dec) * Math.cos(ra),
     Math.sin(dec),
    -Math.cos(dec) * Math.sin(ra),
  );
}

const textureCache = new Map();

function getCachedTexture(key, buildFn) {
  if (textureCache.has(key)) return textureCache.get(key);
  const tex = buildFn();
  textureCache.set(key, tex);
  return tex;
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 0xFF, (n >> 8) & 0xFF, n & 0xFF];
}

function makeTexture(drawFn) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TEX_SIZE;
  const ctx    = canvas.getContext('2d');
  drawFn(ctx, canvas);
  const tex = new THREE.Texture(canvas);  // NOT CanvasTexture — one-time upload only
  tex.needsUpdate = true;
  return tex;
}

function makeSpiralTexture(color, tilt = 0) {
  return makeTexture((ctx) => {
    const cx = TEX_SIZE / 2, cy = TEX_SIZE / 2, r = TEX_SIZE / 2;
    const [rr, gg, bb] = hexToRgb(color);

    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    halo.addColorStop(0,   `rgba(${rr},${gg},${bb},0.0)`);
    halo.addColorStop(0.35,`rgba(${rr},${gg},${bb},0.10)`);
    halo.addColorStop(0.65,`rgba(${rr},${gg},${bb},0.05)`);
    halo.addColorStop(1,   `rgba(${rr},${gg},${bb},0.0)`);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, 0.48);   // flatten to simulate edge-on tilt
    ctx.translate(-cx, -cy);
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
    ctx.restore();

    const diskGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.75);
    diskGrad.addColorStop(0,   `rgba(${rr},${gg},${bb},0.0)`);
    diskGrad.addColorStop(0.15,`rgba(${rr},${gg},${bb},0.22)`);
    diskGrad.addColorStop(0.5, `rgba(${rr},${gg},${bb},0.10)`);
    diskGrad.addColorStop(1,   `rgba(${rr},${gg},${bb},0.0)`);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tilt);
    ctx.scale(1, 0.42);
    ctx.translate(-cx, -cy);
    ctx.fillStyle = diskGrad;
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
    ctx.restore();

    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.18);
    core.addColorStop(0,   `rgba(255,248,230,0.95)`);
    core.addColorStop(0.3, `rgba(${rr},${gg},${bb},0.80)`);
    core.addColorStop(0.7, `rgba(${rr},${gg},${bb},0.30)`);
    core.addColorStop(1,   `rgba(${rr},${gg},${bb},0.0)`);
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.18, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = 'source-over';
    for (let arm = 0; arm < 2; arm++) {
      ctx.beginPath();
      const startAngle = arm * Math.PI;
      for (let t = 0.15; t < 4.5; t += 0.03) {
        const spread = 0.04 + t * 0.018;
        const innerR = t * r * 0.095 + r * 0.07;
        const angle  = startAngle + t * 1.3 + tilt;
        const px     = cx + innerR * Math.cos(angle) * spread * 5.2;
        const py     = cy + innerR * Math.sin(angle) * spread * 2.1;
        if (t === 0.15) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      const armAlpha = Math.round(28 + tilt * 8);
      ctx.strokeStyle = `rgba(${rr},${gg},${bb},${armAlpha / 100})`;
      ctx.lineWidth   = 2.5;
      ctx.stroke();
    }
  });
}

function makeEllipticalTexture(color) {
  return makeTexture((ctx) => {
    const cx = TEX_SIZE / 2, cy = TEX_SIZE / 2, r = TEX_SIZE / 2;
    const [rr, gg, bb] = hexToRgb(color);

    const layers = [
      { rx: 1.0, ry: 0.62, stops: [[0, 0.0], [0.2, 0.85], [0.55, 0.30], [1.0, 0.0]] },
      { rx: 0.5, ry: 0.32, stops: [[0, 0.95], [0.4, 0.50], [1.0, 0.0]] },
      { rx: 0.18, ry: 0.12, stops: [[0, 1.0], [0.6, 0.80], [1.0, 0.0]] },
    ];
    layers.forEach(({ rx, ry, stops }) => {
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * rx);
      stops.forEach(([pos, alpha]) => {
        grad.addColorStop(pos, `rgba(${rr},${gg},${bb},${alpha})`);
      });
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(rx, ry);
      ctx.translate(-cx, -cy);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
      ctx.restore();
    });
  });
}

function makeIrregularTexture(color) {
  return makeTexture((ctx) => {
    const cx = TEX_SIZE / 2, cy = TEX_SIZE / 2, r = TEX_SIZE / 2;
    const [rr, gg, bb] = hexToRgb(color);

    const blobs = [
      { ox:  0,    oy:  0,   rx: 0.80, ry: 0.50, a: 0.50 },
      { ox:  0.18, oy:  0.1, rx: 0.45, ry: 0.38, a: 0.40 },
      { ox: -0.15, oy: -0.1, rx: 0.35, ry: 0.28, a: 0.35 },
      { ox:  0.05, oy:  0.2, rx: 0.25, ry: 0.20, a: 0.55 },
      { ox: -0.1,  oy:  0.1, rx: 0.20, ry: 0.18, a: 0.45 },
    ];
    blobs.forEach(({ ox, oy, rx, ry, a }) => {
      const bx = cx + ox * r, by = cy + oy * r;
      const g  = ctx.createRadialGradient(bx, by, 0, bx, by, r * rx);
      g.addColorStop(0,   `rgba(${rr},${gg},${bb},${a})`);
      g.addColorStop(0.5, `rgba(${rr},${gg},${bb},${(a * 0.4).toFixed(2)})`);
      g.addColorStop(1,   `rgba(${rr},${gg},${bb},0)`);
      ctx.save();
      ctx.translate(bx, by);
      ctx.scale(1, ry / rx);
      ctx.translate(-bx, -by);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
      ctx.restore();
    });
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * r * 0.5;
      const px = cx + Math.cos(a) * d;
      const py = cy + Math.sin(a) * d * 0.55;
      const ks = 3 + Math.random() * 5;
      const kg = ctx.createRadialGradient(px, py, 0, px, py, ks);
      kg.addColorStop(0,   `rgba(255,255,255,${(0.5 + Math.random() * 0.4).toFixed(2)})`);
      kg.addColorStop(1,   `rgba(${rr},${gg},${bb},0)`);
      ctx.fillStyle = kg;
      ctx.beginPath();
      ctx.arc(px, py, ks, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function makeEmissionTexture(color) {
  return makeTexture((ctx) => {
    const cx = TEX_SIZE / 2, cy = TEX_SIZE / 2, r = TEX_SIZE / 2;
    const [rr, gg, bb] = hexToRgb(color);

    const outer = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    outer.addColorStop(0,   `rgba(${rr},${gg},${bb},0)`);
    outer.addColorStop(0.3, `rgba(${rr},${gg},${bb},0.30)`);
    outer.addColorStop(0.65,`rgba(${rr},${gg},${bb},0.18)`);
    outer.addColorStop(1,   `rgba(${rr},${gg},${bb},0)`);
    ctx.fillStyle = outer;
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

    const inner = ctx.createRadialGradient(cx - r*0.1, cy - r*0.08, 0, cx, cy, r * 0.55);
    inner.addColorStop(0,   `rgba(255,255,240,0.65)`);
    inner.addColorStop(0.15,`rgba(${rr},${gg},${bb},0.75)`);
    inner.addColorStop(0.55,`rgba(${rr},${gg},${bb},0.22)`);
    inner.addColorStop(1,   `rgba(${rr},${gg},${bb},0)`);
    ctx.fillStyle = inner;
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

    ctx.globalCompositeOperation = 'source-over';
    for (let t = 0; t < 7; t++) {
      const ta = (t / 7) * Math.PI * 2;
      const td = r * (0.35 + Math.random() * 0.30);
      const tx = cx + Math.cos(ta) * td;
      const ty = cy + Math.sin(ta) * td;
      const tg = ctx.createRadialGradient(tx, ty, 0, tx, ty, r * 0.28);
      tg.addColorStop(0,   `rgba(${rr},${gg},${bb},0.38)`);
      tg.addColorStop(1,   `rgba(${rr},${gg},${bb},0)`);
      ctx.fillStyle = tg;
      ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
    }

    const centre = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.12);
    centre.addColorStop(0,   `rgba(255,255,255,0.90)`);
    centre.addColorStop(0.5, `rgba(255,240,200,0.45)`);
    centre.addColorStop(1,   `rgba(${rr},${gg},${bb},0)`);
    ctx.fillStyle = centre;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
  });
}

function makePlanetaryTexture(color) {
  return makeTexture((ctx) => {
    const cx = TEX_SIZE / 2, cy = TEX_SIZE / 2, r = TEX_SIZE / 2;
    const [rr, gg, bb] = hexToRgb(color);

    const glow = ctx.createRadialGradient(cx, cy, r * 0.38, cx, cy, r * 0.85);
    glow.addColorStop(0,   `rgba(${rr},${gg},${bb},0.0)`);
    glow.addColorStop(0.25,`rgba(${rr},${gg},${bb},0.25)`);
    glow.addColorStop(0.6, `rgba(${rr},${gg},${bb},0.12)`);
    glow.addColorStop(1,   `rgba(${rr},${gg},${bb},0.0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

    const ring = ctx.createRadialGradient(cx, cy, r * 0.22, cx, cy, r * 0.55);
    ring.addColorStop(0,   `rgba(${rr},${gg},${bb},0.0)`);
    ring.addColorStop(0.3, `rgba(${rr},${gg},${bb},0.82)`);
    ring.addColorStop(0.65,`rgba(${rr},${gg},${bb},0.60)`);
    ring.addColorStop(1,   `rgba(${rr},${gg},${bb},0.0)`);
    ctx.fillStyle = ring;
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

    const hollow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.22);
    hollow.addColorStop(0,   `rgba(0,0,0,0.45)`);
    hollow.addColorStop(0.7, `rgba(0,0,0,0.10)`);
    hollow.addColorStop(1,   `rgba(0,0,0,0.0)`);
    ctx.fillStyle = hollow;
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

    const wd = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.045);
    wd.addColorStop(0, `rgba(255,255,255,0.90)`);
    wd.addColorStop(1, `rgba(${rr},${gg},${bb},0)`);
    ctx.fillStyle = wd;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.045, 0, Math.PI * 2);
    ctx.fill();
  });
}

function makeRemnantTexture(color) {
  return makeTexture((ctx) => {
    const cx = TEX_SIZE / 2, cy = TEX_SIZE / 2, r = TEX_SIZE / 2;
    const [rr, gg, bb] = hexToRgb(color);

    const shell = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 0.92);
    shell.addColorStop(0,   `rgba(${rr},${gg},${bb},0.0)`);
    shell.addColorStop(0.35,`rgba(${rr},${gg},${bb},0.55)`);
    shell.addColorStop(0.7, `rgba(${rr},${gg},${bb},0.35)`);
    shell.addColorStop(1,   `rgba(${rr},${gg},${bb},0.0)`);
    ctx.fillStyle = shell;
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

    ctx.strokeStyle = `rgba(${rr},${gg},${bb},0.55)`;
    ctx.lineWidth   = 0.8;
    for (let f = 0; f < 22; f++) {
      const fa = (f / 22) * Math.PI * 2 + Math.random() * 0.25;
      const fr = r * (0.18 + Math.random() * 0.65);
      const fe = r * (0.55 + Math.random() * 0.38);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(fa) * fr, cy + Math.sin(fa) * fr);
      ctx.lineTo(cx + Math.cos(fa + 0.15) * fe, cy + Math.sin(fa + 0.15) * fe);
      ctx.stroke();
    }

    const inner = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.42);
    inner.addColorStop(0,   `rgba(${Math.min(rr+40, 255)},${Math.min(gg+40, 255)},${Math.min(bb+60, 255)},0.50)`);
    inner.addColorStop(0.4, `rgba(${rr},${gg},${bb},0.20)`);
    inner.addColorStop(1,   `rgba(${rr},${gg},${bb},0.0)`);
    ctx.fillStyle = inner;
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

    const ps = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.03);
    ps.addColorStop(0, `rgba(255,255,255,0.80)`);
    ps.addColorStop(1, `rgba(${rr},${gg},${bb},0)`);
    ctx.fillStyle = ps;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.03, 0, Math.PI * 2);
    ctx.fill();
  });
}

function makeBlackholeTexture(color) {
  return makeTexture((ctx) => {
    const cx = TEX_SIZE / 2, cy = TEX_SIZE / 2, r = TEX_SIZE / 2;
    const [rr, gg, bb] = hexToRgb(color);

    const outerGlow = ctx.createRadialGradient(cx, cy, r * 0.45, cx, cy, r);
    outerGlow.addColorStop(0,   `rgba(${rr},${gg},${bb},0.0)`);
    outerGlow.addColorStop(0.3, `rgba(${rr},${gg},${bb},0.18)`);
    outerGlow.addColorStop(0.7, `rgba(${rr},${gg},${bb},0.08)`);
    outerGlow.addColorStop(1,   `rgba(${rr},${gg},${bb},0.0)`);
    ctx.fillStyle = outerGlow;
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1.0, 0.38);   // flatten to disk angle
    const diskR   = r * 0.42;
    const diskW   = r * 0.18;
    for (let i = 0; i < 3; i++) {
      const frac  = i / 3;
      const alpha = 0.55 - frac * 0.22;
      const ring  = ctx.createRadialGradient(0, 0, diskR - diskW * (1 - frac), 0, 0, diskR + diskW * frac);
      ring.addColorStop(0,   `rgba(${rr},${gg},${bb},0.0)`);
      ring.addColorStop(0.4, `rgba(255,${Math.round(gg * 0.8 + 200 * 0.2)},${Math.round(bb * 0.4)},${alpha})`);
      ring.addColorStop(0.6, `rgba(${rr},${Math.round(gg * 0.6)},${Math.round(bb * 0.3)},${(alpha * 0.7).toFixed(2)})`);
      ring.addColorStop(1,   `rgba(${rr},${gg},${bb},0.0)`);
      ctx.fillStyle = ring;
      ctx.fillRect(-r, -r, TEX_SIZE, TEX_SIZE);
    }
    ctx.restore();

    const photonRingInner = r * 0.22;
    const photonRingOuter = r * 0.30;
    const photon = ctx.createRadialGradient(cx, cy, photonRingInner, cx, cy, photonRingOuter);
    photon.addColorStop(0,   `rgba(255,220,140,0.0)`);
    photon.addColorStop(0.4, `rgba(255,220,140,0.75)`);
    photon.addColorStop(0.65,`rgba(${rr},${Math.round(gg * 0.7 + 120)},60,0.45)`);
    photon.addColorStop(1,   `rgba(${rr},${gg},${bb},0.0)`);
    ctx.fillStyle = photon;
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

    const shadow = r * 0.21;
    ctx.globalCompositeOperation = 'destination-out';
    const black = ctx.createRadialGradient(cx, cy, 0, cx, cy, shadow);
    black.addColorStop(0,   'rgba(0,0,0,1.0)');
    black.addColorStop(0.8, 'rgba(0,0,0,1.0)');
    black.addColorStop(1,   'rgba(0,0,0,0.0)');
    ctx.fillStyle = black;
    ctx.beginPath();
    ctx.arc(cx, cy, shadow, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  });
}

function getDSOTexture(dso) {
  const key = `${dso.type}_${dso.color}_${dso.tilt ?? 0}`;
  return getCachedTexture(key, () => {
    switch (dso.type) {
      case 'spiral':     return makeSpiralTexture(dso.color, dso.tilt ?? 0);
      case 'elliptical': return makeEllipticalTexture(dso.color);
      case 'irregular':  return makeIrregularTexture(dso.color);
      case 'emission':   return makeEmissionTexture(dso.color);
      case 'planetary':  return makePlanetaryTexture(dso.color);
      case 'remnant':    return makeRemnantTexture(dso.color);
      case 'blackhole':  return makeBlackholeTexture(dso.color);
      default:           return makeEmissionTexture(dso.color);
    }
  });
}

let panelEl = null;

function ensurePanel() {
  if (panelEl) return;
  panelEl = document.getElementById('dso-panel');
  if (panelEl) {
    panelEl.querySelector('#dso-close')?.addEventListener('click', () => hidePanel());
  }
}

function showPanel(dso) {
  ensurePanel();
  const nameEl = panelEl.querySelector('#dso-name');
  nameEl.textContent = dso.name;
  nameEl.style.color = dso.type === 'blackhole'
    ? 'rgba(255,160,60,0.95)'
    : '';
  panelEl.querySelector('#dso-type-meta').textContent =
    `${DSO_TYPES[dso.type]?.label ?? dso.type}  ·  ${dso.constellation ?? ''}`;

  const statsEl = panelEl.querySelector('#dso-stats');

  const rows = [
    ['Designation',   dso.designation],
    ['Distance',      `${dso.distance.toLocaleString()} ${dso.distUnit}`],
  ];

  if (dso.mass != null) {
    rows.push(['Mass', dso.mass]);
  } else if (dso.diameterLy != null) {
    const d = dso.diameterLy;
    rows.push(['Diameter',
      d >= 1000
        ? `${(d / 1000).toFixed(1)}K ly`
        : d >= 1
          ? `${d.toLocaleString()} ly`
          : `${d.toFixed(2)} ly`,
    ]);
  }

  rows.push(['Angular size',  `${dso.angularDeg.toFixed(3)}°`]);
  rows.push(['Constellation', dso.constellation ?? '—']);

  if (dso.discoverer)  rows.push(['Discoverer', dso.discoverer]);
  if (dso.discovered)  rows.push(['Discovered', String(dso.discovered)]);

  statsEl.innerHTML = rows.map(([label, val]) => `
    <div class="dso-stat-row">
      <span class="dso-stat-label">${label}</span>
      <span class="dso-stat-val">${val}</span>
    </div>`).join('');

  panelEl.querySelector('#dso-desc').textContent = dso.description;
  const tagsEl = panelEl.querySelector('#dso-tags');
  tagsEl.innerHTML = (dso.tags ?? []).map(t => `<span class="dso-tag">${t}</span>`).join('');

  const thumbWrap   = panelEl.querySelector('#dso-thumb-wrap');
  const thumbImg    = panelEl.querySelector('#dso-thumb');
  const thumbCredit = panelEl.querySelector('#dso-thumb-credit');
  if (thumbWrap && thumbImg) {
    const fov     = Math.min(15, Math.max(0.1, (dso.angularDeg ?? 0.5) * 1.8));
    const aladin  = `https://alasky.cds.unistra.fr/hips-image-services/hips2fits?hips=CDS%2FP%2FDSS2%2Fcolor&width=300&height=300&fov=${fov.toFixed(3)}&ra=${dso.ra.toFixed(4)}&dec=${dso.dec.toFixed(4)}&projection=TAN&format=jpg`;

    thumbWrap.classList.add('has-image');
    thumbImg.alt = dso.name;

    thumbImg.onerror = () => {
      if (dso.imageUrl && thumbImg.src !== dso.imageUrl) {
        thumbImg.src    = dso.imageUrl;
        thumbCredit.textContent = dso.imageCredit ?? '';
      } else {
        thumbWrap.classList.remove('has-image');
      }
    };

    thumbCredit.textContent = 'CDS / Aladin Sky Atlas';
    thumbImg.src = aladin;
  }

  panelEl.classList.add('visible');
}

function hidePanel() {
  if (panelEl) panelEl.classList.remove('visible');
}

export function createGalaxyLayer(scene) {
  ensurePanel();

  const group    = new THREE.Group();
  group.name     = 'galaxies';
  scene.add(group);

  const refs = ALL_DSOS.map(dso => {
    const texture  = getDSOTexture(dso);
    const material = new THREE.SpriteMaterial({
      map:          texture,
      transparent:  true,
      opacity:      BASE_OPACITY,
      depthWrite:   false,
      blending:     THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    const sprite = new THREE.Sprite(material);

    const dir  = eqToScene(dso.ra, dso.dec);
    const dist = SKY_RADIUS * 0.97;   // slightly inside star sphere to avoid z-fighting
    sprite.position.copy(dir.multiplyScalar(dist));

    const rawSize = Math.max(
      SPRITE_MIN,
      Math.min(SPRITE_MAX, dso.angularDeg * DEG_TO_SCENE * 1.5),
    );
    sprite.scale.set(rawSize, rawSize, 1);
    sprite.userData.dso = dso;
    group.add(sprite);

    return { dso, sprite, material, worldPos: sprite.position.clone() };
  });

  const _projected = new THREE.Vector3();
  function pick(mx, my, camera, canvas) {
    if (!group.visible) return null;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    let best = null, bestD2 = 40 * 40;   // 40px threshold
    for (const ref of refs) {
      _projected.copy(ref.worldPos).project(camera);
      if (_projected.z > 1) continue;  // behind camera
      const sx = (_projected.x  + 1) / 2 * W;
      const sy = (-_projected.y + 1) / 2 * H;
      const d2 = (sx - mx) ** 2 + (sy - my) ** 2;
      if (d2 < bestD2) { bestD2 = d2; best = ref.dso; }
    }
    return best;
  }

  function getDsoScreenPos(dso, camera, canvas) {
    const ref = refs.find(r => r.dso === dso);
    if (!ref) return null;
    _projected.copy(ref.worldPos).project(camera);
    if (_projected.z > 1) return null;   // behind camera
    const W = canvas.clientWidth, H = canvas.clientHeight;
    const sx = (_projected.x  + 1) / 2 * W;
    const sy = (-_projected.y + 1) / 2 * H;

    const dist      = ref.worldPos.distanceTo(camera.position);
    const fovY      = camera.fov * (Math.PI / 180);
    const projScale = H / (2 * Math.tan(fovY / 2));
    const halfSizeScene = ref.sprite.scale.x / 2;
    const radiusPx  = Math.max(28, Math.min((halfSizeScene / dist) * projScale, H * 0.45));

    return { x: sx, y: sy, r: radiusPx };
  }

  function setVisible(v) { group.visible = v; if (!v) hidePanel(); }
  function toggle()      { setVisible(!group.visible); }
  function isVisible()   { return group.visible; }

  function getDsoWorldPos(dso) {
    const ref = refs.find(r => r.dso === dso);
    return ref ? ref.worldPos.clone() : null;
  }

  console.log(`[Galaxies] ${ALL_DSOS.length} deep-sky objects — galaxies, nebulae + black holes`);
  return { pick, showPanel, hidePanel, getDsoScreenPos, getDsoWorldPos, setVisible, toggle, isVisible };
}
