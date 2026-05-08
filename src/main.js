
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
import { createSunHealthPanel }   from './ui/sun-health-panel.js';
import { SUN_VISUAL_RADIUS }      from './layers/sun.js';
import { createDebrisDensity }    from './layers/debris-density.js';
import { findNearestToClick, findNearestToPoint } from './ui/raycaster.js';
import { createSatellitePanel } from './ui/satellite-panel.js';
import { createPlanetPanel }    from './ui/planet-panel.js';
import { generateReport }       from './reports/report-generator.js';
import { createInterstellarLayer } from './layers/interstellar.js';
import { createHistoryPanel }      from './ui/history-panel.js';
import { createDebrisArchaeology } from './ui/debris-archaeology.js';
import { showEventCinema }         from './ui/event-cinema.js';
import { createConstellationPanel } from './ui/constellation-panel.js';
import { createStarPanel }          from './ui/star-panel.js';
import { raDec3D }                  from './utils/sky-math.js';
import { geodeticToScene, EARTH_RADIUS_UNITS } from './utils/coordinates.js';
import { createGalaxyLayer }       from './layers/galaxies.js';
import { createExplorerPanel }     from './ui/explorer-panel.js';
import { initDragManager, registerDynamicPanel } from './ui/drag-manager.js';
import * as profiler               from './core/profiler.js';
import { createMobileControls, isMobile } from './ui/mobile-controls.js';
import { GALAXIES, NEBULAE, BLACK_HOLES, CLUSTERS, ALL_DSOS } from './data/galaxy-catalog.js';
import { encodeState, decodeState, writeState } from './utils/url-state.js';
import { createPowersOfTen } from './ui/powers-of-ten.js';
import { createOperatorPanel } from './ui/operator-panel.js';
import { createMissionSandbox } from './ui/mission-sandbox.js';
import { createUISounds }       from './audio/ui-sounds.js';
import { computeDragRisk, countRiskLevels }     from './data/drag-forecast.js';
import { getPopulationAt }                      from './data/history-events.js';

let sounds           = null;
let renderer, scene, camera, controls, navigation;

const COMPACT = new URLSearchParams(location.search).get('mode') === 'compact';

let _flyToPlanet = null;
let _flyToSun    = null;
let _backToEarth = null;
let earthLayer       = null;
let atmosphereLayer  = null;
let starField        = null;
let satelliteLayer   = null;
let constellations   = null;
let trailLayer       = null;
let groupOverlay     = null;
let orbitRings       = null;
let sunLayer         = null;
let solarSystem      = null;
let asteroidBelt     = null;
let riskOverlay      = null;
let riskPanel        = null;
let conjDetail       = null;
let timeControls     = null;
let debrisDensity    = null;

let hudTimeActive      = false;
let hudHeatActive      = false;
let spaceWeather     = null;
let weatherPanel     = null;
let sunHealthPanel   = null;
let _lastWeatherSyncReal = 0;
let _lastWeatherSimTime  = null;
let satPanel         = null;
let planetPanel      = null;
let explorerPanel    = null;
let followPlanet     = null;
let _conjTrack       = null;
let search           = null;
let tleData          = [];
let frameCount       = 0;
let lastFpsTime      = performance.now();

let hoveredPlanetMesh = null;
let hoveredDso        = null;

let selectedSatIdx = -1;

let selectedDso    = null;

const _followDelta  = new THREE.Vector3();
const _reticleProj  = new THREE.Vector3();
const _ORIGIN       = new THREE.Vector3(0, 0, 0);
let   _dsoReticleEl = null;

let hudStarsActive  = true;
let hudOrbitActive  = false;
let hudConstActive  = true;
let hudSatsActive   = true;
let hudDebrisActive   = true;
let hudAstActive      = false;
let hudWeatherActive  = false;
let hudRiskActive     = false;
let hudIntlActive     = false;
let interstellarLayer = null;
let historyPanel           = null;
let debrisArchaeologyPanel = null;
let constellationPanel     = null;
let starPanel              = null;
let galaxyLayer       = null;
let mobileControls    = null;
let powersOfTen       = null;
let operatorPanel     = null;
let missionSandbox    = null;
let _initialUrlState  = null;

const TIME_SPEEDS  = [
  -1_000_000, -100_000, -10_000, -1_000, -100, -10, -1,
  1, 10, 100, 1_000, 10_000, 100_000, 1_000_000,
];
let   speedIndex         = 7;
let   _timePaused        = false;
let   _pausedSpeedIndex  = 7;
let   simTime      = Date.now();
let   lastRealTime = performance.now();

const loading      = document.getElementById('loading');
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
  scene.background = null;

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

  sounds = createUISounds();

  if (COMPACT) {
    document.body.dataset.compact = '1';

    function _updateCompactSize() {
      const w = window.innerWidth;
      document.body.dataset.compactSize = w < 380 ? 'xs' : w < 520 ? 'sm' : 'md';
    }
    window.addEventListener('resize', _updateCompactSize, { passive: true });
    _updateCompactSize();
  }

  {
    let _primed = false;
    const _prime = () => { if (!_primed) { _primed = true; sounds.prime(); } };
    document.addEventListener('pointerdown', _prime, { once: true });
    document.addEventListener('keydown',     _prime, { once: true });

    const _hoverCooldown = new WeakMap();
    document.addEventListener('mouseover', (e) => {
      const el = e.target.closest(
        'button, .op-row, .exp-row, .exp-tab, .exp-group-row, .exp-intl-header, ' +
        '.rp-item, .op-conj-item, .hp-card, .cap-card, .cd-jump-btn, .tp-btn, ' +
        '.hud-btn, .hud-tab, .hud-preset-btn, .hud-planet-btn, .hud-speed-btn'
      );
      if (!el) return;
      const last = _hoverCooldown.get(el) ?? 0;
      const now  = performance.now();
      if (now - last < 80) return;
      _hoverCooldown.set(el, now);
      sounds?.hover();
    }, true);
  }

  const cam  = createCamera(renderer);
  camera     = cam.camera;
  controls   = cam.controls;

  navigation    = createNavigation(camera, controls);
  powersOfTen   = createPowersOfTen(camera, controls);
  operatorPanel = createOperatorPanel({
    onSelectFleet: (noradSet, fleet) => {

      satelliteLayer?.setLaunchGroup(noradSet);

      if (groupOverlay) { groupOverlay.dispose(); groupOverlay = null; }
      if (tleData.length > 0) {
        const MAX_ARC_SATS = 60;
        const groupEntries  = [];
        for (let i = 0; i < tleData.length && groupEntries.length < MAX_ARC_SATS; i++) {
          if (noradSet.has(tleData[i].norad)) groupEntries.push({ tle: tleData[i], idx: i });
        }
        if (groupEntries.length > 0) {
          groupOverlay = createGroupOverlay(scene, groupEntries);
        }
      }

      if (satelliteLayer && satReticle) {
        const positions = satelliteLayer.getPositions();
        for (let i = 0; i < tleData.length; i++) {
          if (noradSet.has(tleData[i].norad)) {
            const tle = tleData[i];
            const pos = new THREE.Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
            if (pos.lengthSq() > 0) {
              satelliteLayer.setSelected(i);
              selectedSatIdx = i;
              if (satReticleNameEl) satReticleNameEl.textContent = fleet.label.toUpperCase();
              satReticle.classList.remove('hidden');
              break;
            }
          }
        }
      }

      setHudToggle('btn-operator', true);
    },
    onClear: () => {
      satelliteLayer?.clearLaunchGroup();
      satelliteLayer?.setSelected(-1);
      selectedSatIdx = -1;
      if (satReticle) satReticle.classList.add('hidden');
      if (groupOverlay) { groupOverlay.dispose(); groupOverlay = null; }
      setHudToggle('btn-operator', operatorPanel?.isVisible() ?? false);
    },
    onSelectConjunction: handleConjunctionSelect,
  });

  missionSandbox = createMissionSandbox(scene, () => setHudToggle('btn-mission', false));

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

  sunHealthPanel = createSunHealthPanel({
    spaceWeather,
    onViewRealSize: (active) => {
      if (!sunLayer) return;
      if (active) {
        sunLayer.showHologram();
        flyToSunHologram();
      } else {
        sunLayer.hideHologram();
        flyToSun();
      }
    },
    onOpenWeather: () => {
      closeInfoPanels();
      if (weatherPanel) { weatherPanel.show(); hudWeatherActive = true; setHudToggle('btn-weather', true); }
    },
  });

  spaceWeather.onUpdate(weatherData => {
    if (!satelliteLayer || !tleData || tleData.length === 0) return;
    const riskMap    = computeDragRisk(weatherData.kp, tleData);
    const riskCounts = countRiskLevels(riskMap);
    satelliteLayer.setDragRisk(riskMap);
    if (weatherPanel) weatherPanel.updateForecast(weatherData.kpForecast, riskCounts);
    operatorPanel?.updateWeather(weatherData);
  });

  spaceWeather.onUpdate(() => {

    _lastWeatherSimTime = null;
  });

  conjDetail = createConjunctionDetail();
  conjDetail.onClose(() => {
    if (riskPanel) riskPanel.deselect();
    _conjTrack = null;
    if (controls) controls.minDistance = EARTH_RADIUS_UNITS * 1.002;
  });

  timeControls = createTimeControls({
    getTime: () => simTime,
    setTime: t  => { simTime = t; },
  });

  window.addEventListener('jump-to-time', e => {
    if (timeControls) timeControls.jumpTo(e.detail);
    if (!hudTimeActive) toggleTime();
  });

  interstellarLayer = createInterstellarLayer(scene);
  interstellarLayer.setVisible(false);

  debrisArchaeologyPanel = createDebrisArchaeology({
    onJumpToDate: ms => { simTime = ms; },
    onGotoEvent:  (ev, ms) => _gotoWithCinema(ev, ms),
  });

  constellationPanel = createConstellationPanel({
    onClose: () => constellations?.highlight(null),
  });

  starPanel = createStarPanel({
    onClose: () => {},
  });

  historyPanel = createHistoryPanel({
    onJumpToDate:  ms  => { simTime = ms; },
    onGotoEvent:   (ev, ms) => _gotoWithCinema(ev, ms),
    onDebrisEvent: ev  => { debrisArchaeologyPanel.show(ev); },
    onClose:       ()  => { debrisArchaeologyPanel.hide(); satelliteLayer?.setHistoricalOpacity(1.0); satelliteLayer?.clearHistoricalYear(); },
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
      sunHealthPanel?.hide();
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
      sunHealthPanel?.hide();
      galaxyLayer?.hidePanel();
      selectedDso = null;
      _dsoReticleEl?.classList.add('hidden');
      satelliteLayer.clearLaunchGroup();
      satelliteLayer.setSelected(idx);
      sounds?.select();
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
    onSelectStar(star) {
      closeInfoPanels();
      const dir = raDec3D(star.raDeg, star.decDeg);
      flyToSkyDir(new THREE.Vector3(dir.x, dir.y, dir.z));
      starPanel?.show(star, simTime);
    },
    onSelectInterstellar(obj) {
      if (!interstellarLayer) return;

      if (!hudIntlActive) {
        hudIntlActive = true;
        interstellarLayer.setVisible(true);
        setHudToggle('btn-intl', true);
      }

      const periMs = interstellarLayer.getPerihelionMs(obj.id);
      if (periMs != null) simTime = periMs;

      const pos = interstellarLayer.getScenePos(obj.id, simTime);
      if (!pos) return;
      if (controls) controls.minDistance = 10;
      sounds?.flyTo();
      navigation.flyToPoint({ x: pos.x, y: pos.y, z: pos.z }, 180);
    },
    flyTo: (dist) => { if (navigation) navigation.flyTo(dist); },
  });

  window.addEventListener('density-band-select', e => {
    if (!satelliteLayer) return;
    const bands = e.detail;
    if (bands.length === 0) {
      satelliteLayer.clearAltitudeBands();
    } else {
      satelliteLayer.setAltitudeBands(bands.map(b => ({ low: b.low, high: b.high })));
    }
  });

  window.addEventListener('cap-shell-select', e => {
    if (!navigation) return;
    const sh = e.detail;
    if (!sh) return;
    const midKm = (sh.minKm + sh.maxKm) / 2;
    const dist = (6371 + midKm) / 500;
    navigation.flyTo(dist);
  });

  setStatus('Ready.');
  loading.classList.add('hidden');
  setTimeout(() => loading.style.display = 'none', 900);

  initDragManager();

  _initialUrlState = decodeState();
  if (_initialUrlState) applyUrlState(_initialUrlState, 'camera');

  _dsoReticleEl = document.getElementById('dso-reticle');

  profiler.setRenderer(renderer);

  animate();

  _notifyReady();

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
    followPlanet = null;
    if (navigation) navigation.clearFocusPlanet();

    const def    = mesh.userData.planetDef;
    const target = mesh.position.clone();

    const startTarget = controls.target.clone();
    const startPos    = camera.position.clone();

    const isMoon = def?.name === 'Moon';
    const orbitDist = isMoon
      ? 6
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

  function _flyToSunAtDist(orbitDist, dur = 2000) {
    followPlanet = null;
    if (navigation) navigation.clearFocusPlanet();

    const sunPos = sunLayer?.sun?.position.clone()
                ?? new THREE.Vector3(0.75, 0.0, 0.64).normalize().multiplyScalar(650);

    const startTarget = controls.target.clone();
    const startPos    = camera.position.clone();

    let dirApproach = startPos.clone().sub(sunPos);
    if (dirApproach.lengthSq() < 0.001) dirApproach.set(0, 0, 1);
    dirApproach.normalize();
    const newCamPos = sunPos.clone().add(dirApproach.multiplyScalar(orbitDist));

    const START = performance.now();
    function animate() {
      const t    = Math.min(1.0, (performance.now() - START) / dur);
      const ease = 1 - Math.pow(1 - t, 3);
      controls.target.lerpVectors(startTarget, sunPos, ease);
      camera.position.lerpVectors(startPos, newCamPos, ease);
      controls.update();
      if (t < 1.0) requestAnimationFrame(animate);
      else if (navigation && sunLayer?.sun) navigation.setFocusPlanet(sunLayer.sun);
    }
    animate();
  }

  function flyToSun() {
    _flyToSunAtDist(SUN_VISUAL_RADIUS * 5, 2000);
  }

  function flyToSunHologram() {
    const SUN_REAL_R = 1393;
    _flyToSunAtDist(Math.round(SUN_REAL_R * 1.4), 3000);
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

  const SKY_R = 9e4;
  function flyToSkyDir(dir) {
    followPlanet = null;
    if (navigation) navigation.clearFocusPlanet();

    const TARGET_DIST = SKY_R * 0.78;
    const CAM_DIST    = 4000;

    const newTarget  = dir.clone().multiplyScalar(TARGET_DIST);
    const newCamPos  = dir.clone().multiplyScalar(TARGET_DIST - CAM_DIST);

    const startTarget = controls.target.clone();
    const startPos    = camera.position.clone();
    const START = performance.now();
    const DUR   = 2200;

    function animateFlyToSky() {
      const t    = Math.min(1.0, (performance.now() - START) / DUR);
      const ease = 1 - Math.pow(1 - t, 3);
      controls.target.lerpVectors(startTarget, newTarget, ease);
      camera.position.lerpVectors(startPos, newCamPos, ease);
      controls.update();
      if (t < 1.0) requestAnimationFrame(animateFlyToSky);
    }
    animateFlyToSky();
  }

  function backToEarth() {
    followPlanet = null;
    if (navigation) navigation.clearFocusPlanet();

    satPanel?.hide();
    selectedSatIdx = -1;
    satelliteLayer?.setSelected(-1);
    planetPanel?.hide();
    sunHealthPanel?.hide();
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

  _flyToPlanet = flyToPlanet;
  _flyToSun    = flyToSun;
  _backToEarth = backToEarth;

  planetPanel = createPlanetPanel(flyToPlanet, backToEarth);

  setupHUD({ backToEarth, flyToSun, flyToPlanet });
  updateSpeedHUD();

  mobileControls = createMobileControls(
    camera,
    controls,
    renderer.domElement,
    {
      backToEarth,
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
        sunHealthPanel?.hide();
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
          const MAX_ARC_SATS = 60;
          const groupEntries = [];
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
    },
  );

  if (mobileControls) {
    window.addEventListener('mobile-speed-change', (e) => {
      if (e.detail === +1) speedIndex = Math.min(speedIndex + 1, TIME_SPEEDS.length - 1);
      if (e.detail === -1) speedIndex = Math.max(speedIndex - 1, 0);
      updateSpeedHUD();
      mobileControls?.updateSpeed(formatSpeedLabel());
    });

    const SCENE_KM = 500.0;
    const EARTH_R  = 6371.0;

    function _satAltKm(pos) {
      const distUnits = pos.length();
      return Math.round(distUnits * SCENE_KM - EARTH_R);
    }

    function _tleInclination(tle) {

      try { return parseFloat(tle.line2?.substring(8, 16)).toFixed(1); } catch { return '—'; }
    }

    function _tlePeriodMin(tle) {

      try {
        const mm = parseFloat(tle.line2?.substring(52, 63));
        return mm > 0 ? (1440 / mm).toFixed(1) : '—';
      } catch { return '—'; }
    }

    function buildSatInfo(tle, pos) {
      const alt  = _satAltKm(pos);
      const inc  = _tleInclination(tle);
      const per  = _tlePeriodMin(tle);
      const cat  = (tle.category ?? 'SAT').toUpperCase();
      return {
        name: tle.name ?? `SAT #${tle.noradId}`,
        type: cat,
        stat: `${alt > 0 ? alt.toLocaleString() : '—'} km`,
        rows: [
          { label: 'ALT',    value: `${alt > 0 ? alt.toLocaleString() : '—'} km` },
          { label: 'INC',    value: `${inc}°` },
          { label: 'PERIOD', value: `${per} min` },
          { label: 'NORAD',  value: tle.noradId ?? '—' },
          { label: 'LAUNCH', value: tle.launchDate ?? tle.epoch?.slice(0,10) ?? '—' },
        ],
      };
    }

    function buildPlanetInfo(def) {
      const rows = [];
      if (def.radius_km)       rows.push({ label: 'RADIUS',   value: `${def.radius_km.toLocaleString()} km` });
      if (def.mass_kg)         rows.push({ label: 'MASS',     value: `${def.mass_kg}` });
      if (def.moons != null)   rows.push({ label: 'MOONS',    value: `${def.moons}` });
      if (def.day_hours)       rows.push({ label: 'DAY',      value: `${def.day_hours} h` });
      if (def.year_days)       rows.push({ label: 'YEAR',     value: `${def.year_days} d` });
      if (def.avg_temp_c)      rows.push({ label: 'TEMP',     value: `${def.avg_temp_c} °C` });
      return {
        name: def.name.toUpperCase(),
        type: def.type?.toUpperCase() ?? 'BODY',
        stat: def.distAU ? `${def.distAU.toFixed(2)} AU` : '',
        rows,
      };
    }

    window.addEventListener('mob-tap-select', (e) => {
      const cvs = renderer.domElement;
      const W   = cvs.clientWidth;
      const H   = cvs.clientHeight;
      const tx  = e.detail?.clientX ?? W / 2;
      const ty  = e.detail?.clientY ?? H / 2;

      if (tx < -100 || ty < -100) {
        satelliteLayer?.setSelected(-1);
        closeInfoPanels();
        mobileControls?.hideInfo();
        mobileControls?.updateBodyName('');
        followPlanet = null;
        if (navigation) navigation.clearFocusPlanet();
        if (trailLayer) { trailLayer.dispose(); trailLayer = null; }
        selectedSatIdx = -1;
        if (satReticle) satReticle.classList.add('hidden');
        selectedDso = null;
        galaxyLayer?.hidePanel();
        _dsoReticleEl?.classList.add('hidden');
        return;
      }

      const ndcX =  (tx / W) * 2 - 1;
      const ndcY = -((ty / H) * 2 - 1);
      const _mr  = new THREE.Raycaster();
      _mr.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);

      if (solarSystem) {
        const meshesData = solarSystem.getMeshes();
        const meshes     = meshesData.map(m => m.mesh);
        if (sunLayer?.sun) meshes.push(sunLayer.sun);
        const hits = _mr.intersectObjects(meshes, false);
        if (hits.length > 0) {
          const hitMesh = hits[0].object;
          if (hitMesh.userData.isSun) {
            closeInfoPanels();
            flyToSun();
            mobileControls?.showInfo({ name: 'SUN', type: 'STAR', stat: '1 AU',
              rows: [{ label: 'CLASS', value: 'G2V' }, { label: 'RADIUS', value: '695,700 km' }] });
            mobileControls?.updateBodyName('SUN');
            return;
          }
          const def = hitMesh.userData.planetDef;
          if (def) {
            closeInfoPanels();
            flyToPlanet(hitMesh);
            mobileControls?.showInfo(buildPlanetInfo(def));
            mobileControls?.updateBodyName(def.name.toUpperCase());
            return;
          }
        }
      }

      if (galaxyLayer) {
        const dso = galaxyLayer.pick(tx, ty, camera, cvs);
        if (dso) {
          closeInfoPanels();
          selectedDso = dso;
          galaxyLayer.showPanel(dso);
          flyToDso(dso);
          mobileControls?.showInfo({
            name: dso.name.toUpperCase(),
            type: (dso.type ?? 'DSO').toUpperCase(),
            stat: dso.distance ?? '',
            rows: dso.details ?? [],
          });
          mobileControls?.updateBodyName(dso.name.toUpperCase());
          const lbl = document.getElementById('dso-reticle-label');
          if (lbl) lbl.textContent = dso.name.toUpperCase();
          return;
        }
      }

      if (satelliteLayer) {
        let idx = findNearestToPoint(
          tx, ty,
          camera,
          satelliteLayer.getPositions(),
          satelliteLayer.getCount(),
          cvs,
          52,
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
          selectedSatIdx = idx;
          mobileControls?.showInfo(buildSatInfo(tle, pos));
          mobileControls?.updateBodyName(tle?.name ?? `SAT #${idx}`);
          if (satReticleNameEl) satReticleNameEl.textContent = tle?.name ?? `SAT #${idx}`;
          if (satReticle) satReticle.classList.remove('hidden');
          if (trailLayer) { trailLayer.dispose(); trailLayer = null; }
          trailLayer = createTrail(scene, tle);
        } else {
          satelliteLayer.setSelected(-1);
          closeInfoPanels();
          mobileControls?.hideInfo();
          mobileControls?.updateBodyName('');
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

    window.addEventListener('mob-fly-planet', (e) => {
      const name = e.detail?.name ?? '';
      if (name === 'EARTH') {
        backToEarth();
        mobileControls?.hideInfo();
        mobileControls?.updateBodyName('EARTH');
        return;
      }
      if (!solarSystem) return;
      const found = solarSystem.getMeshes().find(
        m => m.def?.name?.toUpperCase() === name
      );
      if (found) {
        closeInfoPanels();
        flyToPlanet(found.mesh);
        mobileControls?.showInfo(buildPlanetInfo(found.def));
        mobileControls?.updateBodyName(name);
      }
    });

    window.addEventListener('mob-toggle-layer', (e) => {
      const key = e.detail?.key;
      switch (key) {
        case 'stars':          toggleStars();   break;
        case 'constellations':
          hudConstActive = !hudConstActive;
          if (constellations) constellations.toggle();
          setHudToggle('btn-constellations', hudConstActive);
          break;
        case 'orbits':
          hudOrbitActive = !hudOrbitActive;
          if (orbitRings) orbitRings.toggle();
          setHudToggle('btn-orbits', hudOrbitActive);
          break;
        case 'heat':           toggleHeat();    break;
        case 'asteroids':
          if (asteroidBelt) asteroidBelt.toggle();
          break;
        case 'interstellar':   toggleIntl();    break;
        case 'satellites':     toggleSats();    break;
        case 'debris':         toggleDebris();  break;
        case 'risk':           toggleRisk();    break;
        case 'weather':        toggleWeather(); break;
        case 'explorer':       toggleExplorer();break;
      }
    });

    window.addEventListener('mob-view-preset', (e) => {
      if (!navigation) return;
      const VIEW_DISTS = {
        LEO:   1.15,
        GEO:   7.5,
        LUNAR: 12,
        SOLAR: 200,
        STARS: 2000,
        OUTER: 80,
      };
      const dist = VIEW_DISTS[e.detail?.view];
      if (dist) navigation.flyTo(dist);
    });

    window.addEventListener('mob-select-dso', (e) => {
      const { id, cat } = e.detail ?? {};
      if (!id) return;
      let dso = null;
      if (cat === 'galaxy')    dso = GALAXIES.find(d => d.id === id);
      if (cat === 'blackhole') dso = BLACK_HOLES.find(d => d.id === id);
      if (cat === 'nebula')    dso = NEBULAE.find(d => d.id === id);
      if (dso) flyToDso(dso);
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
    {
      getSkyObjects: () => ALL_DSOS,
      onSelectDso: (dso) => {
        closeInfoPanels();
        selectedDso = dso;
        galaxyLayer?.showPanel(dso);
        flyToDso(dso);
        const lbl = document.getElementById('dso-reticle-label');
        if (lbl) lbl.textContent = dso.name.toUpperCase();
        if (_dsoReticleEl) _dsoReticleEl.classList.remove('hidden');
      },
      onSelectConstellation: (abbr) => {
        if (!constellations) return;
        closeInfoPanels();
        const centers = constellations.getCenters();
        const center = centers.get(abbr);
        if (!center) return;
        constellations.highlight(abbr);
        flyToSkyDir(center);
        constellationPanel?.show(abbr, center, simTime);
      },
    },
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
      if (hit) return;
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
          sunHealthPanel?.show();
          return;
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
        return;
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
      window._openCmdPalette?.();
    }
  });

  const PLANET_KEYS = {
    q: 'Mercury', v: 'Venus', r: 'Mars',
    j: 'Jupiter', t: 'Saturn', u: 'Uranus', n: 'Neptune',
    m: 'Moon',
  };

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const _pt = e.target.tagName;
    if (_pt === 'INPUT' || _pt === 'TEXTAREA' || e.target.isContentEditable) return;

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
      sunHealthPanel?.show();
      return;
    }

    const targetName = PLANET_KEYS[key];
    if (!targetName || !solarSystem) return;
    e.preventDefault();

    const found = solarSystem.getMeshes().find(m => m.def.name === targetName);
    if (!found) return;

    closeInfoPanels();
    sounds?.info();
    sounds?.flyTo();
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

    if (e.key === '-') {

      if (!_timePaused) {
        _timePaused      = true;
        _pausedSpeedIndex = speedIndex;
        speedIndex       = 7;
      } else {
        _timePaused  = false;
        speedIndex   = _pausedSpeedIndex;
      }
      updateSpeedHUD();
    }

    if (e.key === '=') {
      simTime      = Date.now();
      _timePaused  = false;
      speedIndex   = 7;
      _lastWeatherSimTime = null;
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
    if (e.key === 'k' || e.key === 'K') {
      const open = historyPanel?.toggle();
      open ? sounds?.open() : sounds?.close();
      document.getElementById('btn-history')?.classList.toggle('active', !!open);
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
    if (now - hoverThrottle < 60) return;
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
        if (dso !== hoveredDso) {
          hoveredDso = dso;
          const lbl = document.getElementById('dso-reticle-label');
          if (lbl) lbl.textContent = dso.name.toUpperCase();
        }
        canvas.style.cursor = 'pointer';
        return;
      }
    }

    if (hoveredDso) {
      hoveredDso = null;
      if (!selectedDso && _dsoReticleEl) _dsoReticleEl.classList.add('hidden');
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
        80,
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
      return;
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
    if ((e.key === 'l' || e.key === 'L') && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const visible = operatorPanel?.toggle();
      visible ? sounds?.open() : sounds?.close();
      setHudToggle('btn-operator', visible ?? false);
      return;
    }
    if ((e.key === 'z' || e.key === 'Z') && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const visible = missionSandbox?.toggle();
      setHudToggle('btn-mission', visible ?? false);
      return;
    }
    if ((e.key === 'p' || e.key === 'P') && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      if (powersOfTen?.isActive()) { powersOfTen.stop(); }
      else { closeInfoPanels(); powersOfTen?.start(); }
    }
    if (e.key === 'Escape' && powersOfTen?.isActive()) {
      powersOfTen.stop();
    }
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
        if (hudOrbitActive)   orbitRings.toggle();
        operatorPanel?.populate(tles);
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

      mobileControls?.updateSatCount(tles.length);

      const origUpdate = satelliteLayer.update.bind(satelliteLayer);
      let hudUpdated = false;
      satelliteLayer.update = (now, simT) => {
        origUpdate(now, simT);
        if (!hudUpdated && now > 0) {
          hudUpdated = true;
          updatePhaseHUD(`2.3 — ${tles.length.toLocaleString()} satellites`);
        }
      };

      if (_initialUrlState) applyUrlState(_initialUrlState, 'layers');

      operatorPanel?.populate(tles);

      const wd = spaceWeather?.getData();
      if (wd && wd.kp !== null) {
        const riskMap    = computeDragRisk(wd.kp, tles);
        const riskCounts = countRiskLevels(riskMap);
        satelliteLayer.setDragRisk(riskMap);
        if (weatherPanel) weatherPanel.updateForecast(wd.kpForecast, riskCounts);
      }
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
  if (!_timePaused) simTime += realDelta * TIME_SPEEDS[speedIndex];

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
  if (powersOfTen?.isActive()) {
    powersOfTen.update();
  } else {
    controls.update();
    if (navigation) navigation.update();
  }
  if (mobileControls) {
    mobileControls.update(realDelta);
    if (Math.floor(now / 2000) !== Math.floor((now - realDelta) / 2000)) {
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
  const _earthLayersClose = _earthLayerDist < 150;

  if (earthLayer && atmosphereLayer?.mesh) {
    atmosphereLayer.mesh.visible = true;
  }

  if (satelliteLayer) satelliteLayer.setVisible(hudSatsActive);

  if (satelliteLayer) satelliteLayer.setDebrisVisible(hudDebrisActive);

  const _orbitShouldShow = hudOrbitActive;
  if (orbitRings && !!orbitRings.isVisible() !== _orbitShouldShow) orbitRings.toggle();

  if (followPlanet) {
    _followDelta.copy(followPlanet.position).sub(controls.target);
    if (_followDelta.lengthSq() > 1e-8) {
      controls.target.add(_followDelta);
      camera.position.add(_followDelta);
      controls.update();
    }
  }

  if (_conjTrack && satelliteLayer) {
    const _cpos = satelliteLayer.getPositions();
    const ax = _cpos[_conjTrack.idxA * 3],     ay = _cpos[_conjTrack.idxA * 3 + 1], az = _cpos[_conjTrack.idxA * 3 + 2];
    const bx = _cpos[_conjTrack.idxB * 3],     by = _cpos[_conjTrack.idxB * 3 + 1], bz = _cpos[_conjTrack.idxB * 3 + 2];
    if (ax !== 0 || ay !== 0 || az !== 0) {
      const mx = (ax + bx) * 0.5, my = (ay + by) * 0.5, mz = (az + bz) * 0.5;
      _followDelta.set(mx, my, mz).sub(controls.target);
      if (_followDelta.lengthSq() > 1e-10) {
        controls.target.add(_followDelta);
        camera.position.add(_followDelta);
        controls.update();
      }
    }
  }

  profiler.begin('asteroids');
  if (asteroidBelt) asteroidBelt.update(simTime);
  profiler.end('asteroids');

  if (interstellarLayer) interstellarLayer.update(simTime);

  if (historyPanel && Math.floor(now / 1000) !== Math.floor((now - realDelta) / 1000)) {
    historyPanel.updateSimTime(simTime);
    if (satelliteLayer && historyPanel.isOpen()) {
      satelliteLayer.setHistoricalYear(new Date(simTime).getFullYear());
    }
  }

  if (Math.floor(now / 1000) !== Math.floor((now - realDelta) / 1000)) {
    if (constellationPanel?.isVisible()) constellationPanel.update(simTime);
    if (starPanel?.isVisible())          starPanel.update(simTime);
  }

  if (weatherPanel && spaceWeather &&
      hudWeatherActive &&
      now - _lastWeatherSyncReal > 5_000) {
    const SIM_THRESH = 5 * 60 * 1000;
    if (_lastWeatherSimTime === null ||
        Math.abs(simTime - _lastWeatherSimTime) > SIM_THRESH) {
      const snapshot = spaceWeather.getAtTime(simTime);
      weatherPanel.renderData(snapshot);
      _lastWeatherSyncReal = now;
      _lastWeatherSimTime  = simTime;
    }
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

  if (riskOverlay && operatorPanel?.isVisible()) {
    riskOverlay.tickScan(now);
  }

  if (riskOverlay && _earthLayersClose) {
    riskOverlay.update(now);
    if (riskPanel && Math.floor(now / 500) !== Math.floor((now - realDelta) / 500)) {
      const riskData = riskOverlay.getData();
      riskPanel.update(riskData);
    }
  }

  if (riskOverlay && operatorPanel?.isVisible()
      && Math.floor(now / 500) !== Math.floor((now - realDelta) / 500)) {
    operatorPanel.updateConjunctions(riskOverlay.getData()?.conjunctions);
  }
  profiler.end('risk');

  profiler.begin('debris');
  if (debrisDensity) debrisDensity.setVisible(hudHeatActive);
  if (debrisDensity && hudHeatActive) debrisDensity.update(now);
  profiler.end('debris');

  if (timeControls) timeControls.update();

  if (hoveredPlanetMesh && planetReticle) {
    _reticleProj.copy(hoveredPlanetMesh.position).project(camera);
    if (_reticleProj.z < 1) {
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

  const _activeDso = hoveredDso ?? selectedDso;
  if (_activeDso && galaxyLayer) {

    const lbl = document.getElementById('dso-reticle-label');
    if (lbl && lbl.textContent !== _activeDso.name.toUpperCase()) {
      lbl.textContent = _activeDso.name.toUpperCase();
    }
    const pos = galaxyLayer.getDsoScreenPos(_activeDso, camera, renderer.domElement);
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
      if (_reticleProj.z < 1) {
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

function _postFlyTo(target) {
  const PLANET_NAMES = {
    moon: 'Moon', mars: 'Mars', venus: 'Venus', mercury: 'Mercury',
    jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptune',
  };

  if (target === 'earth') { _backToEarth?.(); return; }
  if (target === 'sun')   { closeInfoPanels?.(); _flyToSun?.(); sunHealthPanel?.show(); return; }

  const planetName = PLANET_NAMES[target];
  if (planetName && solarSystem) {
    const found = solarSystem.getMeshes().find(m => m.def.name === planetName);
    if (found) { closeInfoPanels?.(); sounds?.flyTo(); _flyToPlanet?.(found.mesh); return; }
  }

  if (target === 'iss' && tleData.length && satelliteLayer) {
    const idx = tleData.findIndex(t => t.name.includes('ISS') || t.name.includes('ZARYA'));
    if (idx >= 0) {
      const pos = satelliteLayer.getPositions();
      navigation.flyToPoint({ x: pos[idx*3], y: pos[idx*3+1], z: pos[idx*3+2] }, 1.0);
      sounds?.flyTo();
      return;
    }
  }

  const PRESETS = {
    leo:      () => document.getElementById('btn-preset-leo')?.click(),
    geo:      () => document.getElementById('btn-preset-geo')?.click(),
    lunar:    () => document.getElementById('btn-preset-lunar')?.click(),
    solar:    () => document.getElementById('btn-preset-solar')?.click(),
    stars:    () => document.getElementById('btn-preset-stars')?.click(),
    starlink: () => document.getElementById('btn-preset-leo')?.click(),
  };
  PRESETS[target]?.();
}

function _postToggleLayer(layer, visible) {

  const MAP = {
    satellites:     { active: () => hudSatsActive,           btn: 'btn-satellites'    },
    debris:         { active: () => hudDebrisActive,         btn: 'btn-debris'        },
    risk:           { active: () => hudRiskActive,           btn: 'btn-risk'          },
    stars:          { active: () => hudStarsActive,          btn: 'btn-starfield'     },
    orbits:         { active: () => !!orbitRings?.isVisible(), btn: 'btn-orbits'      },
    constellations: { active: () => hudConstActive,          btn: 'btn-constellations'},
  };
  const entry = MAP[layer];
  if (!entry) return;
  if (entry.active() !== visible) document.getElementById(entry.btn)?.click();
}

function _postSetFilter(filter) {
  if (!satelliteLayer || !tleData.length) return;
  const FLEET_CATS = {
    starlink: t => t.category === 'starlink',
    oneweb:   t => t.category === 'oneweb',
    debris:   t => t.category === 'debris',
    station:  t => t.category === 'station',
    geo:      t => t.category === 'geo',
    gps:      t => t.name.match(/NAVSTAR|GPS/i),
    galileo:  t => t.name.includes('GALILEO'),
    glonass:  t => t.name.includes('GLONASS'),
    iridium:  t => t.name.includes('IRIDIUM'),
  };
  const pred = FLEET_CATS[filter];
  if (!pred) return;
  const noradSet = new Set(tleData.filter(pred).map(t => t.norad));
  satelliteLayer.setLaunchGroup(noradSet);
}

window.addEventListener('message', (e) => {
  if (!e.data || e.data.type !== 'spacenavigator') return;
  const { action, target, layer, visible, filter } = e.data;
  switch (action) {
    case 'flyTo':        _postFlyTo(target);            break;
    case 'toggleLayer':  _postToggleLayer(layer, visible); break;
    case 'setFilter':    _postSetFilter(filter);        break;
    case 'clearFilter':  satelliteLayer?.clearLaunchGroup(); break;
  }
});

function _notifyReady() {
  try {
    window.parent.postMessage({ type: 'spacenavigator', event: 'ready' }, '*');
  } catch (_) {}
}

function toggleStars() {
  if (starField) starField.toggle();
  hudStarsActive = !hudStarsActive;
  sounds?.toggle();
  setHudToggle('btn-starfield', hudStarsActive);
}

function toggleSats() {
  hudSatsActive = !hudSatsActive;
  sounds?.toggle();
  setHudToggle('btn-satellites', hudSatsActive);
}

function toggleDebris() {
  hudDebrisActive = !hudDebrisActive;
  sounds?.toggle();
  setHudToggle('btn-debris', hudDebrisActive);
}

function toggleWeather() {
  if (!weatherPanel) return;
  hudWeatherActive = weatherPanel.toggle();
  sounds?.toggle();
  setHudToggle('btn-weather', hudWeatherActive);
}

function toggleRisk() {
  hudRiskActive = !hudRiskActive;
  if (riskPanel)   { if (hudRiskActive) riskPanel.show(); else riskPanel.hide(); }
  if (!hudRiskActive && conjDetail) conjDetail.hide();
  sounds?.toggle();
  setHudToggle('btn-risk', hudRiskActive);
}

function toggleTime() {
  hudTimeActive = !hudTimeActive;
  if (timeControls) { if (hudTimeActive) timeControls.show(); else timeControls.hide(); }
  sounds?.toggle();
  setHudToggle('btn-time', hudTimeActive);
}

function _findNearestSatInRegion(scenePos, maxDistSq = 100.0) {
  if (!satelliteLayer) return -1;
  const positions = satelliteLayer.getPositions();
  const count     = satelliteLayer.getCount();
  let nearest     = -1;
  let nearestDist = maxDistSq;
  for (let i = 0; i < count; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    if (x === 0 && y === 0 && z === 0) continue;
    const dx = x - scenePos.x;
    const dy = y - scenePos.y;
    const dz = z - scenePos.z;
    const d  = dx * dx + dy * dy + dz * dz;
    if (d < nearestDist) { nearestDist = d; nearest = i; }
  }
  return nearest;
}

function _gotoWithCinema(ev, ms) {
  const SCENE_KM = 500.0;
  const EARTH_R  = 6371.0;

  showEventCinema(ev, {

    onReady: ({ lat, lon, altKm, anim }) => {
      if (!navigation) return;

      if (!altKm || altKm === 0) {

        navigation.flyTo((EARTH_R * 2.8) / SCENE_KM);
        return;
      }

      const dist = (EARTH_R + altKm * 1.25) / SCENE_KM;

      const dir = geodeticToScene(lat, lon, 0).normalize();
      navigation.flyToDir(dir, Math.max(dist, 13.0));

      if (anim === 'active' && satelliteLayer && satPanel) {
        const eventPos = geodeticToScene(lat, lon, altKm);
        const idx      = _findNearestSatInRegion(eventPos);
        if (idx !== -1) {
          const positions = satelliteLayer.getPositions();
          const tle       = satelliteLayer.getTLE(idx);
          const pos       = new THREE.Vector3(
            positions[idx * 3],
            positions[idx * 3 + 1],
            positions[idx * 3 + 2],
          );

          if (selectedSatIdx !== -1) satelliteLayer.setSelected(-1);
          planetPanel?.hide();
          _dsoReticleEl?.classList.add('hidden');

          satelliteLayer.setSelected(idx);
          satPanel.show(tle, pos);
          if (trailLayer) { trailLayer.dispose(); trailLayer = null; }
          trailLayer = createTrail(scene, tle);
          selectedSatIdx = idx;
          if (satReticleNameEl) satReticleNameEl.textContent = tle?.name ?? `SAT #${idx}`;
          if (satReticle) satReticle.classList.remove('hidden');
        }
      }
    },

    onComplete: () => {
      simTime = ms;
    },
  });
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
        <div id="heat-explainer-desc">
          Each band represents a 200 km altitude slice of near-Earth space. Click a band to highlight those objects in the 3D view — select multiple to compare zones. Color scales from green (sparse) through yellow to red (dense). Use this to spot crowded orbital shells where collision risk is highest.
        </div>
        <div id="heat-clear-row">
          <button id="heat-clear-btn">CLEAR SELECTION</button>
        </div>
        <div id="heat-band-list"></div>
      </div>
    `;
    document.body.appendChild(panel);

    registerDynamicPanel({
      id: 'heat-explainer',
      handleSel: '#heat-explainer-header',
      visibleWhen: el => el.classList.contains('visible'),
    });

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
  if (btn?.classList.contains('generating')) return;
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

  if (c.risk === 'critical') sounds?.conjCritical();
  else                       sounds?.conjWarning();

  const pos  = satelliteLayer.getPositions();
  const posA = [pos[c.idxA * 3], pos[c.idxA * 3 + 1], pos[c.idxA * 3 + 2]];
  const posB = [pos[c.idxB * 3], pos[c.idxB * 3 + 1], pos[c.idxB * 3 + 2]];

  const mx = (posA[0] + posB[0]) * 0.5;
  const my = (posA[1] + posB[1]) * 0.5;
  const mz = (posA[2] + posB[2]) * 0.5;

  if (controls) controls.minDistance = 0.05;
  navigation.flyToPoint({ x: mx, y: my, z: mz }, 1.5);

  _conjTrack = { idxA: c.idxA, idxB: c.idxB };

  if (conjDetail) conjDetail.show(c, posA, posB, simTime);
}

function setupHUD({ backToEarth, flyToSun, flyToPlanet }) {

  document.querySelectorAll('.hud-planet-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.blur();
      const key = btn.dataset.key;
      if (key === 'e') { backToEarth();                                             return; }
      if (key === 's') { closeInfoPanels(); flyToSun(); sunHealthPanel?.show();       return; }
      const PLANET_MAP = {
        q: 'Mercury', v: 'Venus', r: 'Mars',
        j: 'Jupiter', t: 'Saturn', u: 'Uranus', n: 'Neptune', m: 'Moon',
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
      btn.blur();
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
  document.getElementById('btn-history')?.addEventListener('click', () => {
    const open = historyPanel?.toggle();
    document.getElementById('btn-history')?.classList.toggle('active', !!open);
  });

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
    if (conjDetail)  conjDetail.hide();
    _conjTrack = null;
    if (controls)    controls.minDistance = EARTH_RADIUS_UNITS * 1.002;
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

  document.getElementById('btn-pot')?.addEventListener('click', () => {
    if (powersOfTen?.isActive()) { powersOfTen.stop(); }
    else { closeInfoPanels(); powersOfTen?.start(); }
  });

  document.getElementById('btn-operator')?.addEventListener('click', () => {
    const visible = operatorPanel?.toggle();
    visible ? sounds?.open() : sounds?.close();
    setHudToggle('btn-operator', visible ?? false);
  });

  document.getElementById('btn-mission')?.addEventListener('click', () => {
    const visible = missionSandbox?.toggle();
    setHudToggle('btn-mission', visible ?? false);
  });

  document.getElementById('btn-report')?.addEventListener('click', triggerReport);

  document.getElementById('btn-share')?.addEventListener('click', () => {

    const selection = {};

    if (selectedSatIdx >= 0 && satelliteLayer) {
      const tle = satelliteLayer.getTLE(selectedSatIdx);
      if (tle?.norad) selection.satNorad = tle.norad;
    }

    if (selectedDso) {
      selection.dsoId = selectedDso.id;
      if (GALAXIES.some(d => d === selectedDso))    selection.dsoCat = 'galaxy';
      else if (BLACK_HOLES.some(d => d === selectedDso)) selection.dsoCat = 'blackhole';
      else if (NEBULAE.some(d => d === selectedDso)) selection.dsoCat = 'nebula';
    }

    if (followPlanet?.userData?.planetDef) {
      selection.planet = followPlanet.userData.planetDef.name;
    } else if (sunHealthPanel?.isVisible()) {
      selection.planet = 'Sun';
    }

    if (hudTimeActive) selection.timePanel = true;

    const hash = encodeState({
      camPos:    camera.position,
      camTarget: controls.target,
      simTime,
      speedIndex,
      layers: {
        stars:          hudStarsActive,
        orbits:         hudOrbitActive,
        constellations: hudConstActive,
        satellites:     hudSatsActive,
        debris:         hudDebrisActive,
        asteroids:      hudAstActive,
        risk:           hudRiskActive,
        heat:           hudHeatActive,
        interstellar:   hudIntlActive,
        weather:        hudWeatherActive,
      },
      selection,
    });
    writeState(hash);
    navigator.clipboard?.writeText(location.href).catch(() => {});
    const btn = document.getElementById('btn-share');
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = '✓ COPIED';
      btn.classList.add('active');
      setTimeout(() => { btn.textContent = orig; btn.classList.remove('active'); }, 1800);
    }
  });

  document.getElementById('btn-speed-down')?.addEventListener('click', () => {
    speedIndex = Math.max(speedIndex - 1, 0);
    updateSpeedHUD();
  });
  document.getElementById('btn-speed-up')?.addEventListener('click', () => {
    speedIndex = Math.min(speedIndex + 1, TIME_SPEEDS.length - 1);
    updateSpeedHUD();
  });

  const cmdPalette = document.getElementById('cmd-palette');
  const cmdInput   = document.getElementById('cmd-input');
  const cmdList    = document.getElementById('cmd-list');
  const cmdBtn     = document.getElementById('btn-command');

  const PLANET_MAP_CMD = {
    Mercury: 'q', Venus: 'v', Mars: 'r',
    Jupiter: 'j', Saturn: 't', Uranus: 'u', Neptune: 'n', Moon: 'm',
  };

  function cmdFlyToPlanet(name) {
    const found = solarSystem?.getMeshes().find(m => m.def.name === name);
    if (!found) return;
    closeInfoPanels();
    planetPanel?.show(found.def, found.mesh);
    flyToPlanet(found.mesh);
  }

  const CMD_LIST = [
    { cat: 'nav',    label: 'Earth',            key: 'E', action: () => backToEarth() },
    { cat: 'nav',    label: 'Sun',               key: 'S', action: () => { closeInfoPanels(); flyToSun(); sunHealthPanel?.show(); } },
    { cat: 'nav',    label: 'Mercury',           key: 'Q', action: () => cmdFlyToPlanet('Mercury') },
    { cat: 'nav',    label: 'Venus',             key: 'V', action: () => cmdFlyToPlanet('Venus') },
    { cat: 'nav',    label: 'Mars',              key: 'R', action: () => cmdFlyToPlanet('Mars') },
    { cat: 'nav',    label: 'Jupiter',           key: 'J', action: () => cmdFlyToPlanet('Jupiter') },
    { cat: 'nav',    label: 'Saturn',            key: 'T', action: () => cmdFlyToPlanet('Saturn') },
    { cat: 'nav',    label: 'Uranus',            key: 'U', action: () => cmdFlyToPlanet('Uranus') },
    { cat: 'nav',    label: 'Neptune',           key: 'N', action: () => cmdFlyToPlanet('Neptune') },
    { cat: 'nav',    label: 'Moon',              key: 'M', action: () => cmdFlyToPlanet('Moon') },
    { cat: 'nav',    label: 'LEO preset',        key: '1', action: () => window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true })) },
    { cat: 'nav',    label: 'GEO preset',        key: '2', action: () => window.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true })) },
    { cat: 'nav',    label: 'Lunar preset',      key: '3', action: () => window.dispatchEvent(new KeyboardEvent('keydown', { key: '3', bubbles: true })) },
    { cat: 'nav',    label: 'Solar preset',      key: '4', action: () => window.dispatchEvent(new KeyboardEvent('keydown', { key: '4', bubbles: true })) },
    { cat: 'nav',    label: 'Stars preset',      key: '5', action: () => window.dispatchEvent(new KeyboardEvent('keydown', { key: '5', bubbles: true })) },
    { cat: 'nav',    label: 'Outer preset',      key: '6', action: () => window.dispatchEvent(new KeyboardEvent('keydown', { key: '6', bubbles: true })) },
    { cat: 'toggle', label: 'Stars',             key: 'F', action: () => toggleStars() },
    { cat: 'toggle', label: 'Orbit rings',       key: 'O', action: () => document.getElementById('btn-orbits')?.click() },
    { cat: 'toggle', label: 'Constellations',    key: 'C', action: () => document.getElementById('btn-constellations')?.click() },
    { cat: 'toggle', label: 'Satellites',        key: 'A', action: () => toggleSats() },
    { cat: 'toggle', label: 'Debris',            key: 'D', action: () => toggleDebris() },
    { cat: 'toggle', label: 'Asteroid belt',     key: 'B', action: () => document.getElementById('btn-asteroids')?.click() },
    { cat: 'toggle', label: 'Space weather',     key: 'W', action: () => toggleWeather() },
    { cat: 'toggle', label: 'Conjunction risk',  key: 'G', action: () => toggleRisk() },
    { cat: 'toggle', label: 'Debris density',    key: 'H', action: () => document.getElementById('btn-heat')?.click() },
    { cat: 'toggle', label: 'Deep space',        key: 'Y', action: () => toggleIntl() },
    { cat: 'toggle', label: 'Explorer',          key: 'I', action: () => toggleExplorer() },
    { cat: 'toggle', label: 'History',           key: 'K', action: () => document.getElementById('btn-history')?.click() },
    { cat: 'open',   label: 'Fleet Monitor',     key: 'L', action: () => document.getElementById('btn-operator')?.click() },
    { cat: 'open',   label: 'Mission Sandbox',   key: 'Z', action: () => document.getElementById('btn-mission')?.click() },
    { cat: 'open',   label: 'Cinematic zoom',    key: 'P', action: () => document.getElementById('btn-pot')?.click() },
    { cat: 'open',   label: 'Search satellite',  key: '/', action: () => { closeCmdPalette(); search?.open(); } },
    { cat: 'open',   label: 'Generate report',   key: '',  action: () => { closeCmdPalette(); triggerReport(); } },
    { cat: 'open',   label: 'Controls guide',    key: '?', action: () => document.getElementById('btn-help')?.click() },
  ];

  const CAT_CLASS = { nav: 'cmd-cat-nav', toggle: 'cmd-cat-toggle', open: 'cmd-cat-open' };
  const CAT_LABEL = { nav: 'Navigate', toggle: 'Toggle', open: 'Open' };

  let _cmdOpen = false;
  let _cmdHi   = 0;
  let _cmdFiltered = CMD_LIST;

  function openCmdPalette() {
    if (!cmdPalette) return;
    _cmdOpen = true;
    cmdPalette.classList.remove('hidden');
    cmdBtn?.classList.add('cmd-open');
    if (cmdInput) { cmdInput.value = ''; cmdInput.focus(); }
    renderCmdItems('');
  }

  function closeCmdPalette() {
    if (!cmdPalette) return;
    _cmdOpen = false;
    cmdPalette.classList.add('hidden');
    cmdBtn?.classList.remove('cmd-open');
    cmdInput?.blur();
  }

  function renderCmdItems(q) {
    const query = q.trim().toLowerCase();
    _cmdFiltered = query
      ? CMD_LIST.filter(c =>
          c.label.toLowerCase().includes(query) ||
          CAT_LABEL[c.cat].toLowerCase().includes(query) ||
          c.key.toLowerCase() === query
        )
      : CMD_LIST;
    _cmdHi = 0;
    buildCmdDOM();
  }

  function buildCmdDOM() {
    if (!cmdList) return;
    cmdList.innerHTML = '';
    _cmdFiltered.slice(0, 9).forEach((cmd, i) => {
      const el = document.createElement('div');
      el.className = 'cmd-item' + (i === _cmdHi ? ' cmd-item--active' : '');
      el.innerHTML = `<span class="cmd-cat ${CAT_CLASS[cmd.cat]}">${CAT_LABEL[cmd.cat]}</span>`
                   + `<span class="cmd-label">${cmd.label}</span>`
                   + (cmd.key ? `<span class="cmd-key">${cmd.key}</span>` : '');
      el.addEventListener('mousedown', e => { e.preventDefault(); closeCmdPalette(); cmd.action(); });
      el.addEventListener('mouseover', () => { _cmdHi = i; buildCmdDOM(); });
      cmdList.appendChild(el);
    });
  }

  cmdBtn?.addEventListener('click', () => { _cmdOpen ? closeCmdPalette() : openCmdPalette(); });

  cmdInput?.addEventListener('input',   e => renderCmdItems(e.target.value));
  cmdInput?.addEventListener('keydown', e => {
    if (e.key === 'Escape')    { closeCmdPalette(); e.stopPropagation(); return; }
    if (e.key === 'ArrowDown') { _cmdHi = Math.min(_cmdHi + 1, Math.min(_cmdFiltered.length, 9) - 1); buildCmdDOM(); e.preventDefault(); return; }
    if (e.key === 'ArrowUp')   { _cmdHi = Math.max(_cmdHi - 1, 0); buildCmdDOM(); e.preventDefault(); return; }
    if (e.key === 'Enter') {
      const cmd = _cmdFiltered[_cmdHi];
      if (cmd) { closeCmdPalette(); cmd.action(); }
      e.preventDefault(); return;
    }
    e.stopPropagation();
  });

  document.addEventListener('click', e => {
    if (_cmdOpen && !cmdPalette?.contains(e.target) && e.target?.id !== 'btn-command') {
      closeCmdPalette();
    }
  });

  window._closeCmdPalette = closeCmdPalette;
  window._openCmdPalette  = openCmdPalette;
}

function closeInfoPanels() {
  satPanel?.hide();
  if (selectedSatIdx !== -1) {
    satelliteLayer?.setSelected(-1);
    selectedSatIdx = -1;
    document.getElementById('sat-reticle')?.classList.add('hidden');
  }
  planetPanel?.hide();
  sunHealthPanel?.hide();
  sunLayer?.hideHologram();
  galaxyLayer?.hidePanel();
  constellationPanel?.hide();
  constellations?.highlight(null);
  starPanel?.hide();
  selectedDso = null;
  _dsoReticleEl?.classList.add('hidden');
  operatorPanel?.hide();
  setHudToggle('btn-operator', false);
  missionSandbox?.hide();
  setHudToggle('btn-mission', false);
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
  if (_timePaused) return '⏸ PAUSED';
  const speed = TIME_SPEEDS[speedIndex];
  return speed < 0 ? `${speed}×` : `+${speed}×`;
}

function setHudToggle(id, active) {
  const btn = document.getElementById(id);
  if (btn) btn.classList.toggle('active', active);

  const DOT_MAP = {
    'btn-starfield':      ['dot-stars',   'dot-cyan'],
    'btn-satellites':     ['dot-sats',    'dot-cyan'],
    'btn-debris':         ['dot-debris',  'dot-red'],
    'btn-risk':           ['dot-risk',    'dot-red'],
    'btn-orbits':         ['dot-orbits',  'dot-cyan'],
    'btn-weather':        ['dot-weather', 'dot-green'],
    'btn-constellations': ['dot-const',   'dot-cyan'],
    'btn-asteroids':      ['dot-belt',    'dot-amber'],
  };
  const entry = DOT_MAP[id];
  if (entry) {
    const dot = document.getElementById(entry[0]);
    if (dot) {
      dot.classList.remove('dot-cyan', 'dot-red', 'dot-amber', 'dot-green');
      if (active) dot.classList.add(entry[1]);
    }
  }
}

function applyUrlState(state, phase) {
  if (!state) return;

  if (phase === 'camera') {

    camera.position.set(state.camPos.x, state.camPos.y, state.camPos.z);
    controls.target.set(state.camTarget.x, state.camTarget.y, state.camTarget.z);
    controls.update();

    if (state.simTime !== null) simTime = state.simTime;
    if (state.speedIndex !== null && state.speedIndex >= 0 && state.speedIndex < TIME_SPEEDS.length) {
      speedIndex = state.speedIndex;
      updateSpeedHUD();
    }

    if (state.layers) {
      const l = state.layers;
      if (l.stars !== undefined && l.stars !== hudStarsActive) toggleStars();
      if (l.constellations !== undefined && l.constellations !== hudConstActive) {
        if (constellations) constellations.toggle();
        hudConstActive = l.constellations;
        setHudToggle('btn-constellations', hudConstActive);
      }
    }

    if (state.planet) {
      if (state.planet === 'Sun') {
        sunLayer?.showPanel();
      } else if (solarSystem) {
        const found = solarSystem.getMeshes().find(m => m.def.name === state.planet);
        if (found) {
          planetPanel?.show(found.def, found.mesh);
          followPlanet = found.mesh;
          if (navigation) navigation.setFocusPlanet(found.mesh);
        }
      }
    }

    if (state.dsoId && state.dsoCat && galaxyLayer) {
      let dso = null;
      if (state.dsoCat === 'galaxy')    dso = GALAXIES.find(d => d.id === state.dsoId);
      if (state.dsoCat === 'blackhole') dso = BLACK_HOLES.find(d => d.id === state.dsoId);
      if (state.dsoCat === 'nebula')    dso = NEBULAE.find(d => d.id === state.dsoId);
      if (dso) {
        selectedDso = dso;
        galaxyLayer.showPanel(dso);
        const lbl = document.getElementById('dso-reticle-label');
        if (lbl) lbl.textContent = dso.name.toUpperCase();
        if (_dsoReticleEl) _dsoReticleEl.classList.remove('hidden');
      }
    }

    if (state.timePanel && !hudTimeActive) toggleTime();
  }

  if (phase === 'layers') {

    if (state.layers) {
      const l = state.layers;
      if (l.satellites   !== undefined && l.satellites   !== hudSatsActive)   toggleSats();
      if (l.debris       !== undefined && l.debris       !== hudDebrisActive)  toggleDebris();
      if (l.asteroids    !== undefined && l.asteroids    !== hudAstActive) {
        if (asteroidBelt) asteroidBelt.toggle();
        hudAstActive = l.asteroids;
        setHudToggle('btn-asteroids', hudAstActive);
      }
      if (l.orbits !== undefined && l.orbits !== hudOrbitActive) {
        if (orbitRings) orbitRings.toggle();
        hudOrbitActive = l.orbits;
        setHudToggle('btn-orbits', hudOrbitActive);
      }
      if (l.risk         !== undefined && l.risk         !== hudRiskActive)    toggleRisk();
      if (l.heat         !== undefined && l.heat         !== hudHeatActive)    toggleHeat();
      if (l.interstellar !== undefined && l.interstellar !== hudIntlActive)    toggleIntl();
      if (l.weather      !== undefined && l.weather      !== hudWeatherActive) toggleWeather();
    }

    if (state.satNorad != null && satelliteLayer && satPanel) {
      const idx = tleData.findIndex(t => t.norad === state.satNorad);
      if (idx >= 0) {
        const tle       = satelliteLayer.getTLE(idx);
        const positions = satelliteLayer.getPositions();
        const pos       = new THREE.Vector3(
          positions[idx * 3],
          positions[idx * 3 + 1],
          positions[idx * 3 + 2],
        );
        satelliteLayer.clearLaunchGroup();
        satelliteLayer.setSelected(idx);
        satPanel.show(tle, pos);
        if (trailLayer) { trailLayer.dispose(); trailLayer = null; }
        trailLayer = createTrail(scene, tle);
        selectedSatIdx = idx;
        if (satReticleNameEl) satReticleNameEl.textContent = tle?.name ?? `SAT #${idx}`;
        if (satReticle) satReticle.classList.remove('hidden');
      }
    }
  }
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
  'btn-history':       { title: 'Space History Timeline', key: 'K', desc: 'Timeline of key events from Sputnik to today — launches, debris events, discoveries. Click any debris event for an orbital impact analysis.', combo: 'Click <strong>💥 IMPACT</strong> on any debris event to see which altitude shells were affected.' },
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
  const overlay  = document.getElementById('help-overlay');
  const backdrop = document.getElementById('help-backdrop');
  const closeBtn = document.getElementById('help-close-btn');
  const helpBtn  = document.getElementById('btn-help');
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

  document.getElementById('help-replay-btn')?.addEventListener('click', () => {
    closeHelp();
    setTimeout(() => { window._snReplayOnboarding?.(); }, 150);
  });
})();

(function initAboutOverlay() {
  const overlay   = document.getElementById('about-overlay');
  const backdrop  = document.getElementById('about-backdrop');
  const closeBtn  = document.getElementById('about-close-btn');
  const aboutBtn  = document.getElementById('btn-about');
  if (!overlay) return;

  function openAbout()  { overlay.classList.remove('hidden'); }
  function closeAbout() { overlay.classList.add('hidden'); }

  aboutBtn?.addEventListener('click', openAbout);
  closeBtn?.addEventListener('click', closeAbout);
  backdrop?.addEventListener('click', closeAbout);

  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) closeAbout();
  });

  document.getElementById('about-suggest-btn')?.addEventListener('click', () => {
    window.open('mailto:francomatacarolina@gmail.com?subject=SpaceNavigator%20Suggestion', '_blank');
  });
})();

(function initOnboarding() {
  const STORAGE_KEY = 'sn_onboarded_v2';

  const overlay   = document.getElementById('onboarding');
  const highlight = document.getElementById('ob-highlight');
  const card      = document.getElementById('ob-card');
  const stepsEl   = document.getElementById('ob-steps');
  const titleEl   = document.getElementById('ob-title');
  const bodyEl    = document.getElementById('ob-body');
  const nextBtn   = document.getElementById('ob-next');
  const skipBtn   = document.getElementById('ob-skip');
  if (!overlay) return;

  const STEPS = [
    {
      target:   '#btn-preset-leo',
      title:    'Fly to any planet or orbit',
      body:     'Use the buttons along the bottom bar to fly anywhere instantly — planets, moons, or orbit shells. Try clicking <strong>Earth</strong>, <strong>Saturn</strong>, or <strong>ISS</strong> right now.',
    },
    {
      target:   '#btn-explorer',
      title:    'Explore galaxies & deep sky',
      body:     'Click <strong>Explore</strong> to open the deep-sky browser. Browse galaxies, nebulae, and black holes — click any to fly there and see it up close.',
    },
    {
      target:   null,
      title:    'Click any dot to inspect it',
      body:     'Every glowing dot is a real satellite or debris tracked live. <strong>Click any object</strong> in the scene to see its name, orbit, altitude, and velocity.',
    },
  ];

  let step = 0;

  function buildDots() {
    stepsEl.innerHTML = '';
    STEPS.forEach((_, i) => {
      const d = document.createElement('div');
      d.className = 'ob-dot';
      stepsEl.appendChild(d);
    });
  }

  function positionCard(targetSel) {
    const PAD    = 16;
    const MARGIN = 12;
    const cardW  = 280;
    const cardH  = 180;

    if (!targetSel) {
      highlight.style.display = 'none';
      card.className = 'arrow-none';
      card.style.left = Math.round((window.innerWidth - cardW) / 2) + 'px';
      card.style.top  = Math.round(window.innerHeight * 0.38) + 'px';
      return;
    }

    const el = document.querySelector(targetSel);
    if (!el) {
      highlight.style.display = 'none';
      card.className = 'arrow-none';
      card.style.left = Math.round((window.innerWidth - cardW) / 2) + 'px';
      card.style.top  = Math.round(window.innerHeight * 0.38) + 'px';
      return;
    }

    const r = el.getBoundingClientRect();

    highlight.style.display = 'block';
    highlight.style.left   = r.left   + 'px';
    highlight.style.top    = r.top    + 'px';
    highlight.style.width  = r.width  + 'px';
    highlight.style.height = r.height + 'px';

    const midY    = r.top + r.height / 2;
    const goAbove = midY > window.innerHeight / 2;

    let cardLeft = r.left + r.width / 2 - cardW / 2;
    let cardTop;

    if (goAbove) {
      card.className = 'arrow-down';
      cardTop = r.top - cardH - PAD;
    } else {
      card.className = 'arrow-up';
      cardTop = r.bottom + PAD;
    }

    cardLeft = Math.max(MARGIN, Math.min(cardLeft, window.innerWidth  - cardW - MARGIN));
    cardTop  = Math.max(MARGIN, Math.min(cardTop,  window.innerHeight - cardH - MARGIN));

    card.style.left = cardLeft + 'px';
    card.style.top  = cardTop  + 'px';
  }

  function renderStep(i) {
    const s = STEPS[i];

    const dots = stepsEl.querySelectorAll('.ob-dot');
    dots.forEach((d, idx) => {
      d.classList.toggle('active', idx === i);
      d.classList.toggle('done',   idx < i);
    });
    titleEl.textContent = s.title;
    bodyEl.innerHTML    = s.body;
    nextBtn.textContent = i === STEPS.length - 1 ? 'Get started →' : 'Continue →';
    positionCard(s.target);
  }

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1');
    overlay.classList.add('hidden');
    highlight.style.display = 'none';
  }

  nextBtn?.addEventListener('click', () => {
    if (step < STEPS.length - 1) { step++; renderStep(step); }
    else dismiss();
  });

  skipBtn?.addEventListener('click', dismiss);

  window.addEventListener('resize', () => {
    if (!overlay.classList.contains('hidden')) renderStep(step);
  });

  window._snReplayOnboarding = function() {
    step = 0;
    buildDots();
    renderStep(0);
    overlay.classList.remove('hidden');
  };

  if (!localStorage.getItem(STORAGE_KEY)) {
    setTimeout(() => {
      buildDots();
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
