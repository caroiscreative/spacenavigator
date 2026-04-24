
import { buildOrbitalRiskDoc } from './templates/orbital-risk.js';

let _pdfMake = null;

async function getPdfMake() {
  if (_pdfMake) return _pdfMake;

  const [pdfMakeModule, pdfFontsModule] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ]);

  const pdfMake = pdfMakeModule.default ?? pdfMakeModule;
  const pdfFonts = pdfFontsModule.default ?? pdfFontsModule;

  pdfMake.vfs = pdfFonts?.pdfMake?.vfs ?? pdfFonts?.vfs ?? {};

  _pdfMake = pdfMake;
  return pdfMake;
}

function computeStats(tleData) {
  if (!tleData || tleData.length === 0) {
    return { total: 0, active: 0, debris: 0, stations: 0, starlink: 0, oneweb: 0, geo: 0, meo: 0, leo: 0 };
  }

  const counts = { debris: 0, station: 0, starlink: 0, oneweb: 0, geo: 0, meo: 0, leo: 0 };
  for (const tle of tleData) {
    const cat = tle.category ?? 'leo';
    counts[cat] = (counts[cat] ?? 0) + 1;
  }

  const debris   = counts.debris;
  const stations = counts.station;
  const active   = tleData.length - debris;

  return {
    total:    tleData.length,
    active,
    debris,
    stations,
    starlink: counts.starlink,
    oneweb:   counts.oneweb,
    geo:      counts.geo,
    meo:      counts.meo,
    leo:      counts.leo,
  };
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

export async function generateReport({ renderer, scene, camera, tleData, spaceWeather, riskOverlay, simTime }) {
  console.log('[Report] Starting PDF generation…');

  let screenshot = null;
  try {
    renderer.render(scene, camera);
    screenshot = renderer.domElement.toDataURL('image/jpeg', 0.82);
    console.log('[Report] Screenshot captured:', Math.round(screenshot.length / 1024), 'KB');
  } catch (err) {
    console.warn('[Report] Screenshot failed — continuing without it:', err.message);
  }

  const stats = computeStats(tleData);
  console.log('[Report] Satellite stats:', stats.total, 'objects');

  const conjData     = riskOverlay?.getData();
  const conjunctions = conjData?.conjunctions ?? [];
  console.log('[Report] Conjunctions:', conjunctions.length, 'events');

  const weather = spaceWeather?.getData() ?? null;

  const simDate = formatSimDate(simTime);
  const docDef  = buildOrbitalRiskDoc({ screenshot, stats, conjunctions, weather, simDate });

  const pdfMake  = await getPdfMake();
  const filename = `SpaceNavigator_Report_${new Date().toISOString().substring(0, 10)}.pdf`;

  console.log('[Report] Generating PDF…');
  const t0 = performance.now();

  await new Promise((resolve, reject) => {
    try {
      pdfMake.createPdf(docDef).download(filename, resolve);
    } catch (err) {
      reject(err);
    }
  });

  const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
  console.log(`[Report] PDF ready in ${elapsed}s — ${filename}`);
}
