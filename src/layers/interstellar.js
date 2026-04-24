
import * as THREE from 'three/webgpu';

const DEG        = Math.PI / 180;
const AU_SCENE   = 650;                        // scene units per AU (matches sun.js)
const MU_SUN     = 2.959122082855911e-4;        // AU³/day²  (Gaussian GM)
const JD_UNIX    = 2440587.5;                   // JD of Unix epoch (1970-01-01)
const MS_PER_DAY = 86_400_000;

const SUN_DIR  = new THREE.Vector3(0.75, 0.18, 0.64).normalize();
const SUN_DIST = 650;   // scene units

const INTERSTELLAR_OBJECTS = [
  {
    id:    'oumuamua',
    name:  "1I/ʻOumuamua",
    color: '#CE93D8',                          // lavender purple
    a:  1.27924,      // AU  (always positive — physical semi-transverse axis)
    e:  1.20113,
    i:  122.7417 * DEG,   // inclination
    O:   24.5974 * DEG,   // Ω  longitude of ascending node
    w:  241.8105 * DEG,   // ω  argument of perihelion
    tpJD: 2458005.978,    // JD 2017-Sep-09 11:29 UTC
    winStart: new Date('2017-08-01T00:00:00Z').getTime(),
    winEnd:   new Date('2018-03-31T00:00:00Z').getTime(),
    hRange: [-2.6, 2.6],
    nSegments: 300,
    labels: [
      { text: 'ʻOumuamua\nPerihelion  Sep 9, 2017', H:  0.0 },
      { text: 'Entry  Aug 2017',                     H: -2.3 },
      { text: 'Exit   Jan 2018',                     H:  2.3 },
    ],
    dotRadius: 3.5,
  },
  {
    id:    'borisov',
    name:  '2I/Borisov',
    color: '#80DEEA',                          // cyan teal
    a:  0.852,
    e:  3.3564,
    i:  44.0516 * DEG,
    O: 308.1499 * DEG,
    w: 209.1241 * DEG,
    tpJD: 2458825.765,    // JD 2019-Dec-08 06:21 UTC
    winStart: new Date('2019-09-01T00:00:00Z').getTime(),
    winEnd:   new Date('2020-06-30T00:00:00Z').getTime(),
    hRange: [-1.8, 1.8],
    nSegments: 300,
    labels: [
      { text: 'Borisov\nPerihelion  Dec 8, 2019', H:  0.0 },
      { text: 'Discovery  Aug 30, 2019',           H: -1.55 },
      { text: 'Exit   Apr 2020',                   H:  1.55 },
    ],
    dotRadius: 3.5,
  },
  {
    id:    'atlas',
    name:  '3I/ATLAS',
    color: '#FFB74D',                          // amber orange
    a:  0.25934,      // AU
    e:  6.320503,
    i:  175.12093 * DEG,   // inclination — nearly retrograde
    O:  322.34889 * DEG,   // Ω  longitude of ascending node
    w:  127.77350 * DEG,   // ω  argument of perihelion
    tpJD: 2460977.60275,
    winStart: new Date('2025-06-01T00:00:00Z').getTime(),
    winEnd:   new Date('2026-07-31T00:00:00Z').getTime(),
    hRange: [-1.8, 2.5],
    nSegments: 300,
    labels: [
      { text: '3I/ATLAS\nPerihelion  Oct 29, 2025', H:  0.0  },
      { text: 'Discovery  Jul 3, 2025',              H: -1.7  },
      { text: 'Exiting  Apr 2026',                   H:  2.0  },
    ],
    dotRadius: 4.5,
  },
];

function jdToMs(jd) { return (jd - JD_UNIX) * MS_PER_DAY; }

function msToJd(ms) { return ms / MS_PER_DAY + JD_UNIX; }

function solveKepler(Mh, e) {
  let H = Mh === 0 ? 0 : Math.sign(Mh) * Math.log(2 * Math.abs(Mh) / e + 1.85);
  for (let iter = 0; iter < 50; iter++) {
    const f  = e * Math.sinh(H) - H - Mh;
    const fp = e * Math.cosh(H) - 1;
    const dH = f / fp;
    H -= dH;
    if (Math.abs(dH) < 1e-12) break;
  }
  return H;
}

function eclipticPos(obj, simTimeMs) {
  const { a, e, i, O, w, tpJD } = obj;
  const dt_days = msToJd(simTimeMs) - tpJD;          // days since perihelion
  const n   = Math.sqrt(MU_SUN / (a * a * a));        // mean motion rad/day
  const Mh  = n * dt_days;                             // hyperbolic mean anomaly
  const H   = solveKepler(Mh, e);                     // hyperbolic anomaly

  return eclipticFromH(obj, H);
}

function eclipticFromH(obj, H) {
  const { a, e, i, O, w } = obj;
  const p  = a * (e * e - 1);                         // semi-latus rectum (AU)
  const f  = 2 * Math.atan(Math.sqrt((e + 1) / (e - 1)) * Math.tanh(H / 2));
  const r  = p / (1 + e * Math.cos(f));

  const xp = r * Math.cos(f);                         // perifocal frame
  const yp = r * Math.sin(f);

  const cO = Math.cos(O), sO = Math.sin(O);
  const ci = Math.cos(i), si = Math.sin(i);
  const cw = Math.cos(w), sw = Math.sin(w);

  const x_ecl = (cO * cw - sO * sw * ci) * xp + (-cO * sw - sO * cw * ci) * yp;
  const y_ecl = (sO * cw + cO * sw * ci) * xp + (-sO * sw + cO * cw * ci) * yp;
  const z_ecl = (sw * si) * xp + (cw * si) * yp;

  return { x: x_ecl, y: y_ecl, z: z_ecl };
}

function eclipticToScene(ecl, sunPos) {
  return new THREE.Vector3(
    sunPos.x + ecl.x * AU_SCENE,
    sunPos.y + ecl.z * AU_SCENE,   // ecliptic Z (north) → scene Y (up)
    sunPos.z - ecl.y * AU_SCENE,   // ecliptic Y negated → scene Z
  );
}

function makeLabel(text, color = '#FFFFFF') {
  const lines    = text.split('\n');
  const fontSize = 22;
  const lineH    = fontSize + 6;
  const padding  = 14;

  const canvas  = document.createElement('canvas');
  const ctx     = canvas.getContext('2d');
  ctx.font = `bold ${fontSize}px "SF Mono", "Courier New", monospace`;

  const maxW = Math.max(...lines.map(l => ctx.measureText(l).width));
  canvas.width  = maxW + padding * 2;
  canvas.height = lines.length * lineH + padding * 2;

  ctx.font = `bold ${fontSize}px "SF Mono", "Courier New", monospace`;
  ctx.fillStyle = `${color}CC`;
  ctx.textBaseline = 'top';

  lines.forEach((line, idx) => {
    ctx.fillText(line, padding, padding + idx * lineH);
  });

  const texture = new THREE.Texture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({
    map:        texture,
    transparent: true,
    depthWrite:  false,
    blending:   THREE.AdditiveBlending,
    sizeAttenuation: true,
  });

  const sprite     = new THREE.Sprite(material);
  const aspect     = canvas.width / canvas.height;
  const baseHeight = 40;
  sprite.scale.set(aspect * baseHeight, baseHeight, 1);
  return sprite;
}

function makeDot(radius, hexColor) {
  const geo = new THREE.SphereGeometry(radius, 16, 16);
  const mat = new THREE.MeshBasicMaterial({
    color:     new THREE.Color(hexColor),
    transparent: true,
    depthWrite:  false,
  });
  const mesh = new THREE.Mesh(geo, mat);

  const canvas  = document.createElement('canvas');
  canvas.width  = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0,   hexColor + 'FF');
  grad.addColorStop(0.3, hexColor + '99');
  grad.addColorStop(1,   hexColor + '00');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const haloTex = new THREE.Texture(canvas);
  haloTex.needsUpdate = true;
  const haloMat = new THREE.SpriteMaterial({
    map: haloTex,
    transparent: true,
    depthWrite:  false,
    blending:    THREE.AdditiveBlending,
  });
  const halo   = new THREE.Sprite(haloMat);
  halo.scale.set(radius * 12, radius * 12, 1);
  mesh.add(halo);

  return mesh;
}

export function createInterstellarLayer(scene) {
  const sunPos = SUN_DIR.clone().multiplyScalar(SUN_DIST);

  const layerGroup = new THREE.Group();
  layerGroup.name  = 'interstellar';
  scene.add(layerGroup);

  const refs = INTERSTELLAR_OBJECTS.map(obj => {
    const [hMin, hMax]  = obj.hRange;
    const step          = (hMax - hMin) / (obj.nSegments - 1);
    const positions     = new Float32Array(obj.nSegments * 3);

    for (let seg = 0; seg < obj.nSegments; seg++) {
      const H   = hMin + seg * step;
      const ecl = eclipticFromH(obj, H);
      const sc  = eclipticToScene(ecl, sunPos);
      positions[seg * 3 + 0] = sc.x;
      positions[seg * 3 + 1] = sc.y;
      positions[seg * 3 + 2] = sc.z;
    }

    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const trailMat = new THREE.LineBasicMaterial({
      color:       new THREE.Color(obj.color),
      transparent:  true,
      opacity:      0.55,
      depthWrite:   false,
      blending:     THREE.AdditiveBlending,
    });
    const trail = new THREE.Line(trailGeo, trailMat);
    trail.name  = `trail_${obj.id}`;
    layerGroup.add(trail);

    const labelSprites = obj.labels.map(lbl => {
      const ecl  = eclipticFromH(obj, lbl.H);
      const pos  = eclipticToScene(ecl, sunPos);
      const sp   = makeLabel(lbl.text, obj.color);
      sp.position.copy(pos).addScalar(8);
      layerGroup.add(sp);
      return sp;
    });

    const dot = makeDot(obj.dotRadius, obj.color);
    dot.visible = false;
    layerGroup.add(dot);

    return { obj, trail, trailMat, dot, labelSprites };
  });

  function update(simTimeMs) {
    for (const ref of refs) {
      const { obj, dot, trailMat } = ref;
      const inWindow = simTimeMs >= obj.winStart && simTimeMs <= obj.winEnd;

      trailMat.opacity = inWindow ? 0.72 : 0.25;

      if (inWindow) {
        try {
          const ecl  = eclipticPos(obj, simTimeMs);
          const pos  = eclipticToScene(ecl, sunPos);
          dot.position.copy(pos);
          dot.visible = true;
        } catch {
          dot.visible = false;
        }
      } else {
        dot.visible = false;
      }
    }
  }

  function setVisible(v) {
    layerGroup.visible = v;
  }

  return { update, setVisible };
}

export const INTERSTELLAR_DATES = {
  oumuamua_entry:     new Date('2017-08-18T00:00:00Z').getTime(),
  oumuamua_perihelion: jdToMs(2458005.978),
  oumuamua_exit:      new Date('2018-01-01T00:00:00Z').getTime(),
  borisov_discovery:  new Date('2019-08-30T00:00:00Z').getTime(),
  borisov_perihelion: jdToMs(2458825.765),
  borisov_exit:       new Date('2020-04-01T00:00:00Z').getTime(),
  atlas_discovery:    new Date('2025-07-03T00:00:00Z').getTime(),
  atlas_perihelion:   jdToMs(2460977.60275),
  atlas_exit:         new Date('2026-04-30T00:00:00Z').getTime(),
};
