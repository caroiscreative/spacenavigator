
import * as THREE    from 'three/webgpu';
import { getPlanet } from 'ephemeris';

const SUN_DIRECTION = new THREE.Vector3(0.75, 0.0, 0.64).normalize();
const AU_SCENE      = 650;     // 1 AU in scene units (matches sun.js SUN_DISTANCE)
const DEG           = Math.PI / 180;

const ORBIT_RING_SHOW_DIST = 2000;   // scene units — start fading in
const ORBIT_RING_FULL_DIST = 22000;  // scene units — fully opaque (outer solar system scale)
const MOON_ORBIT_SHOW_DIST = 2000;  // scene units (same as planet rings)
const MOON_ORBIT_FULL_DIST = 12000;  // scene units — fully opaque

const INCL_NEAR_DIST  = 400;    // below: real inclination × 1×
const INCL_FAR_DIST   = 2800;   // above: full amplification × INCL_MAX_SCALE
const INCL_MAX_SCALE  = 7;      // ×7 — visible tilt on all planets without looking extreme

const MOON_VISUAL_R = 100;   // fixed display orbit radius in scene units

const _nodeAxis = new THREE.Vector3();
const _inclQuat = new THREE.Quaternion();
const _tmpVec   = new THREE.Vector3();   // scratch vector — reused every frame

function getInclinationScale(camDist) {
  const t = Math.max(0, Math.min(1, (camDist - INCL_NEAR_DIST) / (INCL_FAR_DIST - INCL_NEAR_DIST)));
  const ease = t * t * (3 - 2 * t);   // smoothstep
  return 1 + (INCL_MAX_SCALE - 1) * ease;
}

function applyOrbitTilt(ring, camDist) {
  const scale = getInclinationScale(camDist);
  const i     = ring.inclinationDeg * scale * DEG;
  const Omega = ring.ascNodeDeg * DEG;
  _nodeAxis.set(Math.cos(Omega), 0, -Math.sin(Omega));
  _inclQuat.setFromAxisAngle(_nodeAxis, i);
  ring.group.quaternion.copy(_inclQuat);
}

const HALO_MIN_PX      = 18;   // minimum screen-pixel diameter of planet halo (subtle)
const HALO_BASE_OPAC   = 0.55; // max opacity when far away (down from 0.72 for subtlety)

const PLANET_MIN_PX    = 8;    // minimum sphere radius in screen pixels (8px → 16px diameter)
const PLANET_MAX_SCALE = 20;   // never scale the mesh more than 20× its real size

const HALO_FADE_IN     = 5.0;  // fully transparent inside 5× radius
const HALO_FADE_OUT    = 20.0; // fully opaque beyond 20× radius

const VSOP_NAMES = {
  Mercury: 'mercury',
  Venus:   'venus',
  Mars:    'mars',
  Jupiter: 'jupiter',
  Saturn:  'saturn',
  Uranus:  'uranus',
  Neptune: 'neptune',
};

const EPHEM_SIM_INTERVAL_MS = 2 * 60 * 60 * 1000;   // 2 simulated hours

const EPHEM_REAL_INTERVAL_MS = 500;

function moonGeocentric(simTimeMs) {
  const JD = simTimeMs / 86400000.0 + 2440587.5;   // Julian Date
  const T  = (JD - 2451545.0) / 36525.0;           // centuries from J2000.0

  const norm = x => ((x % 360) + 360) % 360;

  const L1 = norm(218.3164477 + 481267.88123421 * T);  // Moon mean longitude
  const D  = norm(297.8501921 + 445267.1114034  * T);  // Mean elongation
  const M  = norm(357.5291092 + 35999.0502909   * T);  // Sun mean anomaly
  const M1 = norm(134.9633964 + 477198.8675055  * T);  // Moon mean anomaly
  const F  = norm( 93.2720950 + 483202.0175233  * T);  // Argument of latitude

  const r2d = Math.PI / 180;

  const dL = 6.289  * Math.sin(M1         * r2d)
           + 1.274  * Math.sin((2*D - M1) * r2d)
           - 0.658  * Math.sin(2*D        * r2d)
           + 0.214  * Math.sin(2*M1       * r2d)
           - 0.186  * Math.sin(M          * r2d)
           - 0.114  * Math.sin(2*F        * r2d);

  const dB = 5.128  * Math.sin(F          * r2d)
           + 0.280  * Math.sin((M1 +  F)  * r2d)
           - 0.272  * Math.sin((M1 -  F)  * r2d)
           - 0.173  * Math.sin((2*D -  F) * r2d);

  const dR = -20905 * Math.cos(M1         * r2d)
           -  3699  * Math.cos((2*D - M1) * r2d)
           -  2956  * Math.cos(2*D        * r2d);

  return {
    lambda: norm(L1 + dL) * r2d,   // geocentric ecliptic longitude (rad)
    beta:   dB * r2d,               // geocentric ecliptic latitude (rad)
    r:      385000.56 + dR,         // geocentric distance (km)
  };
}

const MOON_DEF = {
  name:        'Moon',
  type:        'Natural satellite',
  radius:      3.47,   // 1737 km / 500
  color:       0x9B9B9B,
  emissive:    0x080808,
  texturePath: '/textures/planets/2k_moon.jpg',
  diameterKm:  3474,
  massKg:      7.342e22,
  gravityMs2:  1.62,
  dayHours:    655.7,   // synchronous rotation ≈ 27.3 days
  yearDays:    27.32,
  tempKelvin:  250,
  distAU:      0.00257,
  description: "Earth's only natural satellite. The fifth-largest moon in the Solar System. Stabilises Earth's axial tilt and drives ocean tides. The only extraterrestrial body visited by humans (Apollo, 1969–1972).",
  imageUrl:    '/textures/planets/2k_moon.jpg',
  imageCredit: 'NASA / Solar System Scope',
  moons: [],
};

const PLANETS = [
  {
    name:        'Mercury',
    radius:      4.9,
    color:       0x9B9B9B, emissive: 0x111111,
    texturePath: '/textures/planets/2k_mercury.jpg',
    type:        'Rocky planet',
    diameterKm:  4879,
    massKg:      3.285e23,
    gravityMs2:  3.7,
    dayHours:    1407.6,
    yearDays:    88.0,
    tempKelvin:  440,
    distAU:      0.387,
    inclinationDeg: 7.005, ascNodeDeg: 48.331,   // J2000 mean orbital elements
    description: 'Closest planet to the Sun. No atmosphere, extreme temperature swings from −180°C to 430°C. Heavily cratered surface similar to the Moon.',
    imageUrl:    '/textures/planets/2k_mercury.jpg',
    imageCredit: 'NASA / Solar System Scope',
    moons: [],
  },
  {
    name:        'Venus',
    radius:      12.1,
    color:       0xE8CD8A, emissive: 0x221500,
    texturePath: '/textures/planets/2k_venus_surface.jpg',
    type:        'Rocky planet',
    diameterKm:  12104,
    massKg:      4.867e24,
    gravityMs2:  8.87,
    dayHours:    -5832.5,
    yearDays:    224.7,
    tempKelvin:  737,
    distAU:      0.723,
    inclinationDeg: 3.395, ascNodeDeg: 76.678,
    description: 'Hottest planet due to runaway greenhouse effect. Thick CO₂ atmosphere with sulfuric acid clouds. Crushingly dense — surface pressure is 90× Earth.',
    imageUrl:    '/textures/planets/2k_venus_surface.jpg',
    imageCredit: 'NASA / Solar System Scope',
    moons: [],
  },
  {
    name:        'Mars',
    radius:      6.8,
    color:       0xC1440E, emissive: 0x1A0400,
    texturePath: '/textures/planets/2k_mars.jpg',
    type:        'Rocky planet',
    diameterKm:  6779,
    massKg:      6.39e23,
    gravityMs2:  3.71,
    dayHours:    24.6,
    yearDays:    687.0,
    tempKelvin:  210,
    distAU:      1.524,
    inclinationDeg: 1.850, ascNodeDeg: 49.562,
    description: 'The Red Planet. Home to Olympus Mons (21 km tall, the largest volcano in the Solar System) and Valles Marineris (4000 km long canyon). Has polar ice caps, seasons, and ancient river valleys.',
    imageUrl:    '/textures/planets/2k_mars.jpg',
    imageCredit: 'NASA / Solar System Scope',
    moons: [
      { name: 'Phobos', radiusKm: 11,  distKm: 9376,   periodDays: 0.319 },
      { name: 'Deimos', radiusKm: 6,   distKm: 23463,  periodDays: 1.263 },
    ],
  },
  {
    name:        'Jupiter',
    radius:      143,
    color:       0xC88B3A, emissive: 0x150A00,
    texturePath: '/textures/planets/2k_jupiter.jpg',
    type:        'Gas giant',
    diameterKm:  139820,
    massKg:      1.898e27,
    gravityMs2:  24.79,
    dayHours:    9.9,
    yearDays:    4333,
    tempKelvin:  165,
    distAU:      5.203,
    inclinationDeg: 1.303, ascNodeDeg: 100.464,
    description: 'Largest planet — 1300 Earths could fit inside. The Great Red Spot is a storm larger than Earth, ongoing for 350+ years. Has the most known moons (95+) and a faint ring system.',
    imageUrl:    '/textures/planets/2k_jupiter.jpg',
    imageCredit: 'NASA / Solar System Scope',
    moons: [
      { name: 'Io',       radiusKm: 1821,  distKm: 421800,   periodDays: 1.769 },
      { name: 'Europa',   radiusKm: 1560,  distKm: 671100,   periodDays: 3.551 },
      { name: 'Ganymede', radiusKm: 2634,  distKm: 1070400,  periodDays: 7.155 },
      { name: 'Callisto', radiusKm: 2410,  distKm: 1882700,  periodDays: 16.69 },
      { name: 'Amalthea', radiusKm: 83,    distKm: 181400,   periodDays: 0.498 },
      { name: 'Himalia',  radiusKm: 69,    distKm: 11480000, periodDays: 250.6 },
      { name: 'Thebe',    radiusKm: 49,    distKm: 221900,   periodDays: 0.675 },
      { name: 'Elara',    radiusKm: 40,    distKm: 11740000, periodDays: 259.6 },
    ],
  },
  {
    name:        'Saturn',
    radius:      120,
    rings:       true,
    color:       0xEAD6A3, emissive: 0x161200,
    texturePath:  '/textures/planets/2k_saturn.jpg',
    ringTexture:  '/textures/planets/2k_saturn_ring_alpha.png',
    type:        'Gas giant',
    diameterKm:  116460,
    massKg:      5.683e26,
    gravityMs2:  10.44,
    dayHours:    10.7,
    yearDays:    10759,
    tempKelvin:  134,
    distAU:      9.537,
    inclinationDeg: 2.489, ascNodeDeg: 113.665,
    description: 'Famous for its spectacular ring system — ice and rock particles from cm to km in size. Least dense planet (would float on water). Wind speeds reach 1800 km/h. 146 known moons.',
    imageUrl:    '/textures/planets/2k_saturn.jpg',
    imageCredit: 'NASA / Solar System Scope',
    moons: [
      { name: 'Titan',      radiusKm: 2574,  distKm: 1221870,  periodDays: 15.95 },
      { name: 'Rhea',       radiusKm: 764,   distKm: 527108,   periodDays: 4.518 },
      { name: 'Iapetus',    radiusKm: 736,   distKm: 3560820,  periodDays: 79.32 },
      { name: 'Dione',      radiusKm: 562,   distKm: 377396,   periodDays: 2.737 },
      { name: 'Tethys',     radiusKm: 533,   distKm: 294619,   periodDays: 1.888 },
      { name: 'Enceladus',  radiusKm: 252,   distKm: 237948,   periodDays: 1.370 },
      { name: 'Mimas',      radiusKm: 198,   distKm: 185539,   periodDays: 0.942 },
      { name: 'Hyperion',   radiusKm: 135,   distKm: 1481010,  periodDays: 21.28 },
      { name: 'Phoebe',     radiusKm: 107,   distKm: 12869700, periodDays: 550.6 },
    ],
  },
  {
    name:        'Uranus',
    radius:      51,
    color:       0x7DE8E8, emissive: 0x001E1E,
    texturePath: '/textures/planets/2k_uranus.jpg',
    type:        'Ice giant',
    diameterKm:  50724,
    massKg:      8.681e25,
    gravityMs2:  8.87,
    dayHours:    -17.2,
    yearDays:    30589,
    tempKelvin:  76,
    distAU:      19.19,
    inclinationDeg: 0.773, ascNodeDeg: 74.006,
    description: 'Ice giant that rotates on its side — axial tilt of 98°, so its poles experience 42 years of continuous sunlight and darkness. Blue-green methane atmosphere. Has 13 faint rings.',
    imageUrl:    '/textures/planets/2k_uranus.jpg',
    imageCredit: 'NASA / Solar System Scope',
    moons: [
      { name: 'Titania',  radiusKm: 788, distKm: 435910,  periodDays: 8.706 },
      { name: 'Oberon',   radiusKm: 761, distKm: 583520,  periodDays: 13.46 },
      { name: 'Umbriel',  radiusKm: 584, distKm: 266000,  periodDays: 4.144 },
      { name: 'Ariel',    radiusKm: 578, distKm: 191020,  periodDays: 2.520 },
      { name: 'Miranda',  radiusKm: 235, distKm: 129390,  periodDays: 1.413 },
      { name: 'Puck',     radiusKm: 81,  distKm: 86010,   periodDays: 0.762 },
    ],
  },
  {
    name:        'Neptune',
    radius:      49,
    color:       0x4B70DD, emissive: 0x00061A,
    texturePath: '/textures/planets/2k_neptune.jpg',
    type:        'Ice giant',
    diameterKm:  49244,
    massKg:      1.024e26,
    gravityMs2:  11.15,
    dayHours:    16.1,
    yearDays:    59800,
    tempKelvin:  72,
    distAU:      30.07,
    inclinationDeg: 1.770, ascNodeDeg: 131.784,
    description: 'Farthest planet. Has the fastest winds in the Solar System — up to 2100 km/h. The Great Dark Spot (a storm) was as large as Earth. Discovered in 1846 through mathematical prediction alone.',
    imageUrl:    '/textures/planets/2k_neptune.jpg',
    imageCredit: 'NASA / Solar System Scope',
    moons: [
      { name: 'Triton',    radiusKm: 1353, distKm: 354760,  periodDays: -5.877 },
      { name: 'Proteus',   radiusKm: 210,  distKm: 117647,  periodDays: 1.122 },
      { name: 'Nereid',    radiusKm: 170,  distKm: 5513400, periodDays: 360.1 },
      { name: 'Larissa',   radiusKm: 97,   distKm: 73548,   periodDays: 0.555 },
      { name: 'Galatea',   radiusKm: 88,   distKm: 61953,   periodDays: 0.429 },
    ],
  },
];

const ORBIT_DIM      = 0.45;  // full-brightness opacity at solar system scale
const ORBIT_DIM_NEAR = 0.04;  // near-zero opacity at LEO/Earth view — rings emerge as you zoom out
const ORBIT_RING_SEGS = 128;
const ORBIT_COLORS = Object.fromEntries(
  PLANETS.map(p => [p.name, new THREE.Color(p.color).multiplyScalar(ORBIT_DIM)])
);
ORBIT_COLORS['Earth']   = new THREE.Color(0x6ADEF6).multiplyScalar(ORBIT_DIM);
ORBIT_COLORS['Moon']    = new THREE.Color(0x9B9B9B).multiplyScalar(ORBIT_DIM);
ORBIT_COLORS['Mars']    = new THREE.Color(0xFF4500).multiplyScalar(0.75);  // bright orange-red
ORBIT_COLORS['Neptune'] = new THREE.Color(0x6B9FFF).multiplyScalar(0.80);  // bright blue

export function createSolarSystem(scene, camera) {
  const sunPos  = SUN_DIRECTION.clone().multiplyScalar(AU_SCENE);
  const loader  = new THREE.TextureLoader();
  const planets = PLANETS.map(def => buildPlanet(def, scene, sunPos, loader));

  const earthOrbitRing = buildOrbitRing(AU_SCENE,     'Earth', sunPos,                    scene, 0,     0      );
  const moonOrbitRing  = buildOrbitRing(384400 / 500, 'Moon',  new THREE.Vector3(0,0,0),  scene, 5.145, 125.08 );
  moonOrbitRing.group.scale.setScalar(MOON_VISUAL_R / (384400 / 500));

  const moonGeo = new THREE.SphereGeometry(MOON_DEF.radius, 32, 32);
  const moonMat = new THREE.MeshStandardNodeMaterial({
    color:   MOON_DEF.color,
    emissive: MOON_DEF.emissive,
    roughness: 0.95,
    metalness: 0.0,
  });
  const moonMesh     = new THREE.Mesh(moonGeo, moonMat);
  moonMesh.name      = 'Moon';
  moonMesh.castShadow    = true;
  moonMesh.receiveShadow = true;
  moonMesh.userData.planetDef = MOON_DEF;
  scene.add(moonMesh);

  loader.loadAsync(MOON_DEF.texturePath)
    .then(tex => {
      tex.colorSpace = THREE.SRGBColorSpace;
      moonMat.map   = tex;
      moonMat.color.set(0xffffff);
      moonMat.needsUpdate = true;
    })
    .catch(() => {  });

  const moonHalo = createHaloSprite(MOON_DEF.color, scene);

  let lastEphemRealTime = -Infinity;   // Date.now() of last ephemeris call
  let lastEphemSimTime  = -Infinity;   // simTimeMs of last ephemeris call

  function update(simTimeMs) {
    const now      = Date.now();
    const camDist  = camera.position.length();
    const inclScale = getInclinationScale(camDist);   // shared by rings + planet Y

    const simDelta  = Math.abs(simTimeMs - lastEphemSimTime);
    const realDelta = now - lastEphemRealTime;

    if (simDelta >= EPHEM_SIM_INTERVAL_MS || realDelta >= EPHEM_REAL_INTERVAL_MS) {
      lastEphemRealTime = now;
      lastEphemSimTime  = simTimeMs;
      const simDate = new Date(simTimeMs);

      for (const planet of planets) {
        const vsopKey = VSOP_NAMES[planet.def.name];
        if (!vsopKey) continue;

        try {
          const result = getPlanet(vsopKey, simDate);
          const raw    = result.observed[vsopKey].raw;
          const polar  = raw.position.polar;
          const L = polar.longitude;            // heliocentric ecliptic longitude (rad)
          const B = polar.latitude;             // heliocentric ecliptic latitude  (rad)
          const r = polar.distance * AU_SCENE;
          const rCosB = r * Math.cos(B);

          planet.eclX =  rCosB * Math.cos(L);
          planet.eclZ = -rCosB * Math.sin(L);
          planet.mesh.position.set(sunPos.x + planet.eclX, sunPos.y, sunPos.z + planet.eclZ);
        } catch {
        }

        if (planet.ringMesh) {
          planet.ringMesh.position.copy(planet.mesh.position);
        }
      }
    }

    const inclFactor  = (getInclinationScale(camDist) - 1) / (INCL_MAX_SCALE - 1); // 0→1
    const ringOpacity = ORBIT_DIM_NEAR + (ORBIT_DIM - ORBIT_DIM_NEAR) * inclFactor;

    for (const planet of planets) {
      if (planet.orbitRing) {
        planet.orbitRing.line.visible = true;
        planet.orbitRing.mat.opacity  = ringOpacity;
        applyOrbitTilt(planet.orbitRing, camDist);
      }
      if (planet.eclX !== undefined && planet.orbitRing) {
        _tmpVec.set(planet.eclX, 0, planet.eclZ);
        _tmpVec.applyQuaternion(planet.orbitRing.group.quaternion);
        planet.mesh.position.set(sunPos.x + _tmpVec.x, sunPos.y + _tmpVec.y, sunPos.z + _tmpVec.z);
        if (planet.ringMesh) {
          planet.ringMesh.position.copy(planet.mesh.position);
        }
      }
    }
    earthOrbitRing.line.visible = true;
    earthOrbitRing.mat.opacity  = ringOpacity;
    applyOrbitTilt(earthOrbitRing, camDist);

    moonOrbitRing.line.visible  = true;
    moonOrbitRing.mat.opacity   = ORBIT_DIM;
    moonOrbitRing.group.position.set(0, 0, 0);   // Earth always at scene origin
    applyOrbitTilt(moonOrbitRing, camDist);

    const moon = moonGeocentric(simTimeMs);
    const cosB = Math.cos(moon.beta);
    _tmpVec.set(
       MOON_VISUAL_R * cosB * Math.cos(moon.lambda),
       0,
      -MOON_VISUAL_R * cosB * Math.sin(moon.lambda),
    );
    _tmpVec.applyQuaternion(moonOrbitRing.group.quaternion);
    moonMesh.position.set(_tmpVec.x, _tmpVec.y, _tmpVec.z);

    const fovFactor = 2 * Math.tan((camera.fov * DEG) / 2);
    const screenH   = window.innerHeight || 800;

    for (const planet of planets) {
      if (planet.halo) {
        updateHalo(planet.halo, planet.mesh.position, planet.def.radius, fovFactor, screenH);
      }
      const pDist    = camera.position.distanceTo(planet.mesh.position);
      const minWorld = (PLANET_MIN_PX * pDist * fovFactor) / screenH;
      planet.mesh.scale.setScalar(
        Math.min(PLANET_MAX_SCALE, Math.max(1.0, minWorld / planet.def.radius))
      );
    }
    updateHalo(moonHalo, moonMesh.position, MOON_DEF.radius, fovFactor, screenH);

    const moonScaleDist = camera.position.distanceTo(moonMesh.position);
    const moonMinW      = (PLANET_MIN_PX * moonScaleDist * fovFactor) / screenH;
    moonMesh.scale.setScalar(
      Math.min(PLANET_MAX_SCALE, Math.max(1.0, moonMinW / MOON_DEF.radius))
    );
  }

  function updateHalo(halo, pos, radius, fovFactor, screenH) {
    const d = camera.position.distanceTo(pos);

    const t       = (d - radius * HALO_FADE_IN) / (radius * (HALO_FADE_OUT - HALO_FADE_IN));
    const opacity = Math.max(0, Math.min(1, t)) * HALO_BASE_OPAC;

    if (opacity < 0.005) {
      halo.visible = false;
      return;
    }

    halo.visible = true;
    halo.position.copy(pos);

    const minWorld = (d * fovFactor * HALO_MIN_PX) / screenH;
    halo.scale.setScalar(minWorld);
    halo.material.opacity = opacity;
  }

  function getMeshes() {
    const result = planets.map(p => ({ mesh: p.mesh, def: p.def }));
    result.push({ mesh: moonMesh, def: MOON_DEF });   // Moon is clickable/flyable
    return result;
  }

  function dispose() {
    earthOrbitRing.line.geometry.dispose(); earthOrbitRing.mat.dispose(); scene.remove(earthOrbitRing.group);
    moonOrbitRing.line.geometry.dispose();  moonOrbitRing.mat.dispose();  scene.remove(moonOrbitRing.group);

    moonGeo.dispose();
    moonMat.dispose();
    scene.remove(moonMesh);
    moonHalo.material.map?.dispose();
    moonHalo.material.dispose();
    scene.remove(moonHalo);

    for (const planet of planets) {
      planet.mesh.geometry.dispose();
      planet.mesh.material.dispose();
      scene.remove(planet.mesh);
      if (planet.halo) {
        planet.halo.material.map?.dispose();
        planet.halo.material.dispose();
        scene.remove(planet.halo);
      }
      if (planet.ringMesh) {
        planet.ringMesh.geometry.dispose();
        planet.ringMesh.material.dispose();
        scene.remove(planet.ringMesh);
      }
      if (planet.orbitRing) {
        planet.orbitRing.line.geometry.dispose();
        planet.orbitRing.mat.dispose();
        scene.remove(planet.orbitRing.group);
      }
    }
  }

  console.log('[SolarSystem] Layer created — 7 planets + Moon, VSOP87 ephemeris, 2K textures');
  return { update, dispose, getMeshes };
}

function buildPlanet(def, scene, sunPos, loader) {
  const segs = def.radius > 50 ? 48 : 24;
  const geo  = new THREE.SphereGeometry(def.radius, segs, segs);

  const mat = new THREE.MeshStandardNodeMaterial({
    color:             def.color,
    emissive:          def.emissive,
    emissiveIntensity: 0.3,
    roughness:         0.88,
    metalness:         0.0,
  });

  loader.load(def.texturePath, (tex) => {
    tex.colorSpace    = THREE.SRGBColorSpace;
    tex.anisotropy    = 4;
    mat.map           = tex;
    mat.color.set(0xffffff);   // neutral once texture is applied
    mat.emissiveIntensity = 0.05;
    mat.needsUpdate   = true;
  }, undefined, () => {
    console.warn(`[SolarSystem] Texture failed for ${def.name} — using colour fallback`);
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name  = `planet-${def.name.toLowerCase()}`;
  mesh.frustumCulled   = false;
  mesh.userData.planetDef = def;
  scene.add(mesh);

  let ringMesh = null;
  if (def.rings) {
    const rInner  = def.radius * 1.22;
    const rOuter  = def.radius * 2.25;
    const ringGeo = new THREE.RingGeometry(rInner, rOuter, 128, 8);

    {
      const pos = ringGeo.attributes.position;
      const uv  = ringGeo.attributes.uv;
      const v3  = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v3.fromBufferAttribute(pos, i);
        const r = v3.length();                         // distance from ring centre
        const u = (r - rInner) / (rOuter - rInner);   // 0 = inner, 1 = outer
        uv.setXY(i, u, 0.5);                          // V=0.5 — sample middle row
      }
      uv.needsUpdate = true;
    }

    const ringMat = new THREE.MeshBasicNodeMaterial({
      color:       0xffffff,
      side:        THREE.DoubleSide,
      transparent: true,
      alphaTest:   0.02,    // discard fully-transparent gaps between ring bands
      depthWrite:  false,   // don't clip the planet sphere behind the ring
      depthTest:   true,
    });

    if (def.ringTexture) {
      loader.load(def.ringTexture, (tex) => {
        tex.colorSpace   = THREE.SRGBColorSpace;
        tex.wrapS        = THREE.ClampToEdgeWrapping;
        tex.wrapT        = THREE.ClampToEdgeWrapping;
        ringMat.map      = tex;
        ringMat.alphaMap = tex;
        ringMat.needsUpdate = true;
      }, undefined, () => {
        ringMat.color.set(0xCBBC9E);
        ringMat.opacity  = 0.55;
        ringMat.alphaTest = 0;
        ringMat.needsUpdate = true;
      });
    }

    ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.name          = 'saturn-rings';
    ringMesh.frustumCulled = false;
    ringMesh.rotation.x    = 26.7 * DEG;
    scene.add(ringMesh);
  }

  const halo = createHaloSprite(def.color, scene);

  const a_approx  = def.distAU * AU_SCENE;
  const orbitRing = buildOrbitRing(a_approx, def.name, sunPos, scene,
    def.inclinationDeg ?? 0, def.ascNodeDeg ?? 0);

  return { def, mesh, ringMesh, orbitRing, halo };
}

function createHaloTexture(hexColor) {
  const SIZE = 128;
  const half = SIZE / 2;
  const canvas = document.createElement('canvas');
  canvas.width  = SIZE;
  canvas.height = SIZE;
  const ctx  = canvas.getContext('2d');
  const col  = new THREE.Color(hexColor);
  const r    = Math.round(col.r * 255);
  const g    = Math.round(col.g * 255);
  const b    = Math.round(col.b * 255);
  const c    = (a) => `rgba(${r},${g},${b},${a})`;

  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0.00, c(0.80));   // bright centre
  grad.addColorStop(0.28, c(0.55));
  grad.addColorStop(0.52, c(0.38));
  grad.addColorStop(0.72, c(0.52));   // limb ring — subtle atmospheric emphasis
  grad.addColorStop(0.83, c(0.22));
  grad.addColorStop(0.95, c(0.04));
  grad.addColorStop(1.00, c(0.00));

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);

  const tex = new THREE.Texture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createHaloSprite(hexColor, scene) {
  const mat = new THREE.SpriteNodeMaterial({
    map:         createHaloTexture(hexColor),
    blending:    THREE.AdditiveBlending,
    transparent: true,
    opacity:     0,
    depthWrite:  false,
    depthTest:   false,   // always renders — never hidden behind geometry
  });
  const sprite = new THREE.Sprite(mat);
  sprite.frustumCulled = false;
  sprite.renderOrder   = 1;   // after star field
  scene.add(sprite);
  return sprite;
}

function buildOrbitRing(a, planetName, center, scene, inclinationDeg = 0, ascNodeDeg = 0) {
  const pts = new Float32Array((ORBIT_RING_SEGS + 1) * 3);
  for (let j = 0; j <= ORBIT_RING_SEGS; j++) {
    const theta    = (j / ORBIT_RING_SEGS) * Math.PI * 2;
    pts[j * 3]     = a * Math.cos(theta);
    pts[j * 3 + 1] = 0;
    pts[j * 3 + 2] = -a * Math.sin(theta);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));

  const c   = ORBIT_COLORS[planetName] ?? new THREE.Color(0x444444);
  const mat = new THREE.LineBasicNodeMaterial({
    color:       c,
    transparent: true,
    opacity:     1.0,
    blending:    THREE.AdditiveBlending,
    depthWrite:  false,
    depthTest:   false,
  });

  const line         = new THREE.Line(geo, mat);
  line.name          = `orbit-${planetName.toLowerCase()}`;
  line.frustumCulled = false;

  const group         = new THREE.Group();
  group.name          = `orbit-group-${planetName.toLowerCase()}`;
  group.position.copy(center);
  group.frustumCulled = false;
  group.add(line);
  scene.add(group);

  return { group, line, mat, inclinationDeg, ascNodeDeg };
}
