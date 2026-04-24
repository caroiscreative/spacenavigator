
import * as THREE from 'three/webgpu';
import { EARTH_RADIUS_UNITS, EARTH_ROTATION_RATE_RAD_S } from '../utils/coordinates.js';

const TEX = {
  day:      { local: '/textures/earth_day_8k.jpg',      cdn: 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg' },
  night:    { local: '/textures/earth_night_8k.jpg',    cdn: 'https://unpkg.com/three-globe/example/img/earth-night.jpg' },
  normal:   { local: '/textures/earth_normal_8k.jpg',   cdn: 'https://unpkg.com/three-globe/example/img/earth-topology.png' },
  specular: { local: '/textures/earth_specular_8k.jpg', cdn: null },
  clouds:   { local: '/textures/earth_clouds_4k.jpg',   cdn: 'https://unpkg.com/three-globe/example/img/earth-clouds.png' },
};

const SEGMENTS = 256;

const AXIAL_TILT_DEG = 23.44;

export async function createEarth(scene) {
  const loader = new THREE.TextureLoader();

  const [dayTex, nightTex, normalTex, specularTex, cloudsTex] = await Promise.all([
    loadTexture(loader, TEX.day),
    loadTexture(loader, TEX.night),
    loadTexture(loader, TEX.normal),
    loadTexture(loader, TEX.specular),
    loadTexture(loader, TEX.clouds),
  ]);

  dayTex.colorSpace    = THREE.SRGBColorSpace;
  nightTex.colorSpace  = THREE.SRGBColorSpace;
  cloudsTex.colorSpace = THREE.SRGBColorSpace;

  const anisotropy = 16;
  for (const t of [dayTex, nightTex, normalTex, specularTex, cloudsTex]) {
    if (t) t.anisotropy = anisotropy;
  }

  const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS_UNITS, SEGMENTS, SEGMENTS);

  const earthMat = new THREE.MeshStandardNodeMaterial({
    map:           dayTex,

    normalMap:     normalTex,
    normalScale:   new THREE.Vector2(0.35, 0.35),  // subtle — prevents over-sharpening

    emissiveMap:      nightTex,
    emissive:         new THREE.Color(0xFFEEAA),   // warm amber city glow
    emissiveIntensity: 1.0,

    metalnessMap:  specularTex,
    metalness:     0.05,   // mostly non-metallic world
    roughness:     0.85,

  });

  const earthMesh = new THREE.Mesh(earthGeo, earthMat);
  earthMesh.name  = 'earth';
  earthMesh.rotation.z = THREE.MathUtils.degToRad(AXIAL_TILT_DEG);
  scene.add(earthMesh);

  const cloudGeo = new THREE.SphereGeometry(EARTH_RADIUS_UNITS * 1.003, SEGMENTS, SEGMENTS);

  const cloudMat = new THREE.MeshStandardNodeMaterial({
    map:          cloudsTex,
    alphaMap:     cloudsTex,   // white clouds opaque, black sky transparent
    transparent:  true,
    opacity:      0.88,
    depthWrite:   false,       // prevents sorting artifacts with Earth surface
    roughness:    1.0,
    metalness:    0.0,
  });

  const cloudMesh     = new THREE.Mesh(cloudGeo, cloudMat);
  cloudMesh.name      = 'clouds';
  cloudMesh.rotation.z = THREE.MathUtils.degToRad(AXIAL_TILT_DEG);
  scene.add(cloudMesh);

  console.log('[Earth] 8K textures + normal map + clouds loaded');

  function update(simulationTimeMs) {
    const elapsedSec = simulationTimeMs / 1000;

    earthMesh.rotation.y = EARTH_ROTATION_RATE_RAD_S * elapsedSec;

    cloudMesh.rotation.y = EARTH_ROTATION_RATE_RAD_S * 1.05 * elapsedSec;
  }

  function setVisible(v) {
    earthMesh.visible = v;
    cloudMesh.visible = v;
  }

  return { earth: earthMesh, clouds: cloudMesh, update, setVisible };
}

function loadTexture(loader, src) {
  return new Promise((resolve) => {
    loader.load(
      src.local,
      (tex) => {
        console.debug(`[Earth] Loaded local: ${src.local}`);
        resolve(tex);
      },
      undefined,
      () => {
        if (src.cdn) {
          console.warn(`[Earth] Local texture failed, trying CDN: ${src.cdn}`);
          loader.load(src.cdn, resolve, undefined, () => resolve(createFallbackTexture()));
        } else {
          resolve(createFallbackTexture());
        }
      }
    );
  });
}

function createFallbackTexture() {
  const canvas  = document.createElement('canvas');
  canvas.width  = 2;
  canvas.height = 2;
  const ctx     = canvas.getContext('2d');
  ctx.fillStyle = '#1a4a7a';
  ctx.fillRect(0, 0, 2, 2);
  return new THREE.CanvasTexture(canvas);
}
