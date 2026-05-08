

import { GALAXIES, NEBULAE, BLACK_HOLES } from '../data/galaxy-catalog.js';

const DRAG_THRESHOLD = 8;
const MAX_RESULTS    = 12;

const PLANETS = [
  { name: 'EARTH',   key: 'e', color: '#4FC3F7', desc: 'Home planet' },
  { name: 'MOON',    key: 'm', color: '#CCCCCC', desc: 'Lunar orbit'  },
  { name: 'MERCURY', key: 'q', color: '#AAAAAA', desc: '0.39 AU'      },
  { name: 'VENUS',   key: 'v', color: '#FFD54F', desc: '0.72 AU'      },
  { name: 'MARS',    key: 'r', color: '#FF6B35', desc: '1.52 AU'      },
  { name: 'JUPITER', key: 'j', color: '#FFCC80', desc: '5.20 AU'      },
  { name: 'SATURN',  key: 's', color: '#FFE082', desc: '9.58 AU'      },
  { name: 'URANUS',  key: 'u', color: '#80DEEA', desc: '19.2 AU'      },
  { name: 'NEPTUNE', key: 'n', color: '#5C6BC0', desc: '30.1 AU'      },
];

const VIEW_PRESETS = [
  { label: 'LEO',   desc: '~400 km',            view: 'LEO'   },
  { label: 'GEO',   desc: '35,786 km',           view: 'GEO'   },
  { label: 'SOLAR', desc: 'Inner system',         view: 'SOLAR' },
  { label: 'STARS', desc: 'Stellar neighborhood', view: 'STARS' },
  { label: 'OUTER', desc: 'Outer planets',        view: 'OUTER' },
];

const DISPLAY_LAYERS = [
  { label: 'STARS',  key: 'stars'          },
  { label: 'CONST',  key: 'constellations' },
  { label: 'HEAT',   key: 'heat'           },
  { label: 'AST',    key: 'asteroids'      },
  { label: 'INTL',   key: 'interstellar'   },
  { label: 'ORBITS', key: 'orbits'         },
];

const OBJECTS_LAYERS = [
  { label: 'SATS',   key: 'satellites' },
  { label: 'DEBRIS', key: 'debris'     },
  { label: 'RISK',   key: 'risk'       },
  { label: 'WTHR',   key: 'weather'    },
];

const INTERSTELLAR_ITEMS = [
  { id: '1i-oumuamua', name: "1I/ʻOumuamua", dist: '0.21 AU',  color: '#FFCC44' },
  { id: '2i-borisov',  name: '2I/Borisov',   dist: '2.01 AU',  color: '#88CCFF' },
  { id: '3i-atlas',    name: '3I/ATLAS',      dist: 'Active',   color: '#FF8844' },
];

const SAT_CATEGORY_META = {
  starlink: { label: 'Starlink',       color: '#4FC3F7', sub: 'SpaceX broadband constellation' },
  leo:      { label: 'LEO',            color: '#4FC3F7', sub: 'Low Earth Orbit operational' },
  geo:      { label: 'GEO',            color: '#FFB300', sub: 'Geostationary operational' },
  oneweb:   { label: 'OneWeb',         color: '#80DEEA', sub: 'LEO broadband constellation' },
  meo:      { label: 'MEO / GNSS',     color: '#A5D6A7', sub: 'GPS · GLONASS · Galileo · BeiDou' },
  station:  { label: 'Space Stations', color: '#FFFFFF', sub: 'ISS · Tiangong · crewed' },
};

const DEBRIS_GROUP_META = {
  fengyun: { label: 'Fengyun',          color: '#FF4455', sub: 'Chinese weather sat · ASAT test 2007' },
  cosmos:  { label: 'Cosmos',           color: '#FF6B6B', sub: 'Russian satellites & rocket bodies' },
  iridium: { label: 'Iridium',          color: '#FF4455', sub: 'Iridium–Cosmos collision · 2009' },
  breeze:  { label: 'Breeze-M',         color: '#FF6B6B', sub: 'Russian Proton upper stage' },
  sl:      { label: 'SL Rocket Bodies', color: '#FF8A80', sub: 'Soviet / Russian rocket stages' },
  cz:      { label: 'Long March (CZ)',  color: '#FF8A80', sub: 'Chinese rocket stages' },
  ariane:  { label: 'Ariane',           color: '#FF6B6B', sub: 'European rocket stages' },
  delta:   { label: 'Delta',            color: '#FF8A80', sub: 'US rocket stages' },
  titan:   { label: 'Titan',            color: '#FF8A80', sub: 'US rocket stages' },
  atlas:   { label: 'Atlas',            color: '#FF8A80', sub: 'US rocket stages' },
  other:   { label: 'Other',            color: '#EF5350', sub: 'Various missions' },
};

function debrisGroupKey(name) {
  const n = name.toUpperCase();
  if (n.includes('FENGYUN'))  return 'fengyun';
  if (n.includes('COSMOS'))   return 'cosmos';
  if (n.includes('IRIDIUM'))  return 'iridium';
  if (n.includes('BREEZE'))   return 'breeze';
  if (/\bSL-\d/.test(n))      return 'sl';
  if (/\bCZ-/.test(n))        return 'cz';
  if (n.includes('ARIANE'))   return 'ariane';
  if (n.includes('DELTA'))    return 'delta';
  if (n.includes('TITAN'))    return 'titan';
  if (n.includes('ATLAS'))    return 'atlas';
  return 'other';
}

function catColor(cat) {
  switch (cat) {
    case 'station':  return '#FFFFFF';
    case 'starlink':
    case 'oneweb':
    case 'leo':      return '#4FC3F7';
    case 'geo':      return '#FFB300';
    case 'meo':      return '#A5D6A7';
    case 'debris':   return '#EF5350';
    default:         return '#78909C';
  }
}

function formatDist(distance, distUnit) {
  if (!distUnit) return '—';
  const u = distUnit.toLowerCase();
  if (u === 'mly') return `${distance} MLY`;
  if (u === 'ly')  return `${(distance / 1000).toFixed(1)} KLY`;
  if (u === 'au')  return `${distance} AU`;
  return `${distance} ${distUnit}`;
}

export function isMobile() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

function injectCSS() {
  if (document.getElementById('mob-hud-style')) return;
  const s = document.createElement('style');
  s.id = 'mob-hud-style';
  s.textContent = `
    body.mobile-mode #hud,
    body.mobile-mode #status,
    body.mobile-mode #panel-dock,
    body.mobile-mode #explorer-panel,
    body.mobile-mode .sn-panel { display: none !important; }

    /* ── Top bar ──────────────────────────────────────── */
    #mob-top {
      position: fixed; top: 0; left: 0; right: 0;
      height: 34px; z-index: 9000;
      display: flex; align-items: center; gap: 10px;
      padding: 0 12px;
      background: rgba(0,0,0,0.75);
      border-bottom: 1px solid rgba(0,212,255,0.10);
      pointer-events: none;
      font-family: 'Geist Mono','Courier New',monospace;
      font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase;
      user-select: none; -webkit-user-select: none;
    }
    #mob-logo { color:#00D4FF; font-size: 12px; font-weight:500; letter-spacing:0.20em; flex-shrink:0; }
    #mob-live-dot {
      width:5px; height:5px; border-radius:50%;
      background:#00FF88; flex-shrink:0;
      animation: mob-blink 2s ease-in-out infinite;
    }
    @keyframes mob-blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
    #mob-utc       { color:#3A5A6A; flex-shrink:0; }
    #mob-sat-count { color:rgba(0,212,255,0.45); flex-shrink:0; }
    #mob-body-name { color:#C8DCF0; flex:1; text-align:right;
      overflow:hidden; white-space:nowrap; text-overflow:ellipsis; font-size: 12px; }

    /* ── EXPL button (right edge) ─────────────────────── */
    #mob-expl-btn {
      position: fixed;
      right: 0; top: 50%; transform: translateY(-50%);
      z-index: 9200;
      width: 48px; height: 52px;
      background: rgba(0,0,0,0.78);
      border: 1px solid rgba(0,212,255,0.20);
      border-right: none;
      border-radius: 5px 0 0 5px;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 3px;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      user-select: none; -webkit-user-select: none;
      transition: border-color 80ms, background 80ms;
    }
    #mob-expl-btn:active,
    #mob-expl-btn.open { border-color: rgba(0,212,255,0.55); background: rgba(0,212,255,0.07); }
    #mob-expl-btn .expl-icon { font-size:16px; color:rgba(0,212,255,0.55); line-height:1; }
    #mob-expl-btn .expl-label {
      font-family:'Geist Mono',monospace;
      font-size: 12px; letter-spacing:0.12em;
      color:rgba(0,212,255,0.40); text-transform:uppercase;
    }
    #mob-expl-btn.open .expl-icon,
    #mob-expl-btn.open .expl-label { color:#00D4FF; }

    /* ── Explorer drawer ──────────────────────────────── */
    #mob-explorer {
      position: fixed;
      top: 34px; right: 0; bottom: 44px;
      width: 72vw; max-width: 300px;
      z-index: 9100;
      background: rgba(2,5,12,0.97);
      border-left: 1px solid rgba(0,212,255,0.18);
      transform: translateX(100%);
      transition: transform 220ms cubic-bezier(0.4,0,0.2,1);
      display: flex; flex-direction: column;
      overflow: hidden;
      pointer-events: none;
    }
    #mob-explorer.open { transform: translateX(0); pointer-events: all; }

    .mob-expl-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px 8px;
      border-bottom: 1px solid rgba(0,212,255,0.10);
      flex-shrink: 0;
    }
    .mob-expl-title {
      font-family:'Geist Mono',monospace;
      font-size: 12px; font-weight:500;
      letter-spacing:0.18em; text-transform:uppercase;
      color:rgba(0,212,255,0.55);
    }
    .mob-expl-count {
      font-family:'Geist Mono',monospace;
      font-size: 12px; color:rgba(0,212,255,0.28);
      letter-spacing:0.06em;
    }

    /* Tab bar */
    .mob-expl-tabs {
      display: flex;
      border-bottom: 1px solid rgba(0,212,255,0.10);
      flex-shrink: 0;
      overflow-x: auto; -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
    }
    .mob-expl-tabs::-webkit-scrollbar { display: none; }
    .mob-expl-tab {
      flex-shrink: 0;
      padding: 7px 10px;
      font-family:'Geist Mono',monospace;
      font-size: 12px; letter-spacing:0.10em; text-transform:uppercase;
      color: rgba(0,212,255,0.28);
      cursor: pointer;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      user-select: none; -webkit-user-select: none;
      transition: color 80ms, border-color 80ms;
      white-space: nowrap;
    }
    .mob-expl-tab.active { color: #00D4FF; border-bottom-color: rgba(0,212,255,0.55); }
    .mob-expl-tab:active { color: rgba(0,212,255,0.60); }

    /* Search bar (shown for SATS/DEBRIS individual view) */
    .mob-expl-search-wrap {
      flex-shrink: 0;
      padding: 6px 10px;
      border-bottom: 1px solid rgba(0,212,255,0.08);
    }
    .mob-expl-search-wrap.hidden { display: none; }
    .mob-expl-search {
      width: 100%; box-sizing: border-box;
      background: rgba(0,212,255,0.05);
      border: 1px solid rgba(0,212,255,0.18);
      color: #C8DCF0;
      font-family:'Geist Mono',monospace;
      font-size: 12px; letter-spacing:0.06em;
      padding: 5px 8px;
      outline: none;
    }
    .mob-expl-search::placeholder { color: rgba(0,212,255,0.22); }
    .mob-expl-search:focus { border-color: rgba(0,212,255,0.45); }

    /* Content panels */
    .mob-expl-content {
      flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch;
      display: none;
    }
    .mob-expl-content.active { display: block; }

    /* DSO rows (galaxies / black holes / nebulas / interstellar) */
    .mob-dso-row {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 14px;
      cursor: pointer;
      border-bottom: 1px solid rgba(0,212,255,0.05);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      user-select: none; -webkit-user-select: none;
      transition: background 60ms;
    }
    .mob-dso-row:last-child { border-bottom: none; }
    .mob-dso-row:active { background: rgba(0,212,255,0.07); }
    .mob-dso-dot {
      width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
    }
    .mob-dso-name {
      font-family:'Geist Mono',monospace;
      font-size: 12px; letter-spacing:0.08em; text-transform:uppercase;
      color:#8AAAC0; flex: 1;
      overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
    }
    .mob-dso-dist {
      font-family:'Geist Mono',monospace;
      font-size: 12px; color:rgba(0,212,255,0.28);
      letter-spacing:0.04em; flex-shrink: 0;
    }

    /* Group rows (satellite / debris groups) */
    .mob-group-row {
      padding: 9px 14px 7px;
      cursor: pointer;
      border-bottom: 1px solid rgba(0,212,255,0.05);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      user-select: none; -webkit-user-select: none;
      transition: background 60ms;
    }
    .mob-group-row:active { background: rgba(0,212,255,0.06); }
    .mob-group-top {
      display: flex; align-items: center; gap: 8px; margin-bottom: 2px;
    }
    .mob-group-label {
      font-family:'Geist Mono',monospace;
      font-size: 12px; letter-spacing:0.08em; text-transform:uppercase;
      color:#8AAAC0; flex: 1;
    }
    .mob-group-count {
      font-family:'Geist Mono',monospace;
      font-size: 12px; color:rgba(0,212,255,0.38); flex-shrink:0;
    }
    .mob-group-chev { font-size:12px; color:rgba(0,212,255,0.25); flex-shrink:0; }
    .mob-group-sub {
      font-family:'Geist Mono',monospace;
      font-size: 12px; color:rgba(0,212,255,0.20); letter-spacing:0.06em;
      padding-left: 15px; margin-bottom: 4px;
    }
    .mob-group-bar-track {
      height: 2px; background: rgba(0,212,255,0.06);
      margin-left: 15px; border-radius: 1px; overflow: hidden;
    }
    .mob-group-bar { height: 100%; border-radius: 1px; }

    /* Back row (inside individual view) */
    .mob-back-row {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 10px;
      border-bottom: 1px solid rgba(0,212,255,0.10);
      flex-shrink: 0;
    }
    .mob-back-btn {
      background: transparent;
      border: 1px solid rgba(0,212,255,0.22);
      color: rgba(0,212,255,0.55);
      font-family:'Geist Mono',monospace;
      font-size: 12px; padding: 3px 8px;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent; touch-action: manipulation;
    }
    .mob-back-btn:active { background: rgba(0,212,255,0.08); }
    .mob-back-label {
      font-family:'Geist Mono',monospace;
      font-size: 12px; letter-spacing:0.10em; text-transform:uppercase;
      flex: 1;
    }
    .mob-sel-all-btn {
      background: transparent;
      border: 1px solid rgba(0,212,255,0.16);
      color: rgba(0,212,255,0.38);
      font-family:'Geist Mono',monospace;
      font-size: 12px; letter-spacing:0.08em; padding: 3px 7px;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent; touch-action: manipulation;
    }
    .mob-sel-all-btn:active { background: rgba(0,212,255,0.08); color:#00D4FF; }

    /* Individual satellite rows */
    .mob-sat-row {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 14px;
      cursor: pointer;
      border-bottom: 1px solid rgba(0,212,255,0.05);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      user-select: none; -webkit-user-select: none;
      transition: background 60ms;
    }
    .mob-sat-row:active { background: rgba(0,212,255,0.07); }
    .mob-sat-name {
      font-family:'Geist Mono',monospace;
      font-size: 12px; letter-spacing:0.06em; text-transform:uppercase;
      color:#8AAAC0; flex: 1;
      overflow:hidden; white-space:nowrap; text-overflow:ellipsis;
    }
    .mob-sat-norad {
      font-family:'Geist Mono',monospace;
      font-size: 12px; color:rgba(0,212,255,0.22); flex-shrink:0;
    }

    /* Empty / hint */
    .mob-expl-empty {
      padding: 16px 14px;
      font-family:'Geist Mono',monospace;
      font-size: 12px; color:rgba(0,212,255,0.22);
      letter-spacing:0.08em; text-transform:uppercase;
    }
    .mob-expl-hint {
      padding: 8px 14px;
      font-family:'Geist Mono',monospace;
      font-size: 12px; color:rgba(0,212,255,0.18);
      letter-spacing:0.06em; border-top: 1px solid rgba(0,212,255,0.06);
    }

    /* ── Bottom bar (single LAYERS button) ────────────── */
    #mob-bottom-bar {
      position: fixed; left: 0; right: 0; bottom: 0;
      height: 44px; z-index: 9000;
      background: rgba(0,0,0,0.80);
      border-top: 1px solid rgba(0,212,255,0.10);
      display: flex; align-items: center; justify-content: center;
      pointer-events: all;
      user-select: none; -webkit-user-select: none;
    }
    .mob-bar-btn {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 2px;
      padding: 0 44px; height: 100%;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      transition: background 80ms;
    }
    .mob-bar-btn:active { background: rgba(0,212,255,0.07); }
    .mob-bar-btn-icon { font-size:13px; color:rgba(0,212,255,0.40); line-height:1; }
    .mob-bar-btn-label {
      font-family:'Geist Mono',monospace;
      font-size: 12px; letter-spacing:0.12em; text-transform:uppercase;
      color:rgba(0,212,255,0.30);
    }
    .mob-bar-btn.open .mob-bar-btn-icon,
    .mob-bar-btn.open .mob-bar-btn-label { color:#00D4FF; }
    .mob-bar-btn:active .mob-bar-btn-icon,
    .mob-bar-btn:active .mob-bar-btn-label { color:rgba(0,212,255,0.70); }

    /* ── Unified layer panel ──────────────────────────── */
    #mob-layer-panel {
      position: fixed; left: 0; right: 0; bottom: 44px;
      z-index: 8998;
      background: rgba(2,5,12,0.95);
      border-top: 1px solid rgba(0,212,255,0.16);
      transform: translateY(100%);
      transition: transform 220ms cubic-bezier(0.4,0,0.2,1);
      padding: 8px 10px 10px;
      display: flex; flex-direction: column; gap: 6px;
      pointer-events: none;
    }
    #mob-layer-panel.open { transform: translateY(0); pointer-events: all; }

    .mob-layer-row { display: flex; align-items: center; gap: 6px; }
    .mob-row-label {
      font-family:'Geist Mono',monospace;
      font-size: 12px; letter-spacing:0.12em; text-transform:uppercase;
      color:rgba(0,212,255,0.22);
      width: 36px; flex-shrink: 0;
    }
    .mob-chip-scroll {
      display: flex; gap: 5px;
      overflow-x: auto; -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
    }
    .mob-chip-scroll::-webkit-scrollbar { display: none; }
    .mob-chip {
      flex-shrink: 0;
      padding: 4px 9px;
      border: 1px solid rgba(0,212,255,0.14);
      background: transparent;
      color: rgba(0,212,255,0.36);
      font-family:'Geist Mono',monospace;
      font-size: 12px; letter-spacing:0.10em; text-transform:uppercase;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      transition: border-color 80ms, color 80ms, background 80ms;
      white-space: nowrap;
      user-select: none; -webkit-user-select: none;
    }
    .mob-chip:active { background: rgba(0,212,255,0.07); }
    .mob-chip.active {
      border-color: rgba(0,212,255,0.58);
      color: #00D4FF;
      background: rgba(0,212,255,0.08);
    }
    /* Planet chips */
    .mob-planet-chip { border-color: rgba(0,212,255,0.12) !important; }
    .mob-planet-chip.active {
      border-color: var(--pc,rgba(0,212,255,0.58)) !important;
      color: var(--pc,#00D4FF) !important;
      background: rgba(0,212,255,0.05) !important;
    }
    /* View chips */
    .mob-view-chip {
      border-color: rgba(255,179,0,0.20) !important;
      color: rgba(255,179,0,0.45) !important;
    }
    .mob-view-chip.active {
      border-color: rgba(255,179,0,0.65) !important;
      color: #FFB300 !important;
      background: rgba(255,179,0,0.07) !important;
    }

    /* ── Info sheet ───────────────────────────────────── */
    #mob-info-sheet {
      position: fixed; left: 0; right: 0; bottom: 44px;
      z-index: 8997;
      background: rgba(2,5,12,0.95);
      border-top: 1px solid rgba(0,212,255,0.20);
      transform: translateY(100%);
      transition: transform 200ms cubic-bezier(0.4,0,0.2,1);
      font-family:'Geist Mono',monospace;
      pointer-events: none;
      user-select: none; -webkit-user-select: none;
    }
    #mob-info-sheet.visible { transform: translateY(0); pointer-events: all; }
    #mob-info-collapsed {
      height: 52px;
      display: flex; align-items: center; gap: 10px;
      padding: 0 12px;
    }
    #mob-info-name {
      font-size: 12px; font-weight:500; letter-spacing:0.12em; color:#D8ECF8;
      text-transform:uppercase; flex:1;
      overflow:hidden; white-space:nowrap; text-overflow:ellipsis;
    }
    #mob-info-type { font-size: 12px; letter-spacing:0.12em; color:rgba(0,212,255,0.50); flex-shrink:0; }
    #mob-info-stat { font-size: 12px; color:#5A7A8A; flex-shrink:0; }
    #mob-info-expand-btn {
      background:transparent; border:1px solid rgba(0,212,255,0.18);
      color:rgba(0,212,255,0.45); font-size: 12px;
      width:28px; height:28px;
      display:flex; align-items:center; justify-content:center;
      cursor:pointer; flex-shrink:0;
      -webkit-tap-highlight-color:transparent; touch-action:manipulation;
    }
    #mob-info-expand-btn:active { background:rgba(0,212,255,0.08); }
    #mob-info-close-btn {
      background:transparent; border:none;
      color:rgba(0,212,255,0.30); font-size:18px;
      width:28px; height:28px;
      display:flex; align-items:center; justify-content:center;
      cursor:pointer; flex-shrink:0; padding:0; line-height:1;
      -webkit-tap-highlight-color:transparent; touch-action:manipulation;
    }
    #mob-info-close-btn:active { color:rgba(0,212,255,0.75); }
    #mob-info-expanded {
      display:none; flex-direction:column;
      padding:4px 12px 10px; gap:0;
      max-height:160px; overflow-y:auto;
      -webkit-overflow-scrolling:touch;
      border-top:1px solid rgba(0,212,255,0.08);
    }
    #mob-info-sheet.expanded #mob-info-expanded { display:flex; }
    .mob-info-row {
      display:flex; justify-content:space-between; align-items:baseline;
      padding:5px 0; border-bottom:1px solid rgba(0,212,255,0.06);
    }
    .mob-info-row:last-child { border-bottom:none; }
    .mob-info-row-label { font-size: 12px; letter-spacing:0.12em; color:rgba(0,212,255,0.30); text-transform:uppercase; }
    .mob-info-row-val   { font-size: 12px; color:#B8D0E0; }
    #mob-info-collapse-btn {
      align-self:center; margin-top:6px;
      background:transparent; border:none;
      color:rgba(0,212,255,0.28); font-family:'Geist Mono',monospace;
      font-size: 12px; letter-spacing:0.12em; cursor:pointer;
      -webkit-tap-highlight-color:transparent; touch-action:manipulation;
      padding:4px 12px;
    }
    #mob-info-collapse-btn:active { color:rgba(0,212,255,0.65); }

    /* ── Backdrop ─────────────────────────────────────── */
    #mob-backdrop {
      position: fixed; inset: 0; z-index: 9050; display: none;
    }
    #mob-backdrop.visible { display: block; }
  `;
  document.head.appendChild(s);
}

export function createMobileControls(camera, orbitControls, canvas, callbacks = {}) {
  if (!isMobile()) return null;

  injectCSS();
  document.body.classList.add('mobile-mode');

  const { getTleData, onSelectSat, onSelectGroup } = callbacks;

  const layerState = {
    satellites: true, debris: true, orbits: false,
    stars: true, constellations: false, heat: false,
    asteroids: false, interstellar: false,
    risk: false, weather: false,
  };

  const topBar = document.createElement('div');
  topBar.id = 'mob-top';
  topBar.innerHTML = `
    <span id="mob-logo">SN</span>
    <div id="mob-live-dot"></div>
    <span id="mob-utc">—</span>
    <span id="mob-sat-count"></span>
    <span id="mob-body-name"></span>
  `;
  document.body.appendChild(topBar);

  const explBtn = document.createElement('button');
  explBtn.id = 'mob-expl-btn';
  explBtn.setAttribute('aria-label', 'Open explorer');
  explBtn.innerHTML = `<span class="expl-icon">⊹</span><span class="expl-label">EXPL</span>`;
  document.body.appendChild(explBtn);

  const explorer = document.createElement('div');
  explorer.id = 'mob-explorer';

  const galaxiesHTML = GALAXIES.map(d => `
    <div class="mob-dso-row" data-dso-id="${d.id}" data-dso-cat="galaxy">
      <div class="mob-dso-dot" style="background:${d.color}"></div>
      <span class="mob-dso-name">${d.name}</span>
      <span class="mob-dso-dist">${formatDist(d.distance, d.distUnit)}</span>
    </div>`).join('');

  const blackHolesHTML = BLACK_HOLES.map(d => `
    <div class="mob-dso-row" data-dso-id="${d.id}" data-dso-cat="blackhole">
      <div class="mob-dso-dot" style="background:${d.color}"></div>
      <span class="mob-dso-name">${d.name}</span>
      <span class="mob-dso-dist">${formatDist(d.distance, d.distUnit)}</span>
    </div>`).join('');

  const nebulasHTML = NEBULAE.map(d => `
    <div class="mob-dso-row" data-dso-id="${d.id}" data-dso-cat="nebula">
      <div class="mob-dso-dot" style="background:${d.color}"></div>
      <span class="mob-dso-name">${d.name}</span>
      <span class="mob-dso-dist">${formatDist(d.distance, d.distUnit)}</span>
    </div>`).join('');

  const intrstlHTML = INTERSTELLAR_ITEMS.map(d => `
    <div class="mob-dso-row" data-dso-id="${d.id}" data-dso-cat="interstellar">
      <div class="mob-dso-dot" style="background:${d.color}"></div>
      <span class="mob-dso-name">${d.name}</span>
      <span class="mob-dso-dist">${d.dist}</span>
    </div>`).join('');

  explorer.innerHTML = `
    <div class="mob-expl-header">
      <span class="mob-expl-title">EXPLORER</span>
      <span class="mob-expl-count" id="mob-expl-count"></span>
    </div>
    <div class="mob-expl-tabs">
      <div class="mob-expl-tab active" data-tab="galaxies">GALAXIES</div>
      <div class="mob-expl-tab" data-tab="blackholes">B.HOLES</div>
      <div class="mob-expl-tab" data-tab="nebulas">NEBULAS</div>
      <div class="mob-expl-tab" data-tab="interstellar">INTRSTL</div>
      <div class="mob-expl-tab" data-tab="satellites">SATS</div>
      <div class="mob-expl-tab" data-tab="debris">DEBRIS</div>
    </div>
    <div class="mob-expl-search-wrap hidden" id="mob-expl-search-wrap">
      <input id="mob-expl-search" class="mob-expl-search" type="text"
             placeholder="Search name or NORAD…"
             autocomplete="off" autocorrect="off" spellcheck="false">
    </div>
    <div class="mob-expl-content active" data-content="galaxies">${galaxiesHTML}</div>
    <div class="mob-expl-content" data-content="blackholes">${blackHolesHTML}</div>
    <div class="mob-expl-content" data-content="nebulas">${nebulasHTML}</div>
    <div class="mob-expl-content" data-content="interstellar">${intrstlHTML}</div>
    <div class="mob-expl-content" id="mob-expl-sats"   data-content="satellites"></div>
    <div class="mob-expl-content" id="mob-expl-debris" data-content="debris"></div>
  `;
  document.body.appendChild(explorer);

  const backdrop = document.createElement('div');
  backdrop.id = 'mob-backdrop';
  document.body.appendChild(backdrop);

  const bottomBar = document.createElement('div');
  bottomBar.id = 'mob-bottom-bar';
  bottomBar.innerHTML = `
    <div id="mob-layers-btn" class="mob-bar-btn" aria-label="Toggle layers">
      <span class="mob-bar-btn-icon">⊞</span>
      <span class="mob-bar-btn-label">LAYERS</span>
    </div>
  `;
  document.body.appendChild(bottomBar);

  const layerPanel = document.createElement('div');
  layerPanel.id = 'mob-layer-panel';

  const planetsChipsHTML = PLANETS.map(p =>
    `<button class="mob-chip mob-planet-chip" data-name="${p.name}" style="--pc:${p.color}">${p.name.substring(0,3)}</button>`
  ).join('');

  const viewChipsHTML = VIEW_PRESETS.map(v =>
    `<button class="mob-chip mob-view-chip" data-view="${v.view}">${v.label}</button>`
  ).join('');

  const dispChipsHTML = DISPLAY_LAYERS.map(l =>
    `<button class="mob-chip ${layerState[l.key] ? 'active' : ''}" data-layer="${l.key}">${l.label}</button>`
  ).join('');

  const objChipsHTML = OBJECTS_LAYERS.map(l =>
    `<button class="mob-chip ${layerState[l.key] ? 'active' : ''}" data-layer="${l.key}">${l.label}</button>`
  ).join('');

  layerPanel.innerHTML = `
    <div class="mob-layer-row">
      <span class="mob-row-label">BODY</span>
      <div class="mob-chip-scroll">${planetsChipsHTML}</div>
    </div>
    <div class="mob-layer-row">
      <span class="mob-row-label">VIEW</span>
      <div class="mob-chip-scroll">${viewChipsHTML}</div>
    </div>
    <div class="mob-layer-row">
      <span class="mob-row-label">DISP</span>
      <div class="mob-chip-scroll">${dispChipsHTML}</div>
    </div>
    <div class="mob-layer-row">
      <span class="mob-row-label">OBJ</span>
      <div class="mob-chip-scroll">${objChipsHTML}</div>
    </div>
  `;
  document.body.appendChild(layerPanel);

  const infoSheet = document.createElement('div');
  infoSheet.id = 'mob-info-sheet';
  infoSheet.innerHTML = `
    <div id="mob-info-collapsed">
      <span id="mob-info-name">—</span>
      <span id="mob-info-type"></span>
      <span id="mob-info-stat"></span>
      <button id="mob-info-expand-btn" aria-label="Expand">▲</button>
      <button id="mob-info-close-btn" aria-label="Close">×</button>
    </div>
    <div id="mob-info-expanded">
      <div id="mob-info-rows"></div>
      <button id="mob-info-collapse-btn">▼ COLLAPSE</button>
    </div>
  `;
  document.body.appendChild(infoSheet);

  const utcEl       = document.getElementById('mob-utc');
  const satCountEl  = document.getElementById('mob-sat-count');
  const bodyNameEl  = document.getElementById('mob-body-name');
  const layersBtn   = document.getElementById('mob-layers-btn');
  const countEl     = document.getElementById('mob-expl-count');
  const searchWrap  = document.getElementById('mob-expl-search-wrap');
  const searchInput = document.getElementById('mob-expl-search');
  const satsContent = document.getElementById('mob-expl-sats');
  const debrisContent = document.getElementById('mob-expl-debris');
  const infoName    = document.getElementById('mob-info-name');
  const infoType    = document.getElementById('mob-info-type');
  const infoStat    = document.getElementById('mob-info-stat');
  const infoRows    = document.getElementById('mob-info-rows');
  const infoExpandBtn   = document.getElementById('mob-info-expand-btn');
  const infoCollapseBtn = document.getElementById('mob-info-collapse-btn');
  const infoCloseBtn    = document.getElementById('mob-info-close-btn');

  let explorerOpen   = false;
  let layerPanelOpen = false;
  let infoExpanded   = false;
  let activeTab      = 'galaxies';
  let satActiveGroup = null;
  let debActiveGroup = null;

  function renderSatContent(debrisOnly) {
    const contentEl = debrisOnly ? debrisContent : satsContent;
    contentEl.innerHTML = '';

    const tles = (typeof getTleData === 'function') ? getTleData() : [];
    if (!tles.length) {
      contentEl.innerHTML = '<div class="mob-expl-empty">TLE data loading…</div>';
      if (countEl) countEl.textContent = '—';
      return;
    }

    const activeGroup = debrisOnly ? debActiveGroup : satActiveGroup;

    if (activeGroup === null) {
      if (searchWrap) searchWrap.classList.add('hidden');
      if (searchInput) searchInput.value = '';
      renderGroupList(contentEl, tles, debrisOnly);
    } else {
      if (searchWrap) searchWrap.classList.remove('hidden');
      renderIndividualList(contentEl, tles, debrisOnly, activeGroup);
    }
  }

  function renderGroupList(contentEl, tles, debrisOnly) {
    const countMap = {};
    let total = 0;
    for (const tle of tles) {
      if (debrisOnly ? tle.category !== 'debris' : tle.category === 'debris') continue;
      const key = debrisOnly ? debrisGroupKey(tle.name) : tle.category;
      countMap[key] = (countMap[key] || 0) + 1;
      total++;
    }
    if (countEl) countEl.textContent = `${total.toLocaleString()} tracked`;

    const groups = Object.entries(countMap)
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);
    const maxCount = groups[0]?.count || 1;

    groups.forEach(({ key, count }) => {
      const meta = debrisOnly
        ? (DEBRIS_GROUP_META[key] || { label: key, color: '#EF5350', sub: '' })
        : (SAT_CATEGORY_META[key]  || { label: key, color: '#4FC3F7', sub: '' });
      const pct = Math.max(4, (count / maxCount) * 100).toFixed(1);

      const el = document.createElement('div');
      el.className = 'mob-group-row';
      el.innerHTML = `
        <div class="mob-group-top">
          <div class="mob-dso-dot" style="background:${meta.color}"></div>
          <span class="mob-group-label">${meta.label}</span>
          <span class="mob-group-count">${count.toLocaleString()}</span>
          <span class="mob-group-chev">›</span>
        </div>
        <div class="mob-group-sub">${meta.sub}</div>
        <div class="mob-group-bar-track">
          <div class="mob-group-bar" style="width:${pct}%;background:${meta.color}33;border-right:2px solid ${meta.color}80"></div>
        </div>`;
      el.addEventListener('pointerdown', (e) => {
        e.stopPropagation(); e.preventDefault();
        if (onSelectGroup) {
          const norads = new Set();
          for (const t of tles) {
            if (debrisOnly ? t.category !== 'debris' : t.category === 'debris') continue;
            const k = debrisOnly ? debrisGroupKey(t.name) : t.category;
            if (k === key && t.norad != null) norads.add(t.norad);
          }
          onSelectGroup(norads);
        }
        if (debrisOnly) debActiveGroup = key; else satActiveGroup = key;
        if (searchInput) searchInput.value = '';
        renderSatContent(debrisOnly);
      }, { passive: false });
      contentEl.appendChild(el);
    });
  }

  function renderIndividualList(contentEl, tles, debrisOnly, activeGroup) {
    const query = (searchInput?.value ?? '').trim().toLowerCase();
    const meta  = debrisOnly
      ? (DEBRIS_GROUP_META[activeGroup] || { label: activeGroup, color: '#EF5350' })
      : (SAT_CATEGORY_META[activeGroup]  || { label: activeGroup, color: '#4FC3F7' });

    const backRow = document.createElement('div');
    backRow.className = 'mob-back-row';
    backRow.innerHTML = `
      <button class="mob-back-btn">‹ Back</button>
      <span class="mob-back-label" style="color:${meta.color}">${meta.label}</span>
      <button class="mob-sel-all-btn">ALL</button>`;
    backRow.querySelector('.mob-back-btn').addEventListener('pointerdown', (e) => {
      e.stopPropagation(); e.preventDefault();
      if (onSelectGroup) onSelectGroup(null);
      if (debrisOnly) debActiveGroup = null; else satActiveGroup = null;
      if (searchInput) searchInput.value = '';
      renderSatContent(debrisOnly);
    }, { passive: false });
    backRow.querySelector('.mob-sel-all-btn').addEventListener('pointerdown', (e) => {
      e.stopPropagation(); e.preventDefault();
      if (!onSelectGroup) return;
      const norads = new Set();
      for (const t of tles) {
        if (debrisOnly ? t.category !== 'debris' : t.category === 'debris') continue;
        const k = debrisOnly ? debrisGroupKey(t.name) : t.category;
        if (k === activeGroup && t.norad != null) norads.add(t.norad);
      }
      onSelectGroup(norads);
    }, { passive: false });
    contentEl.appendChild(backRow);

    let groupTotal = 0, queryHits = 0;
    const hits = [];
    for (let i = 0; i < tles.length; i++) {
      const tle = tles[i];
      if (debrisOnly ? tle.category !== 'debris' : tle.category === 'debris') continue;
      const key = debrisOnly ? debrisGroupKey(tle.name) : tle.category;
      if (key !== activeGroup) continue;
      groupTotal++;
      if (!query) {
        if (hits.length < MAX_RESULTS) hits.push(i);
      } else {
        const match = tle.name.toLowerCase().includes(query) || String(tle.norad ?? '').includes(query);
        if (match) { queryHits++; if (hits.length < MAX_RESULTS) hits.push(i); }
      }
    }

    if (countEl) countEl.textContent = query
      ? `${queryHits} result${queryHits !== 1 ? 's' : ''}`
      : `${groupTotal.toLocaleString()} objects`;

    if (query && queryHits === 0) {
      const empty = document.createElement('div');
      empty.className = 'mob-expl-empty';
      empty.textContent = 'No results';
      contentEl.appendChild(empty);
      return;
    }

    const color = meta.color;
    hits.forEach(i => {
      const tle = tles[i];
      const el  = document.createElement('div');
      el.className = 'mob-sat-row';
      el.innerHTML = `
        <div class="mob-dso-dot" style="background:${color}"></div>
        <span class="mob-sat-name">${tle.name}</span>
        <span class="mob-sat-norad">${tle.norad ?? '—'}</span>`;
      el.addEventListener('pointerdown', (e) => {
        e.stopPropagation(); e.preventDefault();
        closeExplorer();
        if (onSelectSat) onSelectSat(i);
      }, { passive: false });
      contentEl.appendChild(el);
    });

    const shown   = hits.length;
    const total   = query ? queryHits : groupTotal;
    const hasMore = total > shown;
    if (hasMore) {
      const hint = document.createElement('div');
      hint.className = 'mob-expl-hint';
      hint.textContent = `Showing ${shown} of ${total.toLocaleString()} — search to filter`;
      contentEl.appendChild(hint);
    }
  }

  function openExplorer() {
    explorerOpen = true;
    explorer.classList.add('open');
    explBtn.classList.add('open');
    backdrop.classList.add('visible');
    if (layerPanelOpen) { layerPanel.classList.remove('open'); layersBtn.classList.remove('open'); layerPanelOpen = false; }

    if (activeTab === 'satellites' || activeTab === 'debris') {
      renderSatContent(activeTab === 'debris');
    }
  }
  function closeExplorer() {
    explorerOpen = false;
    explorer.classList.remove('open');
    explBtn.classList.remove('open');
    backdrop.classList.remove('visible');
  }

  function toggleLayerPanel() {
    if (layerPanelOpen) {
      layerPanel.classList.remove('open'); layersBtn.classList.remove('open'); layerPanelOpen = false;
    } else {
      if (explorerOpen) closeExplorer();
      layerPanel.classList.add('open'); layersBtn.classList.add('open'); layerPanelOpen = true;
    }
  }

  explBtn.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); e.preventDefault();
    explorerOpen ? closeExplorer() : openExplorer();
  }, { passive: false });

  backdrop.addEventListener('pointerdown', () => closeExplorer(), { passive: true });

  explorer.querySelectorAll('.mob-expl-tab').forEach(tab => {
    tab.addEventListener('pointerdown', (e) => {
      e.stopPropagation(); e.preventDefault();
      activeTab = tab.dataset.tab;
      explorer.querySelectorAll('.mob-expl-tab').forEach(t => t.classList.remove('active'));
      explorer.querySelectorAll('.mob-expl-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      explorer.querySelector(`.mob-expl-content[data-content="${activeTab}"]`)?.classList.add('active');

      const isSat = activeTab === 'satellites' || activeTab === 'debris';
      if (!isSat && searchWrap) searchWrap.classList.add('hidden');
      if (countEl) countEl.textContent = '';

      if (activeTab === 'satellites') renderSatContent(false);
      if (activeTab === 'debris')     renderSatContent(true);
    }, { passive: false });
  });

  explorer.querySelectorAll('.mob-dso-row').forEach(row => {
    row.addEventListener('pointerdown', (e) => {
      e.stopPropagation(); e.preventDefault();
      closeExplorer();
      window.dispatchEvent(new CustomEvent('mob-select-dso', {
        detail: { id: row.dataset.dsoId, cat: row.dataset.dsoCat },
      }));
    }, { passive: false });
  });

  searchInput?.addEventListener('input', () => {
    if (activeTab === 'satellites') renderSatContent(false);
    if (activeTab === 'debris')     renderSatContent(true);
  });
  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { searchInput.value = ''; renderSatContent(activeTab === 'debris'); }
  });

  layersBtn.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); e.preventDefault();
    toggleLayerPanel();
  }, { passive: false });

  layerPanel.querySelectorAll('.mob-planet-chip').forEach(chip => {
    chip.addEventListener('pointerdown', (e) => {
      e.stopPropagation(); e.preventDefault();
      const name = chip.dataset.name;
      window.dispatchEvent(new CustomEvent('mob-fly-planet', { detail: { name } }));
      if (bodyNameEl) bodyNameEl.textContent = name;
    }, { passive: false });
  });

  layerPanel.querySelectorAll('.mob-view-chip').forEach(chip => {
    chip.addEventListener('pointerdown', (e) => {
      e.stopPropagation(); e.preventDefault();
      layerPanel.querySelectorAll('.mob-view-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      window.dispatchEvent(new CustomEvent('mob-view-preset', { detail: { view: chip.dataset.view } }));
    }, { passive: false });
  });

  layerPanel.querySelectorAll('.mob-chip[data-layer]').forEach(chip => {
    chip.addEventListener('pointerdown', (e) => {
      e.stopPropagation(); e.preventDefault();
      const key = chip.dataset.layer;
      layerState[key] = !layerState[key];
      chip.classList.toggle('active', layerState[key]);
      window.dispatchEvent(new CustomEvent('mob-toggle-layer', { detail: { key } }));
    }, { passive: false });
  });

  let ptId = -1, ptX0 = 0, ptY0 = 0, dragged = false;
  canvas.addEventListener('pointerdown', (e) => {
    ptId = e.pointerId; ptX0 = e.clientX; ptY0 = e.clientY; dragged = false;
    if (explorerOpen) closeExplorer();
  }, { passive: true });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== ptId) return;
    if (Math.hypot(e.clientX - ptX0, e.clientY - ptY0) > DRAG_THRESHOLD) dragged = true;
  }, { passive: true });
  canvas.addEventListener('pointerup', (e) => {
    if (e.pointerId !== ptId) return;
    if (!dragged) window.dispatchEvent(new CustomEvent('mob-tap-select', {
      detail: { clientX: e.clientX, clientY: e.clientY },
    }));
  }, { passive: true });
  canvas.addEventListener('pointercancel', () => { ptId = -1; }, { passive: true });

  infoExpandBtn?.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); e.preventDefault();
    infoExpanded = true;
    infoSheet.classList.add('expanded');
    infoExpandBtn.style.display = 'none';
  }, { passive: false });

  infoCollapseBtn?.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); e.preventDefault();
    infoExpanded = false;
    infoSheet.classList.remove('expanded');
    infoExpandBtn.style.display = '';
  }, { passive: false });

  infoCloseBtn?.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); e.preventDefault();
    hideInfo();
    if (bodyNameEl) bodyNameEl.textContent = '';
    window.dispatchEvent(new CustomEvent('mob-tap-select', {
      detail: { clientX: -9999, clientY: -9999 },
    }));
  }, { passive: false });

  function showInfo(data) {
    if (infoName)    infoName.textContent = data.name ?? '—';
    if (infoType)    infoType.textContent = data.type ?? '';
    if (infoStat)    infoStat.textContent = data.stat ?? '';
    if (infoRows)    infoRows.innerHTML   = (data.rows ?? []).map(r => `
      <div class="mob-info-row">
        <span class="mob-info-row-label">${r.label}</span>
        <span class="mob-info-row-val">${r.value}</span>
      </div>`).join('');
    infoExpanded = false;
    infoSheet.classList.remove('expanded');
    if (infoExpandBtn) infoExpandBtn.style.display = data.rows?.length ? '' : 'none';
    infoSheet.classList.add('visible');
  }

  function hideInfo() {
    infoSheet.classList.remove('visible', 'expanded');
    infoExpanded = false;
  }

  function update()            { }
  function updateDate(str)     { if (utcEl)      utcEl.textContent      = str; }
  function updateSatCount(n)   { if (satCountEl) satCountEl.textContent = `${n.toLocaleString()} SAT`; }
  function updateBodyName(str) { if (bodyNameEl) bodyNameEl.textContent = str ?? ''; }
  function updateSpeed()       { }
  function updateScale()       { }

  function dispose() {
    topBar.remove(); explBtn.remove(); explorer.remove();
    backdrop.remove(); bottomBar.remove(); layerPanel.remove(); infoSheet.remove();
    document.body.classList.remove('mobile-mode');
  }

  return { update, updateDate, updateSatCount, updateBodyName,
           updateSpeed, updateScale, showInfo, hideInfo };
}
