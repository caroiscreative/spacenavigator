
import * as THREE from 'three/webgpu';
import { createRenderer }       from './core/renderer.js';
import { createCamera }         from './core/camera.js';
import { createNavigation }     from './core/navigation.js';
import { loadHYG }              from './data/hyg-loader.js';
import { createStarField }      from './layers/starfield.js';
import { createConstellations } from './layers/constellations.js';
import { createEarth }          from './layers/earth.js';
import { createAtmosphere }     from './layers/atmosphere.js';
import { createSun }            from './layers/sun.js';
import { fetchTLEs }             from './data/tle-fetcher.js';
import { createSatellites }     from './layers/satellites.js';
import { createTrail }          from './layers/trails.js';
import { createGroupOverlay }   from './layers/group-overlay.js';
import { createOrbitRings }     from './layers/orbit-rings.js';
import { createSearch }         from './ui/search.js';
import { createSolarSystem }    from './layers/solar-system.js';
import { createAsteroidBelt }   from './layers/asteroid-belt.js';
import { createRiskOverlay }      from './layers/risk-overlay.js';
import { createRiskPanel }        from './ui/risk-panel.js';
import { createConjunctionDetail } from './ui/conjunction-detail.js';
import { createTimeControls }     from './ui/time-controls.js';
import { createSpaceWeather }     from './data/space-weather.js';
import { createWeatherPanel }     from './ui/weather-panel.js';
import { createDebrisDensity }    from './layers/debris-density.js';
import { findNearestToClick, findNearestToPoint } from './ui/raycaster.js';
import { createSatellitePanel } from './ui/satellite-panel.js';
import { createPlanetPanel }    from './ui/planet-panel.js';
import { generateReport }       from './reports/report-generator.js';
import { createInterstellarLayer } from './layers/interstellar.js';
import { createHistoryPanel }      from './ui/history-panel.js';
import { createGalaxyLayer }       from './layers/galaxies.js';
import { createExplorerPanel }     from './ui/explorer-panel.js';
import { initDragManager }         from './ui/drag-manager.js';
import * as profiler               from './core/profiler.js';
import { createMobileControls, isMobile } from './ui/mobile-controls.js';

let renderer, scene, camera, controls, navigation;
let earthLayer       = null;
let atmosphereLayer  = null;
let starField        = null;   // { stars, toggle, isVisible }
let satelliteLayer   = null;
let constellations   = null;   // { lines, toggle, isVisible }
let trailLayer       = null;
let groupOverlay     = null;   // { update, updateReticles, dispose } — launch-group envelope
let orbitRings       = null;
let sunLayer         = null;
let solarSystem      = null;
let asteroidBelt     = null;
let riskOverlay      = null;   // { update, setVisible, toggle, getData, dispose }
let riskPanel        = null;   // { update, show, hide, toggle, deselect }
let conjDetail       = null;   // { show, hide, isVisible, onClose }
let timeControls     = null;   // { update, show, hide, toggle, jumpTo }
let debrisDensity    = null;   // { update, setVisible, toggle, isVisible, pick, dispose }

let hudTimeActive      = false;  // time panel toggle
let hudHeatActive      = false;  // debris heatmap toggle
let spaceWeather     = null;   // { onUpdate, getData, refresh, dispose }
let weatherPanel     = null;   // { show, hide, toggle }
let satPanel         = null;
let planetPanel      = null;
let explorerPanel    = null;
let followPlanet     = null;   // THREE.Mesh to follow with camera each frame
let search           = null;
let tleData          = [];
let frameCount       = 0;
let lastFpsTime      = performance.now();

let hoveredPlanetMesh = null;  // mesh currently hovered — drives reticle each frame

let selectedSatIdx = -1;       // index of currently selected satellite (-1 = none)

let selectedDso    = null;     // DSO object currently selected (from galaxy-catalog)

const _followDelta  = new THREE.Vector3();  // followPlanet delta each frame
const _reticleProj  = new THREE.Vector3();  // projected screen pos for reticles
const _ORIGIN       = new THREE.Vector3(0, 0, 0);  // Earth / scene origin (immutable)
let   _dsoReticleEl = null;                 // #dso-reticle element, cached after init

let hudStarsActive  = true;    // star field on by default
let hudOrbitActive  = false;   // orbit rings off by default
let hudConstActive  = true;    // constellations on by default
let hudSatsActive   = true;    // satellites on by default
let hudDebrisActive   = true;   // debris on by default
let hudAstActive      = false;  // asteroid belt off by default
let hudWeatherActive  = false;  // weather panel off by default
let hudRiskActive     = false;  // conjunction risk overlay off by default
let hudIntlActive     = false;  // interstellar trajectories off by default
let interstellarLayer = null;   // { update, setVisible }
let historyPanel      = null;   // { show, hide, toggle, updateSimTime } — kept for updateSimTime
let galaxyLayer       = null;   // { pick, showPanel, hidePanel, setVisible, toggle, isVisible }
let mobileControls    = null;   // { update, updateDate, updateScale, updateSpeed, dispose } | null

const TIME_SPEEDS  = [
  -1_000_000, -100_000, -10_000, -1_000, -100, -10, -1,
  1, 10, 100, 1_000, 10_000, 100_000, 1_000_000,
];
let   speedIndex   = 7;                         // index 7 = 1× forward
let   simTime      = Date.now();                // current simulation timestamp (ms)
let   lastRealTime = performance.now();         // real-time stamp of last frame

const loading      = document.getElementById('loading');
const statRenderer = document.getElementById('stat-renderer');
const statFps      = document.getElementById('stat-fps');
const statSpeed    = document.getElementById('stat-speed');
const statDate     = document.getElementById('stat-date');
const hoverTooltip = document.getElementById('sat-hover');

const hudSpeedLabel = document.getElementById('hud-speed-label');
const hudDate       = document.getElementById('hud-date');

const planetReticle       = document.getElementById('planet-reticle');
const planetReticleNameEl = document.getElementById('planet-reticle-name');

const satReticle      = document.getElementById('sat-reticle');
const satReticleNameEl = document.getElementById('sat-reticle-name');

async function init() {
  const statusEl = document.getElementById('loading-status');
  const setStatus = (msg) => { if (statusEl) statusEl.textContent = msg; };

  scene = new THREE.Scene();
  scene.background = null; // pure black — stars will be geometry, not background

  const container = document.getElementById('canvas-container');

  setStatus('Initializing renderer...');
  const RENDERER_TIMEOUT = 20000;
  const result = await Promise.race([
    createRenderer(container),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Renderer init timed out. Please refresh.')), RENDERER_TIMEOUT)
    ),
  ]);
  renderer        = result.renderer;
  statRenderer.textContent = result.rendererType;

  const cam  = createCamera(renderer);
  camera     = cam.camera;
  controls   = cam.controls;

  navigation = createNavigation(camera, controls);

  const ambientLight = new THREE.AmbientLight(0x111133, 0.06);
  scene.add(ambientLight);

  setStatus('Loading star catalog (14 MB)...');
  const hygData = await loadHYG();

  setStatus('Building star field...');
  starField = createStarField(scene, hygData);

  setStatus('Loading constellations...');
  constellations = await createConstellations(scene, hygData.hipMap);

  setStatus('Initializing sun...');
  sunLayer = await createSun(scene);

  setStatus('Loading Earth textures...');
  earthLayer = await createEarth(scene);

  atmosphereLayer = createAtmosphere(scene);

  solarSystem = createSolarSystem(scene, camera);

  asteroidBelt = createAsteroidBelt(scene, camera);

  spaceWeather = createSpaceWeather();
  weatherPanel = createWeatherPanel(spaceWeather);

  conjDetail = createConjunctionDetail();
  conjDetail.onClose(() => { if (riskPanel) riskPanel.deselect(); });

  timeControls = createTimeControls({
    getTime: () => simTime,
    setTime: t  => { simTime = t; },
  });

  window.addEventListener('jump-to-time', e => {
    if (timeControls) timeControls.jumpTo(e.detail);
    if (!hudTimeActive) toggleTime();
  });

  interstellarLayer = createInterstellarLayer(scene);
  interstellarLayer.setVisible(false);   // hidden until user presses Y

  historyPanel = createHistoryPanel({
    onJumpToDate: ms => { simTime = ms; },
  });

  galaxyLayer = createGalaxyLayer(scene);

  explorerPanel = createExplorerPanel({
    onSelectDso(dso) {
      satPanel?.hide();
      if (selectedSatIdx !== -1) {
        satelliteLayer?.setSelected(-1);
        selectedSatIdx = -1;
        document.getElementById('sat-reticle')?.classList.add('hidden');
      }
      planetPanel?.hide();
      sunLayer?.hidePanel();
      selectedDso = dso;
      galaxyLayer.showPanel(dso);
      flyToDso(dso);
      const lbl = document.getElementById('dso-reticle-label');
      if (lbl) lbl.textContent = dso.name.toUpperCase();
    },
    getTleData: () => tleData,
    onSelectSat(idx) {
      if (!satelliteLayer) return;
      const tle = satelliteLayer.getTLE(idx);
      if (!tle) return;
      const positions = satelliteLayer.getPositions();
      const pos = new THREE.Vector3(
        positions[idx * 3],
        positions[idx * 3 + 1],
        positions[idx * 3 + 2],
      );
      planetPanel?.hide();
      sunLayer?.hidePanel();
      galaxyLayer?.hidePanel();
      selectedDso = null;
      _dsoReticleEl?.classList.add('hidden');
      satelliteLayer.clearLaunchGroup();
      satelliteLayer.setSelected(idx);
      satPanel.show(tle, pos);
      if (trailLayer) { trailLayer.dispose(); trailLayer = null; }
      trailLayer = createTrail(scene, tle);
      selectedSatIdx = idx;
      if (satReticleNameEl) satReticleNameEl.textContent = tle?.name ?? `SAT #${idx}`;
      if (satReticle) satReticle.classList.remove('hidden');
    },
    onSelectGroup(norads) {
      if (groupOverlay) { groupOverlay.dispose(); groupOverlay = null; }

      if (norads) {
        satelliteLayer?.setLaunchGroup(norads);

        const MAX_ARC_SATS  = 60;
        const groupEntries  = [];
        for (let i = 0; i < tleData.length && groupEntries.length < MAX_ARC_SATS; i++) {
          if (norads.has(tleData[i].norad)) groupEntries.push({ tle: tleData[i], idx: i });
        }
        if (groupEntries.length > 0) {
          groupOverlay = createGroupOverlay(scene, groupEntries);
        }
      } else {
        satelliteLayer?.clearLaunchGroup();
      }
    },
    flyTo: (dist) => { if (navigation) navigation.flyTo(dist); },
  });

  window.addEventListener('density-band-select', e => {
    if (!satelliteLayer) return;
    const bands = e.detail;   // Array<{ low, high, count, ... }>
    if (bands.length === 0) {
      satelliteLayer.clearAltitudeBands();
    } else {
      satelliteLayer.setAltitudeBands(bands.map(b => ({ low: b.low, high: b.high })));
    }
  });

  setStatus('Ready.');
  loading.classList.add('hidden');
  setTimeout(() => loading.style.display = 'none', 900);

  initDragManager();

  _dsoReticleEl = document.getElementById('dso-reticle');

  profiler.setRenderer(renderer);

  animate();

  satPanel = createSatellitePanel(() => tleData);

  window.addEventListener('launch-group-select', (e) => {
    const { norads } = e.detail;
    if (satelliteLayer) satelliteLayer.setLaunchGroup(norads);

    if (groupOverlay) { groupOverlay.dispose(); groupOverlay = null; }
    if (tleData.length > 0) {
      const groupEntries = [];
      tleData.forEach((tle, idx) => {
        if (norads.has(tle.norad)) groupEntries.push({ tle, idx });
      });
      if (groupEntries.length > 0) {
        groupOverlay = createGroupOverlay(scene, groupEntries);
      }
    }
  });
  window.addEventListener('launch-group-clear', () => {
    if (satelliteLayer) satelliteLayer.clearLaunchGroup();
    if (groupOverlay) { groupOverlay.dispose(); groupOverlay = null; }
  });

  const _planetRaycaster = new THREE.Raycaster();

  function flyToPlanet(mesh) {
    if (!mesh) return;
    followPlanet = null;   // suspend follow during flight
    if (navigation) navigation.clearFocusPlanet();

    const def    = mesh.userData.planetDef;
    const target = mesh.position.clone();

    const startTarget = controls.target.clone();
    const startPos    = camera.position.clone();

    const isMoon = def?.name === 'Moon';
    const orbitDist = isMoon
      ? 6                                           // ~3,000 km above Moon surface
      : Math.max(def ? def.radius * 3 : 30, 10);

    let dirApproach = startPos.clone().sub(target);
    if (dirApproach.lengthSq() < 0.001) {
      dirApproach = startPos.clone().sub(startTarget);
    }
    dirApproach.normalize();
    const newCamPos = target.clone().add(dirApproach.multiplyScalar(orbitDist));

    const START = performance.now();
    const DUR   = 1800;

    function animateFlyToPlanet() {
      const t    = Math.min(1.0, (performance.now() - START) / DUR);
      const ease = 1 - Math.pow(1 - t, 3);

      const currentPlanetPos = mesh.position;
      const interpTarget = new THREE.Vector3().lerpVectors(startTarget, currentPlanetPos, ease);
      const interpCam    = new THREE.Vector3().lerpVectors(startPos, newCamPos, ease);

      controls.target.copy(interpTarget);
      camera.position.copy(interpCam);
      controls.update();

      if (t < 1.0) {
        requestAnimationFrame(animateFlyToPlanet);
      } else {
        if (def?.name !== 'Moon') {
          followPlanet = mesh;
        }
        if (navigation) navigation.setFocusPlanet(mesh);
      }
    }
    animateFlyToPlanet();
  }

  function flyToSun() {
    followPlanet = null;
    if (navigation) navigation.clearFocusPlanet();

    const sunPos = sunLayer?.sun?.position.clone()
                ?? new THREE.Vector3(0.75, 0.0, 0.64).normalize().multiplyScalar(650);

    const SUN_REAL_R = 1393;
    const orbitDist  = Math.round(SUN_REAL_R * 1.4);   // ≈ 1 950 units

    const startTarget = controls.target.clone();
    const startPos    = camera.position.clone();

    let dirApproach = startPos.clone().sub(sunPos);
    if (dirApproach.lengthSq() < 0.001) {
      dirApproach = startPos.clone().normalize();
    }
    dirApproach.normalize();
    const newCamPos = sunPos.clone().add(dirApproach.multiplyScalar(orbitDist));

    const START = performance.now();
    const DUR   = 3000;   // longer duration — farther travel distance

    function animateFlyToSun() {
      const t    = Math.min(1.0, (performance.now() - START) / DUR);
      const ease = 1 - Math.pow(1 - t, 3);
      controls.target.lerpVectors(startTarget, sunPos, ease);
      camera.position.lerpVectors(startPos, newCamPos, ease);
      controls.update();
      if (t < 1.0) {
        requestAnimationFrame(animateFlyToSun);
      } else {
        if (navigation && sunLayer?.sun) navigation.setFocusPlanet(sunLayer.sun);
      }
    }
    animateFlyToSun();
  }

  function flyToDso(dso) {
    if (!galaxyLayer) return;
    const dsoPos = galaxyLayer.getDsoWorldPos(dso);
    if (!dsoPos) return;

    followPlanet = null;
    if (navigation) navigation.clearFocusPlanet();

    const dir = dsoPos.clone().normalize();

    const APPROACH = 9e4 * 0.72;
    const newCamPos = dir.clone().multiplyScalar(APPROACH);
    const newTarget = dsoPos.clone();

    const startTarget = controls.target.clone();
    const startPos    = camera.position.clone();
    const START = performance.now();
    const DUR   = 2400;

    function animateFlyToDso() {
      const t    = Math.min(1.0, (performance.now() - START) / DUR);
      const ease = 1 - Math.pow(1 - t, 3);
      controls.target.lerpVectors(startTarget, newTarget, ease);
      camera.position.lerpVectors(startPos, newCamPos, ease);
      controls.update();
      if (t < 1.0) requestAnimationFrame(animateFlyToDso);
    }
    animateFlyToDso();
  }

  function backToEarth() {
    followPlanet = null;   // disengage planet follow
    if (navigation) navigation.clearFocusPlanet();

    satPanel?.hide();
    selectedSatIdx = -1;
    satelliteLayer?.setSelected(-1);
    planetPanel?.hide();
    sunLayer?.hidePanel();
    selectedDso = null;
    galaxyLayer?.hidePanel();
    _dsoReticleEl?.classList.add('hidden');

    const startTarget = controls.target.clone();
    const startPos    = camera.position.clone();
    const earthTarget = new THREE.Vector3(0, 0, 0);
    const earthDist   = 85;

    const dir       = startPos.clone().sub(startTarget).normalize();
    const newCamPos = dir.multiplyScalar(earthDist);

    const START = performance.now();
    const DUR   = 1800;

    function animateBack() {
      const t    = Math.min(1.0, (performance.now() - START) / DUR);
      const ease = 1 - Math.pow(1 - t, 3);

      controls.target.lerpVectors(startTarget, earthTarget, ease);
      camera.position.lerpVectors(startPos, newCamPos, ease);
      controls.update();

      if (t < 1.0) requestAnimationFrame(animateBack);
    }
    animateBack();
  }

  planetPanel = createPlanetPanel(flyToPlanet, backToEarth);

  setupHUD({ backToEarth, flyToSun, flyToPlanet });
  updateSpeedHUD();   // sync HUD speed label on first load

  mobileControls = createMobileControls(
    camera,
    controls,
    renderer.domElement,
    { backToEarth },
  );

  if (mobileControls) {
    window.addEventListener('mobile-speed-change', (e) => {
      if (e.detail === +1) speedIndex = Math.min(speedIndex + 1, TIME_SPEEDS.length - 1);
      if (e.detail === -1) speedIndex = Math.max(speedIndex - 1, 0);
      updateSpeedHUD();
      mobileControls?.updateSpeed(formatSpeedLabel());
    });

    window.addEventListener('mobile-select', () => {
      const canvas = renderer.domElement;
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;

      if (debrisDensity && debrisDensity.isVisible()) {
        const hit = debrisDensity.clickShell({ x: 0, y: 0 }, camera);
        if (hit) return;
      }

      const _mr = new THREE.Raycaster();
      _mr.setFromCamera(new THREE.Vector2(0, 0), camera);
      if (solarSystem) {
        const meshesData = solarSystem.getMeshes();
        const meshes     = meshesData.map(m => m.mesh);
        if (sunLayer?.sun) meshes.push(sunLayer.sun);
        const hits = _mr.intersectObjects(meshes, false);
        if (hits.length > 0) {
          const hitMesh = hits[0].object;
          if (hitMesh.userData.isSun) {
            closeInfoPanels(); flyToSun(); sunLayer.showPanel(); return;
          }
          const def = hitMesh.userData.planetDef;
          if (def) {
            closeInfoPanels();
            if (planetPanel) planetPanel.show(def, hitMesh);
            flyToPlanet(hitMesh);
            return;
          }
        }
      }

      if (galaxyLayer) {
        const dso = galaxyLayer.pick(W / 2, H / 2, camera, canvas);
        if (dso) {
          closeInfoPanels();
          selectedDso = dso;
          galaxyLayer.showPanel(dso);
          flyToDso(dso);
          const lbl = document.getElementById('dso-reticle-label');
          if (lbl) lbl.textContent = dso.name.toUpperCase();
          return;
        }
      }

      if (satelliteLayer) {
        let idx = findNearestToPoint(
          W / 2, H / 2,
          camera,
          satelliteLayer.getPositions(),
          satelliteLayer.getCount(),
          canvas,
          48,   // slightly wider threshold for touch
        );
        if (idx >= 0) {
          const cat = satelliteLayer.getTLE(idx)?.category;
          if (cat === 'debris' && !satelliteLayer.isDebrisVisible()) idx = -1;
          else if (cat !== 'debris' && !satelliteLayer.isActiveVisible()) idx = -1;
        }
        if (idx >= 0) {
          const tle = satelliteLayer.getTLE(idx);
          const pos = new THREE.Vector3(
            satelliteLayer.getPositions()[idx * 3],
            satelliteLayer.getPositions()[idx * 3 + 1],
            satelliteLayer.getPositions()[idx * 3 + 2],
          );
          closeInfoPanels();
          satelliteLayer.setSelected(idx);
          satPanel.show(tle, pos);
          selectedSatIdx = idx;
          if (satReticleNameEl) satReticleNameEl.textContent = tle?.name ?? `SAT #${idx}`;
          if (satReticle) satReticle.classList.remove('hidden');
          if (trailLayer) { trailLayer.dispose(); trailLayer = null; }
          trailLayer = createTrail(scene, tle);
        } else {
          satelliteLayer.setSelected(-1);
          closeInfoPanels();
          followPlanet = null;
          if (navigation) navigation.clearFocusPlanet();
          if (trailLayer) { trailLayer.dispose(); trailLayer = null; }
          selectedSatIdx = -1;
          if (satReticle) satReticle.classList.add('hidden');
          selectedDso = null;
          galaxyLayer?.hidePanel();
          _dsoReticleEl?.classList.add('hidden');
        }
      }
    });
  }

  search = createSearch(
    () => tleData,
    (idx) => {
      if (!satelliteLayer) return;
      const tle = satelliteLayer.getTLE(idx);
      if (!tle) return;
      const positions = satelliteLayer.getPositions();
      const pos = new THREE.Vector3(
        positions[idx * 3],
        positions[idx * 3 + 1],
        positions[idx * 3 + 2],
      );
      closeInfoPanels();
      satelliteLayer.setSelected(idx);
      satPanel.show(tle, pos);
      if (trailLayer) { trailLayer.dispose(); trailLayer = null; }
      trailLayer = createTrail(scene, tle);
      selectedSatIdx = idx;
      if (satReticleNameEl) satReticleNameEl.textContent = tle?.name ?? `SAT #${idx}`;
      if (satReticle) satReticle.classList.remove('hidden');
    },
    (dist) => { if (navigation) navigation.flyTo(dist); },
  );

  const canvas = renderer.domElement;
  let pointerMoved = false;

  canvas.addEventListener('pointerdown', () => { pointerMoved = false; });
  canvas.addEventListener('pointermove', () => { pointerMoved = true;  });
  canvas.addEventListener('pointerup', (e) => {
    if (pointerMoved) return;
    if (e.button !== 0) return;

    if (debrisDensity && debrisDensity.isVisible()) {
      const rect = canvas.getBoundingClientRect();
      const ndcX =  ((e.clientX - rect.left)  / rect.width)  * 2 - 1;
      const ndcY = -((e.clientY - rect.top)   / rect.height) * 2 + 1;
      const hit  = debrisDensity.clickShell({ x: ndcX, y: ndcY }, camera);
      if (hit) return;   // consumed — don't propagate to planet/satellite checks
    }

    if (solarSystem) {
      const rect = canvas.getBoundingClientRect();
      const ndcX =  ((e.clientX - rect.left)  / rect.width)  * 2 - 1;
      const ndcY = -((e.clientY - rect.top)   / rect.height) * 2 + 1;
      _planetRaycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);

      const meshesData = solarSystem.getMeshes();
      const meshes     = meshesData.map(m => m.mesh);
      if (sunLayer?.sun) meshes.push(sunLayer.sun);
      const hits = _planetRaycaster.intersectObjects(meshes, false);

      if (hits.length > 0) {
        const hitMesh = hits[0].object;

        if (hitMesh.userData.isSun) {
          closeInfoPanels();
          flyToSun();
          sunLayer.showPanel();
          return;
        }

        const def = hitMesh.userData.planetDef;
        if (def) {
          closeInfoPanels();
          if (planetPanel) planetPanel.show(def, hitMesh);
          flyToPlanet(hitMesh);
          return;   // consumed — don't check satellites
        }
      }
    }

    if (galaxyLayer) {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const dso = galaxyLayer.pick(mx, my, camera, canvas);
      if (dso) {
        closeInfoPanels();
        selectedDso = dso;
        galaxyLayer.showPanel(dso);
        flyToDso(dso);
        const lbl = document.getElementById('dso-reticle-label');
        if (lbl) lbl.textContent = dso.name.toUpperCase();
        return;   // consumed
      }
    }

    if (!satelliteLayer) return;

    let idx = findNearestToClick(
      e,
      camera,
      satelliteLayer.getPositions(),
      satelliteLayer.getCount(),
      canvas,
    );
    if (idx >= 0) {
      const cat = satelliteLayer.getTLE(idx)?.category;
      if (cat === 'debris' && !satelliteLayer.isDebrisVisible()) idx = -1;
      else if (cat !== 'debris' && !satelliteLayer.isActiveVisible()) idx = -1;
    }

    if (idx >= 0) {
      const tle = satelliteLayer.getTLE(idx);
      const pos = new THREE.Vector3(
        satelliteLayer.getPositions()[idx * 3],
        satelliteLayer.getPositions()[idx * 3 + 1],
        satelliteLayer.getPositions()[idx * 3 + 2],
      );
      closeInfoPanels();
      satelliteLayer.setSelected(idx);
      satPanel.show(tle, pos);

      selectedSatIdx = idx;
      if (satReticleNameEl) satReticleNameEl.textContent = tle?.name ?? `SAT #${idx}`;
      if (satReticle) satReticle.classList.remove('hidden');

      if (trailLayer) { trailLayer.dispose(); trailLayer = null; }
      trailLayer = createTrail(scene, tle);
    } else {
      satelliteLayer.setSelected(-1);
      closeInfoPanels();
      followPlanet = null;
      if (navigation) navigation.clearFocusPlanet();
      if (trailLayer) { trailLayer.dispose(); trailLayer = null; }

      selectedSatIdx = -1;
      if (satReticle) satReticle.classList.add('hidden');

      selectedDso = null;
      galaxyLayer?.hidePanel();
      _dsoReticleEl?.classList.add('hidden');
    }
  });

  window.addEventListener('keydown', (e) => {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
    if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      if (search) search.open();
    }
  });

  const PLANET_KEYS = {
    q: 'Mercury', v: 'Venus', r: 'Mars',
    j: 'Jupiter', t: 'Saturn', u: 'Uranus', n: 'Neptune',
    m: 'Moon',
  };

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target !== document.body && e.target.tagName !== 'CANVAS') return;

    const key = e.key.toLowerCase();

    if (key === 'e') {
      e.preventDefault();
      backToEarth();
      return;
    }

    if (key === 's') {
      e.preventDefault();
      closeInfoPanels();
      flyToSun();
      sunLayer?.showPanel();
      return;
    }

    const targetName = PLANET_KEYS[key];
    if (!targetName || !solarSystem) return;
    e.preventDefault();

    const found = solarSystem.getMeshes().find(m => m.def.name === targetName);
    if (!found) return;

    closeInfoPanels();
    planetPanel?.show(found.def, found.mesh);
    flyToPlanet(found.mesh);
  });

  window.addEventListener('keydown', (e) => {
    const _tag = e.target.tagName;
    if (_tag === 'INPUT' || _tag === 'TEXTAREA' || e.target.isContentEditable) return;

    if (e.key === '[' || e.key === ']') {
      if (e.key === ']') speedIndex = Math.min(speedIndex + 1, TIME_SPEEDS.length - 1);
      if (e.key === '[') speedIndex = Math.max(speedIndex - 1, 0);
      updateSpeedHUD();
    }
    if (e.key === 'f' || e.key === 'F') {
      if (starField) starField.toggle();
      hudStarsActive = !hudStarsActive;
      setHudToggle('btn-starfield', hudStarsActive);
    }
    if (e.key === 'c' || e.key === 'C') {
      if (constellations) constellations.toggle();
      hudConstActive = !hudConstActive;
      setHudToggle('btn-constellations', hudConstActive);
    }
    if (e.key === 'o' || e.key === 'O') {
      if (orbitRings) orbitRings.toggle();
      hudOrbitActive = !hudOrbitActive;
      setHudToggle('btn-orbits', hudOrbitActive);
    }
    if (e.key === 'a' || e.key === 'A') {
      toggleSats();
    }
    if (e.key === 'd' || e.key === 'D') {
      toggleDebris();
    }
    if (e.key === 'b' || e.key === 'B') {
      if (asteroidBelt) asteroidBelt.toggle();
      hudAstActive = !hudAstActive;
      setHudToggle('btn-asteroids', hudAstActive);
    }
    if (e.key === 'w' || e.key === 'W') {
      toggleWeather();
    }
    if (e.key === 'g' || e.key === 'G') {
      toggleRisk();
    }
    if (e.key === 'h' || e.key === 'H') {
      toggleHeat();
    }
    if (e.key === 'y' || e.key === 'Y') {
      toggleIntl();
    }
    if (e.key === 'i' || e.key === 'I') {
      toggleExplorer();
    }
    if (e.key === 'p' || e.key === 'P') {
      triggerReport();
    }
    if (e.key === '`') {
      profiler.toggle();
    }
  });

  let hoverThrottle  = 0;
  let lastHoveredIdx = -1;
  let lastHoveredPlanet = null;

  canvas.addEventListener('mousemove', (e) => {
    const now = performance.now();
    if (now - hoverThrottle < 60) return;   // ~16 fps for hover scan
    hoverThrottle = now;

    const rect = canvas.getBoundingClientRect();
    const mx   = e.clientX - rect.left;
    const my   = e.clientY - rect.top;

    hoverTooltip.style.left = `${e.clientX}px`;
    hoverTooltip.style.top  = `${e.clientY}px`;

    if (solarSystem) {
      const ndcX =  (mx / rect.width)  * 2 - 1;
      const ndcY = -(my / rect.height) * 2 + 1;
      _planetRaycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
      const meshes = solarSystem.getMeshes().map(m => m.mesh);
      const hits   = _planetRaycaster.intersectObjects(meshes, false);

      if (hits.length > 0) {
        const hitMesh = hits[0].object;
        const def     = hitMesh.userData.planetDef;
        if (def && def !== lastHoveredPlanet) {
          lastHoveredPlanet = def;
          hoveredPlanetMesh = hitMesh;
          if (satelliteLayer) satelliteLayer.setHovered(-1);
          lastHoveredIdx = -1;
          if (planetReticleNameEl) planetReticleNameEl.textContent = def.name.toUpperCase();
          if (planetReticle) planetReticle.classList.remove('hidden');
          hoverTooltip.classList.remove('visible');
        }
        return;
      }
    }

    if (lastHoveredPlanet) {
      lastHoveredPlanet = null;
      hoveredPlanetMesh = null;
      if (planetReticle) planetReticle.classList.add('hidden');
      hoverTooltip.classList.remove('visible');
    }

    if (galaxyLayer) {
      const dso = galaxyLayer.pick(mx, my, camera, canvas);
      if (dso) {
        hoverTooltip.textContent = `${dso.name}  ·  ${dso.designation}  ·  ${dso.distance.toLocaleString()} ${dso.distUnit}`;
        hoverTooltip.classList.add('visible');
        return;
      }
    }

    {
      const chEl = document.getElementById('constellation-hover');
      if (chEl && constellations && constellations.isVisible() && constellations.pick) {
        const ndcX = (mx / rect.width)  *  2 - 1;
        const ndcY = (my / rect.height) * -2 + 1;
        const hit  = constellations.pick(ndcX, ndcY, camera);
        if (hit) {
          chEl.querySelector('.ch-name').textContent = hit.name;
          chEl.querySelector('.ch-meta').textContent = `${hit.origin}  ·  ${hit.year}`;
          chEl.querySelector('.ch-desc').textContent = hit.desc;
          chEl.style.left = `${e.clientX}px`;
          chEl.style.top  = `${e.clientY}px`;
          chEl.classList.add('visible');
        } else {
          chEl.classList.remove('visible');
        }
        if (constellations.highlight) constellations.highlight(hit?.abbr ?? null);
      }
    }

    if (orbitRings && orbitRings.isVisible() && satelliteLayer) {
      let idx = findNearestToPoint(
        mx, my, camera,
        satelliteLayer.getPositions(),
        satelliteLayer.getCount(),
        canvas,
        80,   // wider hit radius — orbits are whole rings, not dots
      );
      if (idx >= 0) {
        const cat = satelliteLayer.getTLE(idx)?.category;
        if (cat === 'debris' && !satelliteLayer.isDebrisVisible()) idx = -1;
        else if (cat !== 'debris' && !satelliteLayer.isActiveVisible()) idx = -1;
      }

      if (idx !== lastHoveredIdx) {
        if (lastHoveredIdx >= 0) orbitRings.clearHighlight();
        lastHoveredIdx = idx;

        if (idx >= 0) {
          orbitRings.highlight(idx);
          const tle = satelliteLayer.getTLE(idx);
          satelliteLayer.setHovered(idx);
          hoverTooltip.textContent = tle?.name ?? `SAT #${idx}`;
          hoverTooltip.classList.add('visible');
        } else {
          satelliteLayer.setHovered(-1);
          hoverTooltip.classList.remove('visible');
        }
      }
      return;   // orbit ring mode active — skip normal satellite hover
    }

    if (!satelliteLayer) return;

    let idx = findNearestToPoint(
      mx, my,
      camera,
      satelliteLayer.getPositions(),
      satelliteLayer.getCount(),
      canvas,
      36,
    );
    if (idx >= 0) {
      const cat = satelliteLayer.getTLE(idx)?.category;
      if (cat === 'debris' && !satelliteLayer.isDebrisVisible()) idx = -1;
      else if (cat !== 'debris' && !satelliteLayer.isActiveVisible()) idx = -1;
    }

    if (idx === lastHoveredIdx) return;
    lastHoveredIdx = idx;

    if (idx >= 0) {
      const tle = satelliteLayer.getTLE(idx);
      satelliteLayer.setHovered(idx);
      hoverTooltip.textContent = tle?.name ?? `SAT #${idx}`;
      hoverTooltip.classList.add('visible');
    } else {
      satelliteLayer.setHovered(-1);
      hoverTooltip.classList.remove('visible');
    }

    if (debrisDensity) {
      const ndcX =  (mx / rect.width)  * 2 - 1;
      const ndcY = -(my / rect.height) * 2 + 1;
      const hit  = debrisDensity.pick({ x: ndcX, y: ndcY }, camera);
      const tip  = document.getElementById('heatmap-tooltip');
      if (tip) {
        if (hit) {
          tip.textContent = `${hit.low}–${hit.high} km  ·  ${hit.count.toLocaleString()} objects`;
          tip.style.left  = `${e.clientX}px`;
          tip.style.top   = `${e.clientY}px`;
          tip.classList.add('visible');
        } else {
          tip.classList.remove('visible');
        }
      }
    }
  });

  canvas.addEventListener('mouseleave', () => {
    lastHoveredIdx    = -1;
    lastHoveredPlanet = null;
    hoveredPlanetMesh = null;
    if (satelliteLayer) satelliteLayer.setHovered(-1);
    if (orbitRings)     orbitRings.clearHighlight();
    hoverTooltip.classList.remove('visible');
    if (planetReticle) planetReticle.classList.add('hidden');
    document.getElementById('constellation-hover')?.classList.remove('visible');
    if (constellations?.highlight) constellations.highlight(null);
  });

  window.addEventListener('keydown', (e) => {
    const _t = e.target.tagName;
    if (_t === 'INPUT' || _t === 'TEXTAREA' || e.target.isContentEditable) return;
    if (e.key === 'T' && e.shiftKey) {
      updatePhaseHUD('TLE — force refresh…');
      if (satelliteLayer) { satelliteLayer.dispose(); satelliteLayer = null; }
      if (orbitRings)     { orbitRings.dispose();     orbitRings     = null; }
      fetchTLEs({ forceRefresh: true }).then(tles => {
        tleData        = tles;
        satelliteLayer = createSatellites(scene, tles);
        orbitRings     = createOrbitRings(scene, tles);
        if (!hudSatsActive)   satelliteLayer.setVisible(false);
        if (!hudDebrisActive) satelliteLayer.setDebrisVisible(false);
        if (hudOrbitActive)   orbitRings.toggle();   // rings start hidden; toggle if user had them on
        updatePhaseHUD(`2.3 — ${tles.length.toLocaleString()} satellites`);
      }).catch(err => {
        updatePhaseHUD('TLE refresh failed');
        console.error('[SpaceNavigator] Force refresh failed:', err);
      });
    }
  });

  fetchTLEs()
    .then(tles => {
      tleData = tles;
      console.log(`[SpaceNavigator] TLE ready: ${tles.length} satellites`);
      updatePhaseHUD(`2.3 — ${tles.length.toLocaleString()} sats (worker starting…)`);

      satelliteLayer = createSatellites(scene, tles);

      orbitRings = createOrbitRings(scene, tles);

      riskOverlay = createRiskOverlay(scene, satelliteLayer);
      riskPanel   = createRiskPanel({ onSelect: handleConjunctionSelect });

      debrisDensity = createDebrisDensity(scene, tles);

      const origUpdate = satelliteLayer.update.bind(satelliteLayer);
      let hudUpdated = false;
      satelliteLayer.update = (now, simT) => {
        origUpdate(now, simT);
        if (!hudUpdated && now > 0) {
          hudUpdated = true;
          updatePhaseHUD(`2.3 — ${tles.length.toLocaleString()} satellites`);
        }
      };
    })
    .catch(err => {
      console.warn('[SpaceNavigator] TLE fetch failed (offline?):', err.message);
      updatePhaseHUD('2.1 — TLE unavailable (offline)');
    });
}

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  if (frameCount === 0) lastFpsTime = now;
  frameCount++;
  const elapsed = now - lastFpsTime;
  if (elapsed >= 500) {
    statFps.textContent = Math.round((frameCount / elapsed) * 1000);
    frameCount  = 0;
    lastFpsTime = now;
  }

  profiler.begin('frame');

  const realDelta = now - lastRealTime;
  lastRealTime    = now;
  simTime        += realDelta * TIME_SPEEDS[speedIndex];

  if (Math.floor(now / 1000) !== Math.floor((now - realDelta) / 1000)) {
    const dateStr = formatSimDate(simTime);
    if (statDate)  statDate.textContent  = dateStr;
    if (hudDate)   hudDate.textContent   = dateStr;
    if (mobileControls) {
      mobileControls.updateDate(dateStr);
      mobileControls.updateSpeed(formatSpeedLabel());
    }
  }

  profiler.begin('navigation');
  controls.update();
  if (navigation) navigation.update();
  if (mobileControls) {
    mobileControls.update(realDelta);
    if (statRenderer && Math.floor(now / 2000) !== Math.floor((now - realDelta) / 2000)) {
      const scaleEl = document.getElementById('stat-scale');
      if (scaleEl) mobileControls.updateScale(scaleEl.textContent);
    }
  }
  profiler.end('navigation');

  profiler.begin('earth');
  if (earthLayer) earthLayer.update(simTime);
  profiler.end('earth');

  profiler.begin('solar');
  if (solarSystem) solarSystem.update(simTime);
  if (sunLayer) sunLayer.update(camera);
  profiler.end('solar');

  const _earthLayerDist   = camera.position.length();
  const _earthLayersClose = _earthLayerDist < 150;   // rings / risk / debris / trail

  if (earthLayer && atmosphereLayer?.mesh) {
    atmosphereLayer.mesh.visible = true;
  }

  if (satelliteLayer) satelliteLayer.setVisible(hudSatsActive);

  if (satelliteLayer) satelliteLayer.setDebrisVisible(hudDebrisActive);

  const _orbitShouldShow = hudOrbitActive && _earthLayersClose;
  if (orbitRings && !!orbitRings.isVisible() !== _orbitShouldShow) orbitRings.toggle();

  if (followPlanet) {
    _followDelta.copy(followPlanet.position).sub(controls.target);
    if (_followDelta.lengthSq() > 1e-8) {
      controls.target.add(_followDelta);
      camera.position.add(_followDelta);
      controls.update();
    }
  }

  profiler.begin('asteroids');
  if (asteroidBelt) asteroidBelt.update(simTime);
  profiler.end('asteroids');

  if (interstellarLayer) interstellarLayer.update(simTime);

  if (historyPanel && Math.floor(now / 1000) !== Math.floor((now - realDelta) / 1000)) {
    historyPanel.updateSimTime(simTime);
  }

  profiler.begin('satellites');
  if (satelliteLayer) satelliteLayer.update(now, simTime);
  profiler.end('satellites');

  profiler.begin('trail');
  if (trailLayer) trailLayer.update(now, simTime);
  profiler.end('trail');

  profiler.begin('risk');
  const _riskShouldShow = hudRiskActive && _earthLayersClose;
  if (riskOverlay) riskOverlay.setVisible(_riskShouldShow);
  if (riskOverlay && _earthLayersClose) {
    riskOverlay.update(now);
    if (riskPanel && Math.floor(now / 500) !== Math.floor((now - realDelta) / 500)) {
      riskPanel.update(riskOverlay.getData());
    }
  }
  profiler.end('risk');

  profiler.begin('debris');
  if (debrisDensity) debrisDensity.setVisible(hudHeatActive);
  if (debrisDensity && hudHeatActive) debrisDensity.update(now);
  profiler.end('debris');

  if (timeControls) timeControls.update();

  if (hoveredPlanetMesh && planetReticle) {
    _reticleProj.copy(hoveredPlanetMesh.position).project(camera);
    if (_reticleProj.z < 1) {   // z < 1 means in front of camera
      const W   = renderer.domElement.clientWidth;
      const H   = renderer.domElement.clientHeight;
      const sx  = (_reticleProj.x  + 1) / 2 * W;
      const sy  = (-_reticleProj.y + 1) / 2 * H;

      const def      = hoveredPlanetMesh.userData.planetDef;
      const camDist  = camera.position.distanceTo(hoveredPlanetMesh.position);
      const fovY     = camera.fov * (Math.PI / 180);
      const projR    = (def.radius / camDist) * (H / (2 * Math.tan(fovY / 2)));

      if (projR > H * 0.20) {
        planetReticle.classList.add('hidden');
      } else {
        const size = Math.max(28, Math.min(projR * 2 + 14, 96));
        planetReticle.classList.remove('hidden');
        planetReticle.style.left   = `${sx}px`;
        planetReticle.style.top    = `${sy}px`;
        planetReticle.style.width  = `${size}px`;
        planetReticle.style.height = `${size}px`;
      }
    }
  }

  if (selectedDso && galaxyLayer) {
    const pos = galaxyLayer.getDsoScreenPos(selectedDso, camera, renderer.domElement);
    if (pos && _dsoReticleEl) {
      _dsoReticleEl.style.left   = pos.x + 'px';
      _dsoReticleEl.style.top    = pos.y + 'px';
      _dsoReticleEl.style.width  = (pos.r * 2) + 'px';
      _dsoReticleEl.style.height = (pos.r * 2) + 'px';
      _dsoReticleEl.classList.remove('hidden');
    } else if (_dsoReticleEl) {
      _dsoReticleEl.classList.add('hidden');
    }
  } else {
    _dsoReticleEl?.classList.add('hidden');
  }

  if (selectedSatIdx >= 0 && satelliteLayer && satReticle) {
    const positions = satelliteLayer.getPositions();
    const sx3 = positions[selectedSatIdx * 3];
    const sy3 = positions[selectedSatIdx * 3 + 1];
    const sz3 = positions[selectedSatIdx * 3 + 2];

    if (sx3 !== 0 || sy3 !== 0 || sz3 !== 0) {
      _reticleProj.set(sx3, sy3, sz3).project(camera);
      if (_reticleProj.z < 1) {   // in front of camera
        const W  = renderer.domElement.clientWidth;
        const H  = renderer.domElement.clientHeight;
        const sx = (_reticleProj.x  + 1) / 2 * W;
        const sy = (-_reticleProj.y + 1) / 2 * H;
        satReticle.style.left = `${sx}px`;
        satReticle.style.top  = `${sy}px`;
        satReticle.classList.remove('hidden');
      } else {
        satReticle.classList.add('hidden');
      }
    }
  }

  if (groupOverlay && satelliteLayer) {
    groupOverlay.update(now);
    groupOverlay.updateReticles(
      satelliteLayer.getPositions(),
      camera,
      renderer.domElement,
    );
  }

  profiler.begin('render');
  renderer.render(scene, camera);
  profiler.end('render');

  profiler.end('frame');
  profiler.tick(now);
}

function toggleStars() {
  if (starField) starField.toggle();
  hudStarsActive = !hudStarsActive;
  setHudToggle('btn-starfield', hudStarsActive);
}

function toggleSats() {
  hudSatsActive = !hudSatsActive;
  setHudToggle('btn-satellites', hudSatsActive);
}

function toggleDebris() {
  hudDebrisActive = !hudDebrisActive;
  setHudToggle('btn-debris', hudDebrisActive);
}

function toggleWeather() {
  if (!weatherPanel) return;
  hudWeatherActive = weatherPanel.toggle();
  setHudToggle('btn-weather', hudWeatherActive);
}

function toggleRisk() {
  hudRiskActive = !hudRiskActive;
  if (riskPanel)   { if (hudRiskActive) riskPanel.show(); else riskPanel.hide(); }
  if (!hudRiskActive && conjDetail) conjDetail.hide();   // close detail when overlay turns off
  setHudToggle('btn-risk', hudRiskActive);
}

function toggleTime() {
  hudTimeActive = !hudTimeActive;
  if (timeControls) { if (hudTimeActive) timeControls.show(); else timeControls.hide(); }
  setHudToggle('btn-time', hudTimeActive);
}

function toggleHeat() {
  hudHeatActive = !hudHeatActive;
  if (!hudHeatActive && satelliteLayer) satelliteLayer.clearAltitudeBands();
  setHudToggle('btn-heat', hudHeatActive);
  showHeatExplainer(hudHeatActive);
}

function _orbitLabel(mid) {
  if (mid <  350)  return 'Very Low LEO · decay zone';
  if (mid <  600)  return 'Low LEO · Starlink belt';
  if (mid < 1000)  return 'LEO operations';
  if (mid < 1200)  return 'Upper LEO';
  if (mid < 2000)  return 'Upper LEO · Van Allen edge';
  if (mid < 2500)  return 'Inner Van Allen Belt';
  if (mid < 8000)  return 'Lower MEO';
  if (mid < 20500) return 'MEO · GPS / GNSS band';
  if (mid < 36000) return 'HEO · GEO approach';
  return 'GEO Belt';
}

function showHeatExplainer(show) {
  let panel = document.getElementById('heat-explainer');

  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'heat-explainer';
    panel.innerHTML = `
      <div id="heat-explainer-header">
        <button id="heat-explainer-close">×</button>
        <span id="heat-explainer-title">DEBRIS DENSITY MAP</span>
      </div>
      <div id="heat-explainer-body">
        <div id="heat-summary"></div>
        <div id="heat-clear-row">
          <button id="heat-clear-btn">CLEAR SELECTION</button>
        </div>
        <div id="heat-band-list"></div>
      </div>
    `;
    document.body.appendChild(panel);

    document.getElementById('heat-explainer-close').addEventListener('click', () => {
      panel.classList.remove('visible');
      hudHeatActive = false;
      if (debrisDensity) debrisDensity.setVisible(false);
      if (satelliteLayer) satelliteLayer.clearAltitudeBands();
      setHudToggle('btn-heat', false);
    });

    document.getElementById('heat-clear-btn').addEventListener('click', () => {
      if (debrisDensity) debrisDensity.clearSelection();
    });

    window.addEventListener('density-band-select', () => {
      if (!debrisDensity) return;
      const bins = debrisDensity.getBins();
      document.querySelectorAll('.heat-band-row').forEach((row) => {
        const idx = parseInt(row.dataset.idx, 10);
        row.classList.toggle('selected', bins[idx]?.selected ?? false);
      });
    });
  }

  if (show) {
    panel.classList.add('visible');

    if (debrisDensity) {
      const bins  = debrisDensity.getBins();
      const total = bins.reduce((s, b) => s + b.count, 0);

      const summary = document.getElementById('heat-summary');
      if (summary) {
        summary.textContent = `${bins.length} altitude bands · ${total.toLocaleString()} tracked objects`;
      }

      const list = document.getElementById('heat-band-list');
      if (list) {
        list.innerHTML = bins.map((bin) => {
          const hex   = '#' + bin.color.getHexString();
          const label = _orbitLabel(bin.mid);
          return `
            <button class="heat-band-row${bin.selected ? ' selected' : ''}" data-idx="${bin.idx}">
              <span class="heat-band-swatch" style="background:${hex}"></span>
              <span class="heat-band-alt">${bin.low}–${bin.high}<span class="heat-band-unit"> km</span></span>
              <span class="heat-band-count">${bin.count.toLocaleString()}</span>
              <span class="heat-band-label">${label}</span>
            </button>`;
        }).join('');

        list.querySelectorAll('.heat-band-row').forEach((row) => {
          row.addEventListener('click', () => {
            const idx = parseInt(row.dataset.idx, 10);
            if (debrisDensity) debrisDensity.toggleBinByIndex(idx);
          });
        });
      }
    }
  } else {
    panel.classList.remove('visible');
  }
}

function toggleIntl() {
  hudIntlActive = !hudIntlActive;
  if (interstellarLayer) interstellarLayer.setVisible(hudIntlActive);
  setHudToggle('btn-intl', hudIntlActive);
  const panel = document.getElementById('intl-panel');
  if (panel) {
    if (hudIntlActive) panel.classList.remove('hidden');
    else               panel.classList.add('hidden');
  }
}

function toggleExplorer() {
  if (!explorerPanel) return;
  explorerPanel.toggle();
  setHudToggle('btn-explorer', explorerPanel.isVisible());
}

function triggerReport() {
  const btn = document.getElementById('btn-report');
  if (btn?.classList.contains('generating')) return;   // already in progress
  if (btn) { btn.classList.add('generating'); btn.textContent = 'P GENERATING…'; }

  generateReport({
    renderer,
    scene,
    camera,
    tleData,
    spaceWeather,
    riskOverlay,
    simTime,
  }).catch(err => {
    console.error('[SpaceNavigator] Report generation failed:', err);
  }).finally(() => {
    if (btn) { btn.classList.remove('generating'); btn.textContent = 'P REPORT'; }
  });
}

function handleConjunctionSelect(c) {
  if (!satelliteLayer) return;

  const pos  = satelliteLayer.getPositions();
  const posA = [pos[c.idxA * 3], pos[c.idxA * 3 + 1], pos[c.idxA * 3 + 2]];
  const posB = [pos[c.idxB * 3], pos[c.idxB * 3 + 1], pos[c.idxB * 3 + 2]];

  const mx = (posA[0] + posB[0]) * 0.5;
  const my = (posA[1] + posB[1]) * 0.5;
  const mz = (posA[2] + posB[2]) * 0.5;

  navigation.flyToPoint({ x: mx, y: my, z: mz }, 1.5);

  if (conjDetail) conjDetail.show(c, posA, posB, simTime);
}

function setupHUD({ backToEarth, flyToSun, flyToPlanet }) {

  document.querySelectorAll('.hud-planet-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      if (key === 'e') { backToEarth();                                             return; }
      if (key === 's') { closeInfoPanels(); flyToSun(); sunLayer?.showPanel();       return; }
      const PLANET_MAP = {
        m: 'Mercury', v: 'Venus', r: 'Mars',
        j: 'Jupiter', t: 'Saturn', u: 'Uranus', n: 'Neptune', l: 'Moon',
      };
      const name = PLANET_MAP[key];
      if (!name || !solarSystem) return;
      const found = solarSystem.getMeshes().find(m => m.def.name === name);
      if (!found) return;
      closeInfoPanels();
      planetPanel?.show(found.def, found.mesh);
      flyToPlanet(found.mesh);
    });
  });

  document.querySelectorAll('.hud-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: btn.dataset.key, bubbles: true }));
    });
  });

  document.getElementById('btn-starfield')?.addEventListener('click', toggleStars);

  document.getElementById('btn-orbits')?.addEventListener('click', () => {
    if (orbitRings) orbitRings.toggle();
    hudOrbitActive = !hudOrbitActive;
    setHudToggle('btn-orbits', hudOrbitActive);
  });

  document.getElementById('btn-constellations')?.addEventListener('click', () => {
    if (constellations) constellations.toggle();
    hudConstActive = !hudConstActive;
    setHudToggle('btn-constellations', hudConstActive);
  });

  document.getElementById('btn-satellites')?.addEventListener('click', toggleSats);

  document.getElementById('btn-debris')?.addEventListener('click', () => {
    toggleDebris();
  });

  document.getElementById('btn-asteroids')?.addEventListener('click', () => {
    if (asteroidBelt) asteroidBelt.toggle();
    hudAstActive = !hudAstActive;
    setHudToggle('btn-asteroids', hudAstActive);
  });

  document.getElementById('btn-weather')?.addEventListener('click', toggleWeather);

  document.getElementById('btn-risk')?.addEventListener('click', toggleRisk);

  document.getElementById('btn-time')?.addEventListener('click', toggleTime);

  document.getElementById('btn-heat')?.addEventListener('click', toggleHeat);

  document.getElementById('btn-intl')?.addEventListener('click', toggleIntl);
  document.getElementById('btn-explorer')?.addEventListener('click', toggleExplorer);

  document.getElementById('sat-panel-close')?.addEventListener('click', () => {
    selectedSatIdx = -1;
    if (satelliteLayer) satelliteLayer.setSelected(-1);
    if (satelliteLayer) satelliteLayer.clearLaunchGroup();
    if (satReticle) satReticle.classList.add('hidden');
  });

  document.getElementById('risk-panel-close')?.addEventListener('click', () => {
    hudRiskActive = false;
    if (riskOverlay) riskOverlay.setVisible(false);
    if (riskPanel)   riskPanel.hide();
    setHudToggle('btn-risk', false);
  });
  document.getElementById('weather-panel-close')?.addEventListener('click', () => {
    hudWeatherActive = false;
    if (weatherPanel) weatherPanel.hide();
    setHudToggle('btn-weather', false);
  });

  document.getElementById('intl-panel-close')?.addEventListener('click', () => {
    hudIntlActive = false;
    if (interstellarLayer) interstellarLayer.setVisible(false);
    document.getElementById('intl-panel')?.classList.add('hidden');
    setHudToggle('btn-intl', false);
  });

  document.getElementById('btn-search')?.addEventListener('click', () => {
    if (search) search.open();
  });

  document.getElementById('btn-report')?.addEventListener('click', triggerReport);

  document.getElementById('btn-speed-down')?.addEventListener('click', () => {
    speedIndex = Math.max(speedIndex - 1, 0);
    updateSpeedHUD();
  });
  document.getElementById('btn-speed-up')?.addEventListener('click', () => {
    speedIndex = Math.min(speedIndex + 1, TIME_SPEEDS.length - 1);
    updateSpeedHUD();
  });
}

function closeInfoPanels() {
  satPanel?.hide();
  if (selectedSatIdx !== -1) {
    satelliteLayer?.setSelected(-1);
    selectedSatIdx = -1;
    document.getElementById('sat-reticle')?.classList.add('hidden');
  }
  planetPanel?.hide();
  sunLayer?.hidePanel();
  galaxyLayer?.hidePanel();
  selectedDso = null;
  _dsoReticleEl?.classList.add('hidden');
}

function updatePhaseHUD(text) {
  const el = document.getElementById('stat-phase');
  if (el) el.textContent = text;
}

function updateSpeedHUD() {
  const label = formatSpeedLabel();
  if (statSpeed)      statSpeed.textContent    = label;
  if (hudSpeedLabel)  hudSpeedLabel.textContent = label;
  if (mobileControls) mobileControls.updateSpeed(label);
}

function formatSpeedLabel() {
  const speed = TIME_SPEEDS[speedIndex];
  return speed < 0 ? `${speed}×` : `+${speed}×`;
}

function setHudToggle(id, active) {
  const btn = document.getElementById(id);
  if (btn) btn.classList.toggle('active', active);
}

function formatSimDate(ms) {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const d  = new Date(ms);
  const Y  = d.getUTCFullYear();
  const M  = MONTHS[d.getUTCMonth()];
  const D  = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${D} ${M} ${Y}  ${hh}:${mm} UTC`;
}

const HUD_TIPS = {
  'btn-preset-leo':    { title: 'Low Earth Orbit',        key: '1', desc: 'Zoom to the 200–2000 km altitude zone where most satellites and debris live.', combo: 'With <strong>A SATS</strong> + <strong>D DEBRIS</strong> for the full LEO environment.' },
  'btn-preset-geo':    { title: 'Geostationary Belt',     key: '2', desc: 'Jump to 35,786 km — where weather and comms satellites appear to hover over one spot.', combo: 'With <strong>O RINGS</strong> to see the belt marker.' },
  'btn-preset-lunar':  { title: 'Cislunar Space',         key: '3', desc: 'Earth and Moon in the same frame. The whole cislunar regime visible at once.' },
  'btn-preset-solar':  { title: 'Inner Solar System',     key: '4', desc: 'Planets 1–4 visible. Great for watching orbital mechanics in accelerated time.', combo: 'With <strong>B BELT</strong> to see the asteroid belt light up.' },
  'btn-preset-stars':  { title: 'Star Sphere',            key: '5', desc: 'Zoom all the way out to the HYG star catalog — 119,625 stars surrounding the solar system.', combo: 'With <strong>C LINES</strong> to see constellations mapped.' },
  'btn-preset-outer':  { title: 'Outer Solar System',     key: '6', desc: 'Jupiter, Saturn, Uranus, Neptune in context. Best for interstellar trajectories.', combo: 'With <strong>Y DEEP</strong> to see hyperbolic trajectories from beyond.' },
  'btn-starfield':     { title: 'Star Field',             key: 'F', desc: '119,625 stars from the HYG v38 catalog, color-coded by spectral type. B-type stars glow blue, K/M-type stars glow warm red-orange.', combo: 'With <strong>C LINES</strong> for the classic star map view.' },
  'btn-orbits':        { title: 'Orbit Rings',            key: 'O', desc: 'Altitude markers for LEO (2000 km), MEO (20,500 km), and GEO (35,786 km). Hover any ring for altitude info.', combo: 'With <strong>A SATS</strong> to see how satellites distribute across bands.' },
  'btn-constellations':{ title: 'Constellation Lines',    key: 'C', desc: '86 classical constellation patterns drawn from HIP star IDs. Hover any for its name and mythology.', combo: 'With <strong>F STARS</strong> for the full star map experience.' },
  'btn-satellites':    { title: 'Active Satellites',      key: 'A', desc: 'All 27,000+ currently tracked objects in real time via SGP4 propagation. Click any glowing dot to inspect it.', combo: 'With <strong>G RISK</strong> to see live conjunction risk between them.' },
  'btn-debris':        { title: 'Debris Layer',           key: 'D', desc: 'Rocket bodies and defunct satellites shown in red. Over 23,000 pieces of tracked debris orbit Earth today.', combo: 'With <strong>H DENSITY</strong> to see which altitude bands are most crowded.' },
  'btn-asteroids':     { title: 'Asteroid Belt',          key: 'B', desc: '600,000+ asteroids between Mars and Jupiter using real MPC orbital elements. Each rendered at its true orbital position.', combo: 'Best at <strong>4 SOLAR</strong> view with the inner solar system in frame.' },
  'btn-weather':       { title: 'Space Weather',          key: 'W', desc: 'Live Kp index, solar flare class, and aurora forecast from NOAA SWPC. Panel pulses red when a geomagnetic storm (Kp ≥ 5) is active.' },
  'btn-risk':          { title: 'Conjunction Risk',       key: 'G', desc: 'Continuously scans all tracked objects for close approaches. Click any event in the list to fly to it and open the detail panel.', combo: 'With <strong>X TIME</strong>: jump to an event\'s TCA and watch the approach.' },
  'btn-time':          { title: 'Time Controls',          key: 'X', desc: 'Scrub simulation time ±7 days. Speed controls run up to ×1,000,000. Click "NOW" to snap back to real time.', combo: 'With any planet to watch orbital mechanics in accelerated time.' },
  'btn-heat':          { title: 'Orbital Density Map',    key: 'H', desc: 'Heatmap of object crowding by altitude band. Blue = sparse, red = dense. Click any band to highlight satellites in that shell.', combo: 'With <strong>A SATS</strong> + <strong>D DEBRIS</strong> for the complete environment.' },
  'btn-intl':          { title: 'Interstellar Objects',   key: 'Y', desc: 'Real hyperbolic trajectories for the three known interstellar visitors: ʻOumuamua (2017), Borisov (2019), and 3I/ATLAS (2025).', combo: 'With <strong>6 OUTER</strong> view to see them cross the solar system.' },
  'btn-explorer':      { title: 'Deep Space Explorer',    key: 'I', desc: 'Browse galaxies, nebulae, black holes, and interstellar visitors by category. Click any object to fly there.', combo: 'With <strong>F STARS</strong> + <strong>5 STARS</strong> view for full universe perspective.' },
  'btn-search':        { title: 'Search',                 key: '/', desc: 'Find any satellite by name or NORAD ID — type "ISS", "Hubble", "Starlink", or any NORAD number. Camera flies to it.' },
  'btn-report':        { title: 'Generate PDF Report',    key: 'P', desc: 'Exports a 2-page orbital risk summary with debris statistics, space weather snapshot, and a screenshot of the current view.', combo: 'Best after activating <strong>G RISK</strong> and <strong>W WEATHER</strong>.' },
  'btn-help':          { title: 'Controls Guide',         key: '?', desc: 'Open the full keyboard shortcuts reference, button guide, and powerful feature combinations.' },
};

(function initHudTooltips() {
  const tipEl = document.getElementById('hud-tooltip');
  if (!tipEl) return;
  const tipBox = tipEl.querySelector('.hud-tip-box');
  let _tipTimer = null;

  function showTip(id, rect) {
    const tip = HUD_TIPS[id];
    if (!tip) return;
    const comboHtml = tip.combo
      ? `<div class="hud-tip-combo">✦ ${tip.combo}</div>` : '';
    tipBox.innerHTML = `
      <div class="hud-tip-header">
        <span class="hud-tip-title">${tip.title}</span>
        <span class="hud-tip-key">${tip.key}</span>
      </div>
      <div class="hud-tip-desc">${tip.desc}</div>
      ${comboHtml}`;
    const cx     = rect.left + rect.width / 2;
    const bottom = window.innerHeight - rect.top + 12;
    const tipW   = 230;
    const cxClamped = Math.max(tipW / 2 + 8, Math.min(window.innerWidth - tipW / 2 - 8, cx));
    tipEl.style.left   = `${cxClamped}px`;
    tipEl.style.bottom = `${bottom}px`;
    tipEl.classList.add('tip-visible');
  }

  function hideTip() {
    tipEl.classList.remove('tip-visible');
  }

  document.querySelectorAll('[id^="btn-"]').forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      clearTimeout(_tipTimer);
      _tipTimer = setTimeout(() => showTip(btn.id, btn.getBoundingClientRect()), 320);
    });
    btn.addEventListener('mouseleave', () => {
      clearTimeout(_tipTimer);
      hideTip();
    });
    btn.addEventListener('mousedown', hideTip);
  });
})();

(function initHelpOverlay() {
  const overlay    = document.getElementById('help-overlay');
  const backdrop   = document.getElementById('help-backdrop');
  const closeBtn   = document.getElementById('help-close-btn');
  const helpBtn    = document.getElementById('btn-help');
  if (!overlay) return;

  function openHelp()  { overlay.classList.remove('hidden'); }
  function closeHelp() { overlay.classList.add('hidden'); }

  helpBtn?.addEventListener('click', openHelp);
  closeBtn?.addEventListener('click', closeHelp);
  backdrop?.addEventListener('click', closeHelp);

  window.addEventListener('keydown', e => {
    if (e.key === '?' && !e.target.matches('input, textarea')) openHelp();
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) closeHelp();
  });

  const tabBtnControls = document.getElementById('help-tab-btn-controls');
  const tabBtnAbout    = document.getElementById('help-tab-btn-about');
  const tabControls    = document.getElementById('help-tab-controls');
  const tabAbout       = document.getElementById('help-tab-about');

  function switchTab(active) {
    const isControls = active === 'controls';
    tabBtnControls?.classList.toggle('active', isControls);
    tabBtnAbout?.classList.toggle('active', !isControls);
    tabControls?.classList.toggle('active', isControls);
    tabAbout?.classList.toggle('active', !isControls);
  }

  tabBtnControls?.addEventListener('click', () => switchTab('controls'));
  tabBtnAbout?.addEventListener('click',    () => switchTab('about'));

  helpBtn?.addEventListener('click', () => switchTab('controls'));

  document.getElementById('help-replay-btn')?.addEventListener('click', () => {
    closeHelp();
    setTimeout(() => { window._snReplayOnboarding?.(); }, 150);
  });

  document.getElementById('help-suggest-btn')?.addEventListener('click', () => {
    window.open('mailto:francomatacarolina@gmail.com?subject=SpaceNavigator%20Sugerencia', '_blank');
  });
})();

(function initOnboarding() {
  const STORAGE_KEY = 'sn_onboarded_v1';

  const overlay  = document.getElementById('onboarding');
  const titleEl  = document.getElementById('ob-title');
  const bodyEl   = document.getElementById('ob-body');
  const nextBtn  = document.getElementById('ob-next');
  const skipBtn  = document.getElementById('ob-skip');
  const dots     = document.querySelectorAll('.ob-dot');
  if (!overlay) return;

  const STEPS = [
    {
      title: 'You\'re seeing space in real time',
      body:  'Every glowing dot is a real satellite or piece of debris tracked by the US Space Force right now — over <strong>27,000 objects</strong> orbiting Earth, propagated live using SGP4 orbital mechanics.',
    },
    {
      title: 'Click any object to inspect it',
      body:  'Click a satellite to see its name, orbit, altitude, and velocity. Use the planet buttons along the top to fly to any body in the solar system. Press <strong>E</strong> at any time to return to Earth.',
    },
    {
      title: 'G reveals orbital risk',
      body:  'Press <strong>G</strong> to activate the conjunction risk scanner. It continuously checks all tracked objects for close approaches. Click any event to fly to it and inspect the encounter.',
    },
    {
      title: 'X lets you travel through time',
      body:  'Press <strong>X</strong> to open the time controls and scrub ±7 days. Use <strong>[</strong> and <strong>]</strong> to slow or speed up to ×1,000,000. Press <strong>?</strong> any time to see the full controls guide.',
    },
  ];

  let step = 0;

  function renderStep(i) {
    dots.forEach((d, idx) => d.classList.toggle('active', idx === i));
    titleEl.textContent = STEPS[i].title;
    bodyEl.innerHTML    = STEPS[i].body;
    nextBtn.textContent = i === STEPS.length - 1 ? 'Get started →' : 'Continue →';
  }

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1');
    overlay.classList.add('hidden');
  }

  nextBtn?.addEventListener('click', () => {
    if (step < STEPS.length - 1) { step++; renderStep(step); }
    else dismiss();
  });

  skipBtn?.addEventListener('click', dismiss);

  window._snReplayOnboarding = function() {
    step = 0;
    renderStep(0);
    overlay.classList.remove('hidden');
  };

  if (!localStorage.getItem(STORAGE_KEY)) {
    setTimeout(() => {
      renderStep(0);
      overlay.classList.remove('hidden');
    }, 1800);
  }
})();

init().catch(err => {
  console.error('[SpaceNavigator] Fatal init error:', err);
  document.getElementById('loading').querySelector('p').textContent =
    'Error: ' + err.message;
});
