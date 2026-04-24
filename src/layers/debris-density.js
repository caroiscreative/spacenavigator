
import * as THREE from 'three/webgpu';
import { analyzeDensity } from '../data/debris-analysis.js';

const SCALE_KM = 500;
const R_EARTH  = 6371;   // km

const BASE_OPACITY_MIN = 0.02;
const BASE_OPACITY_MAX = 0.16;

function heatColor(t) {
  return new THREE.Color().setHSL(0.65 - t * 0.65, 1.0, 0.50 + t * 0.10);
}

export function createDebrisDensity(scene, tles) {
  const bins = analyzeDensity(tles);
  if (bins.length === 0) {
    console.warn('[DebrisDensity] No bins — TLE catalog empty?');
    return {
      update: () => {}, setVisible: () => {}, toggle: () => false,
      isVisible: () => false, pick: () => null, clickShell: () => null,
      getSelectedBins: () => [], getBins: () => [], toggleBinByIndex: () => {},
      clearSelection: () => {}, dispose: () => {},
    };
  }

  const maxCount = Math.max(...bins.map(b => b.count));
  console.log(`[DebrisDensity] ${bins.length} non-empty bands, peak ${maxCount} objects`);

  const shellMeshes = [];   // visible wireframe shells
  const hitMeshes   = [];   // invisible solid spheres for raycasting
  const binData     = [];   // parallel metadata for tooltip + selection

  const hitMat = new THREE.MeshBasicMaterial({ visible: false });

  for (const bin of bins) {
    const t       = bin.count / maxCount;
    const r_km    = R_EARTH + bin.mid;
    const r       = r_km / SCALE_KM;
    const color   = heatColor(t);
    const opacity = BASE_OPACITY_MIN + t * (BASE_OPACITY_MAX - BASE_OPACITY_MIN);

    const segs = t > 0.7 ? 32 : t > 0.3 ? 24 : 16;
    const geo  = new THREE.SphereGeometry(r, segs, Math.ceil(segs / 2));
    const mat  = new THREE.MeshBasicMaterial({
      color,
      wireframe:   true,
      transparent: true,
      opacity,
      blending:    THREE.AdditiveBlending,
      depthWrite:  false,
      depthTest:   false,  // always visible over Earth — visualization overlay style
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.visible = false;   // hidden until user activates (H key / H HEAT)
    scene.add(mesh);
    shellMeshes.push(mesh);

    const hitGeo  = new THREE.SphereGeometry(r, 12, 6);
    const hitMesh = new THREE.Mesh(hitGeo, hitMat);
    hitMesh.frustumCulled = false;
    hitMesh.visible = false;
    scene.add(hitMesh);
    hitMeshes.push(hitMesh);

    binData.push({ ...bin, color, t });
  }

  const selectedBins = new Set();   // indices of selected shells

  function _dispatchSelection() {
    window.dispatchEvent(new CustomEvent('density-band-select', {
      detail: getSelectedBins(),
    }));
  }

  function _applyOpacities(breathe = 1) {
    const hasSelection = selectedBins.size > 0;
    for (let i = 0; i < shellMeshes.length; i++) {
      const base       = BASE_OPACITY_MIN + binData[i].t * (BASE_OPACITY_MAX - BASE_OPACITY_MIN);
      const isSelected = selectedBins.has(i);

      let opacity;
      if (!hasSelection) {
        opacity = base * breathe;
      } else if (isSelected) {
        opacity = Math.min(0.85, base * 5.0);
      } else {
        opacity = base * 0.06;
      }
      shellMeshes[i].material.opacity = opacity;
    }
  }

  const raycaster = new THREE.Raycaster();

  function pick(ndc, camera) {
    if (!visible) return null;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(hitMeshes, false);
    if (hits.length === 0) return null;
    const idx = hitMeshes.indexOf(hits[0].object);
    return idx >= 0 ? binData[idx] : null;
  }

  function clickShell(ndc, camera) {
    if (!visible) return null;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(hitMeshes, false);
    if (hits.length === 0) return null;
    const idx = hitMeshes.indexOf(hits[0].object);
    if (idx < 0) return null;

    if (selectedBins.has(idx)) {
      selectedBins.delete(idx);
    } else {
      selectedBins.add(idx);
    }
    _applyOpacities();
    _dispatchSelection();
    return binData[idx];
  }

  function getSelectedBins() {
    return Array.from(selectedBins).map(i => binData[i]);
  }

  function getBins() {
    return binData.map((b, i) => ({ ...b, idx: i, selected: selectedBins.has(i) }));
  }

  function toggleBinByIndex(idx) {
    if (idx < 0 || idx >= binData.length) return;
    if (selectedBins.has(idx)) {
      selectedBins.delete(idx);
    } else {
      selectedBins.add(idx);
    }
    _applyOpacities();
    _dispatchSelection();
  }

  function clearSelection() {
    selectedBins.clear();
    _applyOpacities();
    _dispatchSelection();
  }

  let visible = false;

  function setVisible(vis) {
    visible = vis;
    shellMeshes.forEach(m => { m.visible = vis; });
    hitMeshes.forEach(m   => { m.visible = vis; });
    if (!vis) {
      selectedBins.clear();
      _dispatchSelection();
    }
  }

  function toggle() { setVisible(!visible); return visible; }
  function isVisible() { return visible; }

  let _lastBreathTime = 0;
  function update(now) {
    if (!visible) return;
    if (now - _lastBreathTime < 50) return;   // max 20fps — enough for a slow breathe
    _lastBreathTime = now;
    const breathe = 0.92 + 0.08 * Math.sin(now * 0.0002);
    _applyOpacities(breathe);
  }

  function dispose() {
    shellMeshes.forEach(m => { m.geometry.dispose(); m.material.dispose(); scene.remove(m); });
    hitMeshes.forEach(m   => { m.geometry.dispose(); scene.remove(m); });
    hitMat.dispose();
  }

  return { update, setVisible, toggle, isVisible, pick, clickShell, getSelectedBins, getBins, toggleBinByIndex, clearSelection, dispose };
}
