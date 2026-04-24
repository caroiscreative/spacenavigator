
import * as THREE from 'three/webgpu';

const MAX_PAIRS         = 20;
const SCAN_INTERVAL_MS  = 15_000;

const GM_SCENE = 3.986e5 / (500 * 500 * 500);   // ≈ 3.189e-3

const TRAJ_SECONDS = 60;

const TCA_MAX_SECONDS = 7_200;   // 2 hours

const RISK_RGB = {
  critical: [1.000, 0.090, 0.267],   // #FF1744
  warning:  [1.000, 0.427, 0.000],   // #FF6D00
  caution:  [1.000, 0.839, 0.000],   // #FFD600
};

function approxVelocity(px, py, pz) {
  const r      = Math.sqrt(px * px + py * py + pz * pz);
  if (r < 1e-6) return [0, 0, 0];
  const speed  = Math.sqrt(GM_SCENE / r);          // scene units/s
  const eqLen  = Math.sqrt(pz * pz + px * px);
  if (eqLen < 1e-6) return [0, 0, 0];
  return [-pz / eqLen * speed, 0, px / eqLen * speed];
}

export function createRiskOverlay(scene, satelliteLayer) {

  function makeLines(maxSegs, name, opacity, depthTest = false) {
    const pos = new Float32Array(maxSegs * 2 * 3);
    const col = new Float32Array(maxSegs * 2 * 3);
    const geo = new THREE.BufferGeometry();
    const pa  = new THREE.BufferAttribute(pos, 3);
    const ca  = new THREE.BufferAttribute(col, 3);
    pa.setUsage(THREE.DynamicDrawUsage);
    ca.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', pa);
    geo.setAttribute('color',    ca);
    geo.setDrawRange(0, 0);
    const mat = new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest,
    });
    const mesh = new THREE.LineSegments(geo, mat);
    mesh.name = name; mesh.frustumCulled = false; mesh.visible = false;
    scene.add(mesh);
    return { mesh, geo, mat, pos, col, posAttr: pa, colAttr: ca };
  }

  function makePoints(maxPts, name, color, size) {
    const pos = new Float32Array(maxPts * 3);
    const geo = new THREE.BufferGeometry();
    const pa  = new THREE.BufferAttribute(pos, 3);
    pa.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', pa);
    geo.setDrawRange(0, 0);
    const mat = new THREE.PointsMaterial({
      color, size, sizeAttenuation: false, transparent: true, opacity: 1.0,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    });
    const mesh = new THREE.Points(geo, mat);
    mesh.name = name; mesh.frustumCulled = false; mesh.visible = false;
    scene.add(mesh);
    return { mesh, geo, mat, pos, posAttr: pa };
  }

  const connLines = makeLines(MAX_PAIRS, 'risk-conn-lines', 1.0);

  const satDots = (() => {
    const maxPts = MAX_PAIRS * 2;
    const pos = new Float32Array(maxPts * 3);
    const col = new Float32Array(maxPts * 3);
    const geo = new THREE.BufferGeometry();
    const pa  = new THREE.BufferAttribute(pos, 3);
    const ca  = new THREE.BufferAttribute(col, 3);
    pa.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', pa);
    geo.setAttribute('color',    ca);   // BufferAttribute, not the raw Float32Array
    geo.setDrawRange(0, 0);
    const mat = new THREE.PointsMaterial({
      vertexColors: true, size: 6, sizeAttenuation: false,
      transparent: true, opacity: 1.0,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    });
    const mesh = new THREE.Points(geo, mat);
    mesh.name = 'risk-sat-dots'; mesh.frustumCulled = false; mesh.visible = false;
    scene.add(mesh);
    return { mesh, geo, mat, pos, col, posAttr: pa, colAttr: ca };
  })();

  const trajLines = makeLines(MAX_PAIRS * 2, 'risk-traj-lines', 0.55);

  const tcaDots = makePoints(MAX_PAIRS, 'risk-tca-dots', 0xFFFFFF, 8);

  let visible          = false;
  let lastScanTime     = -SCAN_INTERVAL_MS;
  let currentConj      = [];
  let _totalFound      = 0;
  let _skippedColocated = 0;

  const worker = new Worker(
    new URL('../workers/conjunction.worker.js', import.meta.url),
    { type: 'module' }
  );

  worker.onmessage = ({ data }) => {
    if (data.type !== 'results') return;
    currentConj       = data.conjunctions;
    _totalFound       = data.totalFound;
    _skippedColocated = data.skippedColocated;
    rebuildColors();
    console.log(`[RiskOverlay] ${currentConj.length} shown, ${_totalFound} total, ${_skippedColocated} co-located skipped`);
  };

  worker.onerror = (e) => console.error('[RiskOverlay] Worker error:', e.message);

  function rebuildColors() {
    const n = Math.min(currentConj.length, MAX_PAIRS);

    for (let i = 0; i < n; i++) {
      const rgb = RISK_RGB[currentConj[i].risk] ?? RISK_RGB.caution;
      const vi  = i * 6;
      connLines.col[vi]   = connLines.col[vi+3] = rgb[0];
      connLines.col[vi+1] = connLines.col[vi+4] = rgb[1];
      connLines.col[vi+2] = connLines.col[vi+5] = rgb[2];
    }
    connLines.colAttr.needsUpdate = true;
    connLines.geo.setDrawRange(0, n * 2);

    for (let i = 0; i < n; i++) {
      const rgb  = RISK_RGB[currentConj[i].risk] ?? RISK_RGB.caution;
      const viA  = (i * 2)     * 3;
      const viB  = (i * 2 + 1) * 3;
      satDots.col[viA]   = satDots.col[viB]   = rgb[0];
      satDots.col[viA+1] = satDots.col[viB+1] = rgb[1];
      satDots.col[viA+2] = satDots.col[viB+2] = rgb[2];
    }
    satDots.colAttr.needsUpdate = true;
    satDots.geo.setDrawRange(0, n * 2);

    for (let i = 0; i < n; i++) {
      const rgb = RISK_RGB[currentConj[i].risk] ?? RISK_RGB.caution;
      const dimR = rgb[0] * 0.6, dimG = rgb[1] * 0.6, dimB = rgb[2] * 0.6;
      const viA = (i * 2)     * 6;
      const viB = (i * 2 + 1) * 6;
      for (let v = 0; v < 6; v += 3) {
        trajLines.col[viA + v] = trajLines.col[viB + v] = dimR;
        trajLines.col[viA+v+1] = trajLines.col[viB+v+1] = dimG;
        trajLines.col[viA+v+2] = trajLines.col[viB+v+2] = dimB;
      }
    }
    trajLines.colAttr.needsUpdate = true;
    trajLines.geo.setDrawRange(0, n * 2 * 2);   // n pairs × 2 sats × 2 vertices

    tcaDots.geo.setDrawRange(0, n);
  }

  function triggerScan(now) {
    lastScanTime = now;
    if (!satelliteLayer) return;
    const positions = satelliteLayer.getPositions();
    const count     = satelliteLayer.getCount();
    const tles      = [];
    for (let i = 0; i < count; i++) {
      const t = satelliteLayer.getTLE(i);
      tles.push({ name: t?.name ?? `#${i}`, category: t?.category ?? 'leo' });
    }
    worker.postMessage({ type: 'scan', positions: positions.slice(), count, tles });
  }

  function update(now) {
    if (!visible) return;

    if (satelliteLayer && now - lastScanTime >= SCAN_INTERVAL_MS) {
      triggerScan(now);
    }

    const pulse = 0.40 + 0.60 * (0.5 + 0.5 * Math.sin(now * 0.001 * Math.PI * 2 * 1.5));
    connLines.mat.opacity = pulse;
    tcaDots.mat.opacity   = pulse;
    satDots.mat.opacity   = 0.70 + 0.30 * pulse;

    if (currentConj.length === 0 || !satelliteLayer) return;

    const pos = satelliteLayer.getPositions();
    const n   = Math.min(currentConj.length, MAX_PAIRS);

    for (let i = 0; i < n; i++) {
      const c = currentConj[i];

      const ax = pos[c.idxA * 3],     ay = pos[c.idxA * 3 + 1], az = pos[c.idxA * 3 + 2];
      const bx = pos[c.idxB * 3],     by = pos[c.idxB * 3 + 1], bz = pos[c.idxB * 3 + 2];

      const cli = i * 6;
      connLines.pos[cli]   = ax; connLines.pos[cli+1] = ay; connLines.pos[cli+2] = az;
      connLines.pos[cli+3] = bx; connLines.pos[cli+4] = by; connLines.pos[cli+5] = bz;

      const siA = (i * 2)     * 3;
      const siB = (i * 2 + 1) * 3;
      satDots.pos[siA] = ax; satDots.pos[siA+1] = ay; satDots.pos[siA+2] = az;
      satDots.pos[siB] = bx; satDots.pos[siB+1] = by; satDots.pos[siB+2] = bz;

      const [vAx, vAy, vAz] = approxVelocity(ax, ay, az);
      const [vBx, vBy, vBz] = approxVelocity(bx, by, bz);

      const tiA = (i * 2)     * 6;
      const tiB = (i * 2 + 1) * 6;
      trajLines.pos[tiA]   = ax;                  trajLines.pos[tiA+1] = ay;                  trajLines.pos[tiA+2] = az;
      trajLines.pos[tiA+3] = ax + vAx*TRAJ_SECONDS; trajLines.pos[tiA+4] = ay + vAy*TRAJ_SECONDS; trajLines.pos[tiA+5] = az + vAz*TRAJ_SECONDS;
      trajLines.pos[tiB]   = bx;                  trajLines.pos[tiB+1] = by;                  trajLines.pos[tiB+2] = bz;
      trajLines.pos[tiB+3] = bx + vBx*TRAJ_SECONDS; trajLines.pos[tiB+4] = by + vBy*TRAJ_SECONDS; trajLines.pos[tiB+5] = bz + vBz*TRAJ_SECONDS;

      const drx = ax - bx, dry = ay - by, drz = az - bz;
      const dvx = vAx - vBx, dvy = vAy - vBy, dvz = vAz - vBz;
      const dv2 = dvx*dvx + dvy*dvy + dvz*dvz;

      let tcaX = (ax+bx)*0.5, tcaY = (ay+by)*0.5, tcaZ = (az+bz)*0.5;  // fallback: midpoint now
      c._tcaSec    = null;
      c._tcaDistKm = null;
      if (dv2 > 1e-12) {
        const tTCA = -(drx*dvx + dry*dvy + drz*dvz) / dv2;
        if (tTCA >= 0 && tTCA <= TCA_MAX_SECONDS) {
          tcaX = (ax + vAx*tTCA + bx + vBx*tTCA) * 0.5;
          tcaY = (ay + vAy*tTCA + by + vBy*tTCA) * 0.5;
          tcaZ = (az + vAz*tTCA + bz + vBz*tTCA) * 0.5;
          c._tcaSec = tTCA;
          const dtx = drx + dvx*tTCA, dty = dry + dvy*tTCA, dtz = drz + dvz*tTCA;
          c._tcaDistKm = Math.sqrt(dtx*dtx + dty*dty + dtz*dtz) * 500;
        }
      }
      const ti = i * 3;
      tcaDots.pos[ti] = tcaX; tcaDots.pos[ti+1] = tcaY; tcaDots.pos[ti+2] = tcaZ;
    }

    connLines.posAttr.needsUpdate = true;
    satDots.posAttr.needsUpdate   = true;
    trajLines.posAttr.needsUpdate = true;
    tcaDots.posAttr.needsUpdate   = true;
  }

  function setAllVisible(vis) {
    connLines.mesh.visible = vis;
    satDots.mesh.visible   = vis;
    trajLines.mesh.visible = vis;
    tcaDots.mesh.visible   = vis;
  }

  function setVisible(vis) {
    visible = vis;
    setAllVisible(vis);
    if (vis) triggerScan(performance.now());
  }

  function toggle() { setVisible(!visible); return visible; }
  function isVisible()       { return visible; }
  function getConjunctions() { return currentConj; }
  function getData()         { return { conjunctions: currentConj, totalFound: _totalFound, skippedColocated: _skippedColocated }; }

  function dispose() {
    worker.terminate();
    [connLines, satDots, trajLines].forEach(({ geo, mat, mesh }) => {
      geo.dispose(); mat.dispose(); scene.remove(mesh);
    });
    tcaDots.geo.dispose(); tcaDots.mat.dispose(); scene.remove(tcaDots.mesh);
  }

  console.log('[RiskOverlay] Conjunction risk layer created (v2 — 4 visual layers)');
  return { update, setVisible, toggle, isVisible, getConjunctions, getData, dispose };
}
