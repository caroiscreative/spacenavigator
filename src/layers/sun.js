
import * as THREE from 'three/webgpu';
import { EARTH_RADIUS_UNITS } from '../utils/coordinates.js';

const SUN_DISTANCE = 650;

const SUN_DIRECTION = new THREE.Vector3(0.75, 0.0, 0.64).normalize();

const SUN_RADIUS = 6;   // scene units (~3,000 km visual scale)

const DEG = Math.PI / 180;

const SUN_HALO_MIN_PX    = 16;
const SUN_HALO_MIN_WORLD_MULT = 3.0;
const SUN_HALO_FADE_IN   = 4.0;
const SUN_HALO_FADE_OUT  = 25.0;
const SUN_HALO_BASE_OPAC = 1.0;

export const SUN_SCENE_DIRECTION = new THREE.Vector3(0.75, 0.0, 0.64).normalize();
export const SUN_SCENE_DISTANCE  = SUN_DISTANCE;

export const SUN_REAL_RADIUS = Math.round(696340 / 500);   // 1393 scene units

const SUN_TEXTURE_PATH = '/textures/planets/2k_sun.jpg';

const SDO_DIRECT  = 'https://sdo.gsfc.nasa.gov/assets/img/latest/latest_256_0171.jpg';
const SDO_URL_171 = '/sdo/assets/img/latest/latest_256_0171.jpg';

const SDO_REFRESH_MS = 10 * 60 * 1000; // 10 minutes

export async function createSun(scene) {
  const loader = new THREE.TextureLoader();
  const sunPos = SUN_DIRECTION.clone().multiplyScalar(SUN_DISTANCE);

  const baseTex = createSunGradientTexture();

  const sunGeo = new THREE.SphereGeometry(SUN_RADIUS, 48, 48);
  const sunMat = new THREE.MeshBasicMaterial({
    map:   baseTex,
    color: new THREE.Color(1.0, 0.97, 0.88),
  });

  const sun      = new THREE.Mesh(sunGeo, sunMat);
  sun.position.copy(sunPos);
  sun.name       = 'sun';
  sun.frustumCulled = false;
  sun.userData.isSun = true;   // flag for click detection
  scene.add(sun);

  let sdoTex = null;
  loadTexture(loader, SUN_TEXTURE_PATH).then(tex => {
    if (!tex) return;
    tex.colorSpace  = THREE.SRGBColorSpace;
    tex.anisotropy  = 4;
    sdoTex = tex;
    sunMat.map   = tex;
    sunMat.color.set(0xffffff);
    sunMat.needsUpdate = true;
  });

  loadTexture(loader, SDO_URL_171).then(tex => {
    if (!tex) return;
    tex.colorSpace = THREE.SRGBColorSpace;
    const prev = sdoTex;
    sdoTex = tex;
    sunMat.map = tex;
    sunMat.color.set(0xFFCC88);  // warm tint for EUV gold corona
    sunMat.needsUpdate = true;
    prev?.dispose();
  });

  const coronas = [
    makeGlowShell(SUN_RADIUS * 1.7, 0xFFDD88, 0.10, scene, sunPos, 'sun-glow-0'),
  ];

  const sunHalo = createSunHaloSprite(scene);

  const sunLight = new THREE.DirectionalLight(0xFFF8E7, 2.2);  // warm white, increased intensity
  sunLight.position.copy(sunPos);
  sunLight.target.position.set(0, 0, 0);
  scene.add(sunLight);
  scene.add(sunLight.target);

  const refreshInterval = setInterval(async () => {
    const fresh = await loadTexture(loader, SDO_URL_171 + '?t=' + Date.now());
    if (fresh) {
      fresh.colorSpace = THREE.SRGBColorSpace;
      sunMat.map = fresh;
      sunMat.needsUpdate = true;
      sdoTex?.dispose();
      sdoTex = fresh;
    }
  }, SDO_REFRESH_MS);

  const holoGeo  = new THREE.SphereGeometry(SUN_REAL_RADIUS, 32, 16);
  const holoFill = new THREE.MeshBasicMaterial({
    color:       0xFF8800,
    transparent: true,
    opacity:     0.035,
    blending:    THREE.AdditiveBlending,
    depthWrite:  false,
    side:        THREE.FrontSide,
  });
  const holoMesh = new THREE.Mesh(holoGeo, holoFill);
  holoMesh.position.copy(sunPos);
  holoMesh.visible = false;
  scene.add(holoMesh);

  const edgeGeo  = new THREE.EdgesGeometry(new THREE.SphereGeometry(SUN_REAL_RADIUS, 20, 10));
  const edgeMat  = new THREE.LineBasicMaterial({
    color:       0xFF9900,
    transparent: true,
    opacity:     0.14,
    blending:    THREE.AdditiveBlending,
    depthWrite:  false,
  });
  const edgeMesh = new THREE.LineSegments(edgeGeo, edgeMat);
  edgeMesh.position.copy(sunPos);
  edgeMesh.visible = false;
  scene.add(edgeMesh);

  const sunPanelEl = document.getElementById('sun-panel');
  if (sunPanelEl) {
    sunPanelEl.querySelector('#sun-panel-close')
      ?.addEventListener('click', () => hidePanel());
  }

  function showPanel() {
    if (sunPanelEl) sunPanelEl.classList.add('visible');
    holoMesh.visible = true;
    edgeMesh.visible = true;
  }

  function hidePanel() {
    if (sunPanelEl) sunPanelEl.classList.remove('visible');
    holoMesh.visible = false;
    edgeMesh.visible = false;
  }

  function update(camera) {
    const d = camera.position.distanceTo(sun.position);

    const t       = (d - SUN_RADIUS * SUN_HALO_FADE_IN)
                  / (SUN_RADIUS * (SUN_HALO_FADE_OUT - SUN_HALO_FADE_IN));
    const opacity = Math.max(0, Math.min(1, t)) * SUN_HALO_BASE_OPAC;

    if (opacity < 0.005) {
      sunHalo.visible = false;
      return;
    }

    sunHalo.visible  = true;
    sunHalo.position.copy(sun.position);

    const fovFactor = 2 * Math.tan((camera.fov * DEG) / 2);
    const screenH   = window.innerHeight || 800;
    const minWorld  = (d * fovFactor * SUN_HALO_MIN_PX) / screenH;

    const worldSize = Math.max(minWorld, SUN_RADIUS * SUN_HALO_MIN_WORLD_MULT);

    sunHalo.scale.setScalar(worldSize);
    sunHalo.material.opacity = opacity;
  }

  function dispose() {
    clearInterval(refreshInterval);
    sunGeo.dispose();
    sunMat.dispose();
    baseTex.dispose();
    sdoTex?.dispose();
    sunHalo.material.map?.dispose();
    sunHalo.material.dispose();
    scene.remove(sunHalo);
    holoGeo.dispose();
    holoFill.dispose();
    scene.remove(holoMesh);
    edgeGeo.dispose();
    edgeMat.dispose();
    scene.remove(edgeMesh);
    sunPanelEl?.remove();
  }

  console.log(`[Sun] Initialized — radius ${SUN_RADIUS} units, true-size hologram ${SUN_REAL_RADIUS} units`);
  return { sun, coronas, sunLight, update, showPanel, hidePanel, dispose };
}

function makeGlowShell(radius, colorHex, opacity, scene, position, name) {
  const geo = new THREE.SphereGeometry(radius, 24, 24);
  const mat = new THREE.MeshBasicMaterial({
    color:       colorHex,
    transparent: true,
    opacity:     opacity,
    blending:    THREE.AdditiveBlending,
    depthWrite:  false,
    side:        THREE.FrontSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(position);
  mesh.name = name;
  scene.add(mesh);
  return mesh;
}

function loadTexture(loader, url) {
  return new Promise((resolve) => {
    loader.load(
      url,
      resolve,
      undefined,
      (err) => {
        console.warn('[Sun] SDO texture load failed — using gradient base:', err?.message ?? err);
        resolve(null);
      },
    );
  });
}

function createSunHaloTexture() {
  const SIZE = 256;
  const half = SIZE / 2;
  const canvas = document.createElement('canvas');
  canvas.width  = SIZE;
  canvas.height = SIZE;
  const ctx  = canvas.getContext('2d');

  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0.00, 'rgba(255,255,230,1.00)');  // white-hot core
  grad.addColorStop(0.10, 'rgba(255,240,160,0.95)');  // warm white
  grad.addColorStop(0.25, 'rgba(255,200, 80,0.75)');  // gold
  grad.addColorStop(0.45, 'rgba(255,140, 30,0.45)');  // orange
  grad.addColorStop(0.65, 'rgba(220, 80, 10,0.18)');  // deep orange
  grad.addColorStop(0.82, 'rgba(160, 40,  5,0.05)');  // red rim
  grad.addColorStop(1.00, 'rgba(  0,  0,  0,0.00)');  // transparent edge

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);

  const tex = new THREE.Texture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createSunHaloSprite(scene) {
  const mat = new THREE.SpriteMaterial({
    map:         createSunHaloTexture(),
    blending:    THREE.AdditiveBlending,
    transparent: true,
    opacity:     0,
    depthWrite:  false,
    depthTest:   false,   // always renders — never occluded by geometry
  });
  const sprite = new THREE.Sprite(mat);
  sprite.name          = 'sun-halo';
  sprite.frustumCulled = false;
  sprite.renderOrder   = 2;   // after star field and planets
  scene.add(sprite);
  return sprite;
}

function createSunGradientTexture() {
  const size   = 256;
  const canvas = document.createElement('canvas');
  canvas.width  = size;
  canvas.height = size;
  const ctx    = canvas.getContext('2d');
  const cx = size / 2, cy = size / 2, r = size / 2;

  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0.0,  '#fffde0'); // white-hot core
  grad.addColorStop(0.35, '#ffcc44'); // gold
  grad.addColorStop(0.65, '#ff8800'); // orange
  grad.addColorStop(1.0,  '#cc4400'); // deep red rim

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.Texture(canvas);
  tex.needsUpdate = true;
  return tex;
}
