
import * as THREE from 'three/webgpu';

const CATEGORY_COLOR = {
  station:  [1.000, 1.000, 1.000],
  starlink: [0.310, 0.765, 0.969],
  oneweb:   [0.502, 0.796, 0.769],
  debris:   [0.937, 0.329, 0.314],
  geo:      [0.808, 0.576, 0.847],
  meo:      [0.506, 0.780, 0.518],
  leo:      [0.310, 0.765, 0.969],
};

const PROPAGATE_INTERVAL_MS = 250;

export function createSatellites(scene, tles) {
  const count = tles.length;
  if (count === 0) {
    console.warn('[Satellites] No TLEs provided — layer inactive');
    return {
      update: () => {}, dispose: () => {},
      getPositions: () => new Float32Array(0), getCount: () => 0,
      getTLE: () => null, setSelected: () => {}, setHovered: () => {},
      setVisible: () => {}, setDebrisVisible: () => {}, setSize: () => {},
      isActiveVisible: () => false, isDebrisVisible: () => false,
      setAltitudeBands: () => {}, clearAltitudeBands: () => {},
      setLaunchGroup: () => {}, clearLaunchGroup: () => {},
    };
  }

  const activeIndices = [];
  const debrisIndices = [];
  for (let i = 0; i < count; i++) {
    if (tles[i].category === 'debris') debrisIndices.push(i);
    else                               activeIndices.push(i);
  }

  const activeCount = activeIndices.length;
  const debrisCount = debrisIndices.length;

  const activeSubIndex = new Int32Array(count).fill(-1);
  const debrisSubIndex = new Int32Array(count).fill(-1);
  activeIndices.forEach((gi, ai) => { activeSubIndex[gi] = ai; });
  debrisIndices.forEach((gi, di) => { debrisSubIndex[gi] = di; });

  console.log(`[Satellites] ${activeCount} active  |  ${debrisCount} debris`);

  function _parseLaunchYear(line1) {
    const s = (line1 || '').substring(9, 11).trim();
    if (!s || s === '00') return 0;
    const yr = parseInt(s, 10);
    if (isNaN(yr)) return 0;
    return yr >= 57 ? 1900 + yr : 2000 + yr;
  }
  const activeLaunchYears = new Int16Array(activeCount);
  const debrisLaunchYears = new Int16Array(debrisCount);
  for (let ai = 0; ai < activeCount; ai++) {
    activeLaunchYears[ai] = _parseLaunchYear(tles[activeIndices[ai]].line1);
  }
  for (let di = 0; di < debrisCount; di++) {
    debrisLaunchYears[di] = _parseLaunchYear(tles[debrisIndices[di]].line1);
  }

  const _HIDDEN_X = 9e9;
  let _historicalYear = null;

  const GM_KM3 = 3.986004418e5;
  const satAltKm = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const n = tles[i].meanMotion;
    if (n && n > 0) {
      const n_rad_s  = n * (2 * Math.PI) / 86400;
      const a_km     = Math.cbrt(GM_KM3 / (n_rad_s * n_rad_s));
      satAltKm[i]    = a_km - 6371;
    } else {
      satAltKm[i] = 400;
    }
  }

  const positionArray = new Float32Array(count * 3);

  const activePosArray       = new Float32Array(activeCount * 3);
  const activeColorArray     = new Float32Array(activeCount * 3);
  for (let ai = 0; ai < activeCount; ai++) {
    const gi = activeIndices[ai];
    const c  = CATEGORY_COLOR[tles[gi].category] ?? CATEGORY_COLOR.leo;
    activeColorArray[ai * 3]     = c[0];
    activeColorArray[ai * 3 + 1] = c[1];
    activeColorArray[ai * 3 + 2] = c[2];
  }
  const activeBaseColorArray = new Float32Array(activeColorArray);

  const activeGeo = new THREE.BufferGeometry();
  activeGeo.setAttribute('position', new THREE.BufferAttribute(activePosArray, 3));
  activeGeo.setAttribute('color',    new THREE.BufferAttribute(activeColorArray, 3));

  const _ACTIVE_SIZE  = 4.0;
  const _DEBRIS_SIZE  = 2.5;

  const activeMat = new THREE.PointsNodeMaterial({
    vertexColors:    true,
    size:            _ACTIVE_SIZE,
    transparent:     true,
    opacity:         1.0,
    blending:        THREE.AdditiveBlending,
    depthWrite:      false,
    depthTest:       false,
    sizeAttenuation: false,
  });

  const activePts         = new THREE.Points(activeGeo, activeMat);
  activePts.name          = 'satellites-active';
  activePts.frustumCulled = false;
  scene.add(activePts);

  const debrisPosArray       = new Float32Array(debrisCount * 3);
  const debrisColorArray     = new Float32Array(debrisCount * 3);
  const debrisRgb = CATEGORY_COLOR.debris;
  for (let di = 0; di < debrisCount; di++) {
    debrisColorArray[di * 3]     = debrisRgb[0];
    debrisColorArray[di * 3 + 1] = debrisRgb[1];
    debrisColorArray[di * 3 + 2] = debrisRgb[2];
  }
  const debrisBaseColorArray = new Float32Array(debrisColorArray);

  const debrisGeo = new THREE.BufferGeometry();
  debrisGeo.setAttribute('position', new THREE.BufferAttribute(debrisPosArray, 3));
  debrisGeo.setAttribute('color',    new THREE.BufferAttribute(debrisColorArray, 3));

  const debrisMat = new THREE.PointsNodeMaterial({
    vertexColors:    true,
    size:            _DEBRIS_SIZE,
    transparent:     true,
    opacity:         0.80,
    blending:        THREE.AdditiveBlending,
    depthWrite:      false,
    depthTest:       false,
    sizeAttenuation: false,
  });

  const debrisPts         = new THREE.Points(debrisGeo, debrisMat);
  debrisPts.name          = 'satellites-debris';
  debrisPts.frustumCulled = false;
  scene.add(debrisPts);

  const hlPositionArray = new Float32Array(3);
  const hlGeometry      = new THREE.BufferGeometry();
  hlGeometry.setAttribute('position', new THREE.BufferAttribute(hlPositionArray, 3));

  const hlMaterial = new THREE.PointsNodeMaterial({
    color:           0xFFD700,
    size:            10,
    transparent:     true,
    opacity:         1.0,
    blending:        THREE.AdditiveBlending,
    depthWrite:      false,
    depthTest:       false,
    sizeAttenuation: false,
  });

  const hlPoints      = new THREE.Points(hlGeometry, hlMaterial);
  hlPoints.name       = 'satellite-highlight';
  hlPoints.frustumCulled = false;
  hlPoints.visible    = false;
  scene.add(hlPoints);

  const hvPositionArray = new Float32Array(3);
  const hvGeometry      = new THREE.BufferGeometry();
  hvGeometry.setAttribute('position', new THREE.BufferAttribute(hvPositionArray, 3));

  const hvMaterial = new THREE.PointsNodeMaterial({
    color:           0x00E5FF,
    size:            6,
    transparent:     true,
    opacity:         0.9,
    blending:        THREE.AdditiveBlending,
    depthWrite:      false,
    depthTest:       false,
    sizeAttenuation: false,
  });

  const hvPoints      = new THREE.Points(hvGeometry, hvMaterial);
  hvPoints.name       = 'satellite-hover';
  hvPoints.frustumCulled = false;
  hvPoints.visible    = false;
  scene.add(hvPoints);

  let selectedIndex = -1;
  let hoveredIndex  = -1;

  const worker = new Worker(
    new URL('../workers/propagator.worker.js', import.meta.url),
    { type: 'module' }
  );

  let pendingPositions = null;
  let workerReady      = false;
  let lastPropTime     = 0;

  worker.onmessage = ({ data }) => {
    if (data.type === 'ready') {
      workerReady = true;
      console.log(`[Satellites] Worker ready — ${data.count} satellites`);
    }
    if (data.type === 'positions') {
      pendingPositions = data.positions;
    }
  };

  worker.onerror = (e) => console.error('[Satellites] Worker error:', e.message);

  worker.postMessage({
    type: 'init',
    tles: tles.map(t => ({ line1: t.line1, line2: t.line2 })),
  });

  function update(now, simTime) {
    const wallTime = simTime ?? Date.now();
    if (workerReady && now - lastPropTime >= PROPAGATE_INTERVAL_MS) {
      worker.postMessage({ type: 'propagate', timestamp: wallTime });
      lastPropTime = now;
    }

    if (pendingPositions) {
      positionArray.set(pendingPositions);

      for (let ai = 0; ai < activeCount; ai++) {
        const gi = activeIndices[ai];
        if (_historicalYear !== null && activeLaunchYears[ai] > _historicalYear) {
          activePosArray[ai * 3]     = _HIDDEN_X;
          activePosArray[ai * 3 + 1] = 0;
          activePosArray[ai * 3 + 2] = 0;

          positionArray[gi * 3]     = _HIDDEN_X;
          positionArray[gi * 3 + 1] = 0;
          positionArray[gi * 3 + 2] = 0;
        } else {
          activePosArray[ai * 3]     = pendingPositions[gi * 3];
          activePosArray[ai * 3 + 1] = pendingPositions[gi * 3 + 1];
          activePosArray[ai * 3 + 2] = pendingPositions[gi * 3 + 2];
        }
      }
      activeGeo.attributes.position.needsUpdate = true;

      for (let di = 0; di < debrisCount; di++) {
        const gi = debrisIndices[di];
        if (_historicalYear !== null && debrisLaunchYears[di] > _historicalYear) {
          debrisPosArray[di * 3]     = _HIDDEN_X;
          debrisPosArray[di * 3 + 1] = 0;
          debrisPosArray[di * 3 + 2] = 0;

          positionArray[gi * 3]     = _HIDDEN_X;
          positionArray[gi * 3 + 1] = 0;
          positionArray[gi * 3 + 2] = 0;
        } else {
          debrisPosArray[di * 3]     = pendingPositions[gi * 3];
          debrisPosArray[di * 3 + 1] = pendingPositions[gi * 3 + 1];
          debrisPosArray[di * 3 + 2] = pendingPositions[gi * 3 + 2];
        }
      }
      debrisGeo.attributes.position.needsUpdate = true;

      if (selectedIndex >= 0) {
        hlPositionArray[0] = positionArray[selectedIndex * 3];
        hlPositionArray[1] = positionArray[selectedIndex * 3 + 1];
        hlPositionArray[2] = positionArray[selectedIndex * 3 + 2];
        hlGeometry.attributes.position.needsUpdate = true;
      }
      if (hoveredIndex >= 0) {
        hvPositionArray[0] = positionArray[hoveredIndex * 3];
        hvPositionArray[1] = positionArray[hoveredIndex * 3 + 1];
        hvPositionArray[2] = positionArray[hoveredIndex * 3 + 2];
        hvGeometry.attributes.position.needsUpdate = true;
      }

      pendingPositions = null;
    }
  }

  function _isLayerVisibleForIndex(i) {
    if (i < 0) return false;
    return tles[i].category === 'debris' ? debrisPts.visible : activePts.visible;
  }

  function _isHistoricallyHidden(i) {
    if (i < 0 || _historicalYear === null) return false;
    const ai = activeSubIndex[i];
    if (ai >= 0) return activeLaunchYears[ai] > _historicalYear;
    const di = debrisSubIndex[i];
    if (di >= 0) return debrisLaunchYears[di] > _historicalYear;
    return false;
  }

  function _syncHighlightVisibility() {
    hlPoints.visible = _isLayerVisibleForIndex(selectedIndex);
    hvPoints.visible = _isLayerVisibleForIndex(hoveredIndex);
  }

  function getPositions() {
    return positionArray;
  }

  function getCount() {
    return count;
  }

  function getTLE(i) {
    return tles[i] ?? null;
  }

  function setSelected(i) {
    selectedIndex = i;
    if (i < 0 || _isHistoricallyHidden(i)) {
      hlPoints.visible = false;
      return;
    }
    hlPositionArray[0] = positionArray[i * 3];
    hlPositionArray[1] = positionArray[i * 3 + 1];
    hlPositionArray[2] = positionArray[i * 3 + 2];
    hlGeometry.attributes.position.needsUpdate = true;
    hlPoints.visible = _isLayerVisibleForIndex(i);
  }

  function setHovered(i) {
    hoveredIndex = i;
    if (i < 0 || _isHistoricallyHidden(i)) {
      hvPoints.visible = false;
      return;
    }
    hvPositionArray[0] = positionArray[i * 3];
    hvPositionArray[1] = positionArray[i * 3 + 1];
    hvPositionArray[2] = positionArray[i * 3 + 2];
    hvGeometry.attributes.position.needsUpdate = true;
    hvPoints.visible = _isLayerVisibleForIndex(i);
  }

  function setSize(px) {
    activeMat.size        = px;
    activeMat.needsUpdate = true;
    debrisMat.size        = px * 0.60;
    debrisMat.needsUpdate = true;
  }

  function setVisible(v) {
    activePts.visible = v;
    _syncHighlightVisibility();
  }

  function setDebrisVisible(v) {
    debrisPts.visible = v;
    _syncHighlightVisibility();
  }

  function isActiveVisible() { return activePts.visible; }

  function isDebrisVisible()  { return debrisPts.visible; }

  function setHistoricalOpacity(fraction) {
    const f = Math.max(0.04, Math.min(1.0, fraction));
    activeMat.opacity = 1.0 * f;
    debrisMat.opacity = 0.80 * f;
    activeMat.needsUpdate = true;
    debrisMat.needsUpdate = true;
  }

  function setHistoricalYear(year) {
    _historicalYear = (year !== null && year !== undefined) ? year : null;
  }

  function clearHistoricalYear() {
    _historicalYear = null;
  }

  let _altBands    = [];
  let _launchNorads = null;
  let _dragRiskMap  = null;

  function setAltitudeBands(bands) {
    _altBands = bands ?? [];
    _rebuildAltHighlight();
  }

  function clearAltitudeBands() {
    _altBands = [];
    _launchNorads = null;
    _restoreBaseColors();
  }

  function _restoreBaseColors() {
    activeColorArray.set(activeBaseColorArray);
    activeGeo.attributes.color.needsUpdate = true;
    debrisColorArray.set(debrisBaseColorArray);
    debrisGeo.attributes.color.needsUpdate = true;
  }

  function _rebuildAltHighlight() {
    if (_altBands.length === 0) {
      _restoreBaseColors();
      return;
    }
    for (let ai = 0; ai < activeCount; ai++) {
      const gi     = activeIndices[ai];
      const h      = satAltKm[gi];
      const inBand = _altBands.some(b => h >= b.low && h < b.high);
      const vi     = ai * 3;
      if (inBand) {
        activeColorArray[vi]     = Math.min(1, activeBaseColorArray[vi]     * 2.2);
        activeColorArray[vi + 1] = Math.min(1, activeBaseColorArray[vi + 1] * 2.2);
        activeColorArray[vi + 2] = Math.min(1, activeBaseColorArray[vi + 2] * 2.2);
      } else {
        activeColorArray[vi]     = activeBaseColorArray[vi]     * 0.04;
        activeColorArray[vi + 1] = activeBaseColorArray[vi + 1] * 0.04;
        activeColorArray[vi + 2] = activeBaseColorArray[vi + 2] * 0.04;
      }
    }
    activeGeo.attributes.color.needsUpdate = true;
    for (let di = 0; di < debrisCount; di++) {
      const gi     = debrisIndices[di];
      const h      = satAltKm[gi];
      const inBand = _altBands.some(b => h >= b.low && h < b.high);
      const vi     = di * 3;
      if (inBand) {
        debrisColorArray[vi]     = Math.min(1, debrisBaseColorArray[vi]     * 2.2);
        debrisColorArray[vi + 1] = Math.min(1, debrisBaseColorArray[vi + 1] * 2.2);
        debrisColorArray[vi + 2] = Math.min(1, debrisBaseColorArray[vi + 2] * 2.2);
      } else {
        debrisColorArray[vi]     = debrisBaseColorArray[vi]     * 0.04;
        debrisColorArray[vi + 1] = debrisBaseColorArray[vi + 1] * 0.04;
        debrisColorArray[vi + 2] = debrisBaseColorArray[vi + 2] * 0.04;
      }
    }
    debrisGeo.attributes.color.needsUpdate = true;
  }

  function setLaunchGroup(noradSet) {
    _launchNorads = noradSet;
    _altBands = [];
    _rebuildLaunchHighlight();
  }

  function clearLaunchGroup() {
    _launchNorads = null;
    _restoreBaseColors();
  }

  function _rebuildLaunchHighlight() {
    if (!_launchNorads || _launchNorads.size === 0) {
      _restoreBaseColors();
      return;
    }
    for (let ai = 0; ai < activeCount; ai++) {
      const gi      = activeIndices[ai];
      const inGroup = _launchNorads.has(tles[gi].norad);
      const vi      = ai * 3;
      if (inGroup) {
        activeColorArray[vi]     = Math.min(1, activeBaseColorArray[vi]     * 2.2);
        activeColorArray[vi + 1] = Math.min(1, activeBaseColorArray[vi + 1] * 2.2);
        activeColorArray[vi + 2] = Math.min(1, activeBaseColorArray[vi + 2] * 2.2);
      } else {

        activeColorArray[vi]     = 0;
        activeColorArray[vi + 1] = 0;
        activeColorArray[vi + 2] = 0;
      }
    }
    activeGeo.attributes.color.needsUpdate = true;
    for (let di = 0; di < debrisCount; di++) {
      const gi      = debrisIndices[di];
      const inGroup = _launchNorads.has(tles[gi].norad);
      const vi      = di * 3;
      if (inGroup) {
        debrisColorArray[vi]     = Math.min(1, debrisBaseColorArray[vi]     * 2.2);
        debrisColorArray[vi + 1] = Math.min(1, debrisBaseColorArray[vi + 1] * 2.2);
        debrisColorArray[vi + 2] = Math.min(1, debrisBaseColorArray[vi + 2] * 2.2);
      } else {

        debrisColorArray[vi]     = 0;
        debrisColorArray[vi + 1] = 0;
        debrisColorArray[vi + 2] = 0;
      }
    }
    debrisGeo.attributes.color.needsUpdate = true;
  }

  const RISK_RGB = {
    elevated: [1.000, 0.792, 0.157],
    high:     [1.000, 0.427, 0.000],
    extreme:  [1.000, 0.090, 0.267],
  };

  function setDragRisk(riskMap) {
    _dragRiskMap = riskMap;
    _rebuildDragRisk();
  }

  function clearDragRisk() {
    _dragRiskMap = null;
    _restoreBaseColors();
  }

  function _rebuildDragRisk() {
    if (!_dragRiskMap || _dragRiskMap.size === 0) {
      _restoreBaseColors();
      return;
    }

    for (let ai = 0; ai < activeCount; ai++) {
      const gi    = activeIndices[ai];
      const level = _dragRiskMap.get(gi);
      const vi    = ai * 3;
      if (level && RISK_RGB[level]) {
        const rgb = RISK_RGB[level];
        activeColorArray[vi]     = rgb[0];
        activeColorArray[vi + 1] = rgb[1];
        activeColorArray[vi + 2] = rgb[2];
      } else {
        activeColorArray[vi]     = activeBaseColorArray[vi];
        activeColorArray[vi + 1] = activeBaseColorArray[vi + 1];
        activeColorArray[vi + 2] = activeBaseColorArray[vi + 2];
      }
    }
    activeGeo.attributes.color.needsUpdate = true;

    for (let di = 0; di < debrisCount; di++) {
      const gi    = debrisIndices[di];
      const level = _dragRiskMap.get(gi);
      const vi    = di * 3;
      if (level && RISK_RGB[level]) {
        const rgb = RISK_RGB[level];
        debrisColorArray[vi]     = rgb[0];
        debrisColorArray[vi + 1] = rgb[1];
        debrisColorArray[vi + 2] = rgb[2];
      } else {
        debrisColorArray[vi]     = debrisBaseColorArray[vi];
        debrisColorArray[vi + 1] = debrisBaseColorArray[vi + 1];
        debrisColorArray[vi + 2] = debrisBaseColorArray[vi + 2];
      }
    }
    debrisGeo.attributes.color.needsUpdate = true;
  }

  function dispose() {
    worker.terminate();
    activeGeo.dispose();  activeMat.dispose();  scene.remove(activePts);
    debrisGeo.dispose();  debrisMat.dispose();  scene.remove(debrisPts);
    hlGeometry.dispose(); hlMaterial.dispose(); scene.remove(hlPoints);
    hvGeometry.dispose(); hvMaterial.dispose(); scene.remove(hvPoints);
  }

  console.log(`[Satellites] Layer created — ${activeCount} active, ${debrisCount} debris`);
  return {
    update, dispose,
    getPositions, getCount, getTLE,
    setSelected, setHovered,
    setVisible, setDebrisVisible, isActiveVisible, isDebrisVisible,
    setHistoricalOpacity,
    setHistoricalYear, clearHistoricalYear,
    setSize,
    setAltitudeBands, clearAltitudeBands,
    setLaunchGroup, clearLaunchGroup,
    setDragRisk, clearDragRisk,
  };
}
