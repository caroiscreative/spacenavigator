
import * as THREE from 'three/webgpu';

const CONSTELLATION_CATALOG = {
  AND: { name: 'Andromeda',           origin: 'Ptolemy',              year: '~150 AD', desc: 'The chained princess of Greek myth; contains the Andromeda Galaxy (M31), 2.5 million light-years away.' },
  ANT: { name: 'Antlia',              origin: 'Nicolas de Lacaille',  year: '1756',    desc: 'The air pump; one of 14 southern constellations mapped by Lacaille from the Cape of Good Hope.' },
  APS: { name: 'Apus',                origin: 'Petrus Plancius',      year: '1597',    desc: 'The bird of paradise; introduced by Dutch navigators on their voyages to the East Indies.' },
  AQL: { name: 'Aquila',              origin: 'Ptolemy',              year: '~150 AD', desc: "Zeus's eagle carrying thunderbolts; contains the bright star Altair, 17 light-years away." },
  AQR: { name: 'Aquarius',            origin: 'Ptolemy',              year: '~150 AD', desc: 'The water-bearer; one of the oldest zodiac constellations, recognized by the Babylonians.' },
  ARA: { name: 'Ara',                 origin: 'Ptolemy',              year: '~150 AD', desc: 'The altar where the gods swore allegiance before battling the Titans in Greek mythology.' },
  ARI: { name: 'Aries',               origin: 'Ptolemy',              year: '~150 AD', desc: 'The ram with the golden fleece; the first zodiac sign, once marking the vernal equinox.' },
  AUR: { name: 'Auriga',              origin: 'Ptolemy',              year: '~150 AD', desc: 'The charioteer; contains Capella, a yellow giant and the sixth-brightest star in the night sky.' },
  BOO: { name: 'Boötes',              origin: 'Ptolemy',              year: '~150 AD', desc: 'The herdsman; contains Arcturus, an orange giant and the fourth-brightest star, 37 light-years away.' },
  CAE: { name: 'Caelum',              origin: 'Nicolas de Lacaille',  year: '1756',    desc: 'The engraving chisel; among the smallest and faintest of the 88 modern constellations.' },
  CAM: { name: 'Camelopardalis',      origin: 'Petrus Plancius',      year: '1612',    desc: 'The giraffe; a large but very faint constellation occupying the north polar region of the sky.' },
  CAP: { name: 'Capricornus',         origin: 'Ptolemy',              year: '~150 AD', desc: 'The sea-goat; one of the faintest zodiac constellations with Babylonian roots over 3,000 years old.' },
  CAR: { name: 'Carina',              origin: 'Nicolas de Lacaille',  year: '1756',    desc: 'The keel of the Argo; contains Canopus, the second-brightest star and a beacon for spacecraft navigation.' },
  CAS: { name: 'Cassiopeia',          origin: 'Ptolemy',              year: '~150 AD', desc: 'The vain queen of Ethiopia; her distinctive W-shape is circumpolar from northern latitudes.' },
  CEN: { name: 'Centaurus',           origin: 'Ptolemy',              year: '~150 AD', desc: 'The centaur; contains Alpha Centauri, the nearest star system to our Sun at just 4.37 light-years.' },
  CEP: { name: 'Cepheus',             origin: 'Ptolemy',              year: '~150 AD', desc: 'The king of Ethiopia, husband of Cassiopeia; a circumpolar constellation containing Delta Cephei, prototype of the Cepheid variables.' },
  CET: { name: 'Cetus',               origin: 'Ptolemy',              year: '~150 AD', desc: 'The sea monster; contains the remarkable long-period variable star Mira and the Sun-like star Tau Ceti.' },
  CHA: { name: 'Chamaeleon',          origin: 'Petrus Plancius',      year: '1597',    desc: 'The chameleon; a small southern constellation lying near the south celestial pole.' },
  CIR: { name: 'Circinus',            origin: 'Nicolas de Lacaille',  year: '1756',    desc: 'The drawing compass; the third-smallest constellation, tucked between Centaurus and the Southern Cross.' },
  CMA: { name: 'Canis Major',         origin: 'Ptolemy',              year: '~150 AD', desc: "Orion's greater hunting dog; contains Sirius, the brightest star in the entire night sky at −1.46 magnitude." },
  CMI: { name: 'Canis Minor',         origin: 'Ptolemy',              year: '~150 AD', desc: 'The lesser dog; contains Procyon, the eighth-brightest star, just 11.5 light-years from Earth.' },
  CNC: { name: 'Cancer',              origin: 'Ptolemy',              year: '~150 AD', desc: 'The crab; the faintest zodiac constellation, but home to the beautiful Beehive star cluster (M44).' },
  COL: { name: 'Columba',             origin: 'Petrus Plancius',      year: '1592',    desc: 'The dove sent by Noah to find dry land after the Great Flood, released from the Ark.' },
  COM: { name: 'Coma Berenices',      origin: 'Tycho Brahe',          year: '1602',    desc: "The hair of Queen Berenice II of Egypt, who sacrificed her locks to ensure her husband's safe return from war." },
  CRA: { name: 'Corona Australis',    origin: 'Ptolemy',              year: '~150 AD', desc: 'The southern crown; a delicate arc of faint stars lying near the foot of Sagittarius.' },
  CRB: { name: 'Corona Borealis',     origin: 'Ptolemy',              year: '~150 AD', desc: "The northern crown of Ariadne, placed in the sky by Dionysus to commemorate their wedding." },
  CRT: { name: 'Crater',              origin: 'Ptolemy',              year: '~150 AD', desc: "Apollo's cup, placed in the sky as a reward for the raven Corvus who rested on the back of Hydra." },
  CRU: { name: 'Crux',                origin: 'Petrus Plancius',      year: '1597',    desc: 'The Southern Cross; the smallest of the 88 constellations, used for celestial navigation in the southern hemisphere.' },
  CRV: { name: 'Corvus',              origin: 'Ptolemy',              year: '~150 AD', desc: "The raven punished by Apollo for bringing bad news; its cup was placed just out of reach on Hydra's back." },
  CVN: { name: 'Canes Venatici',      origin: 'Johannes Hevelius',    year: '1690',    desc: "The hunting dogs of Boötes; contains the Whirlpool Galaxy (M51) and the rich globular cluster M3." },
  CYG: { name: 'Cygnus',              origin: 'Ptolemy',              year: '~150 AD', desc: 'The swan; contains Deneb, the Northern Cross, and Cygnus X-1 — the first stellar black hole candidate identified.' },
  DEL: { name: 'Delphinus',           origin: 'Ptolemy',              year: '~150 AD', desc: 'The dolphin that persuaded the sea-nymph Amphitrite to marry Poseidon; a small but distinctive constellation.' },
  DOR: { name: 'Dorado',              origin: 'Petrus Plancius',      year: '1597',    desc: 'The goldfish; contains most of the Large Magellanic Cloud, a satellite galaxy of the Milky Way.' },
  DRA: { name: 'Draco',               origin: 'Ptolemy',              year: '~150 AD', desc: 'The dragon guarding the golden apples of the Hesperides; its star Thuban was the north pole star around 2700 BC.' },
  EQU: { name: 'Equuleus',            origin: 'Ptolemy',              year: '~150 AD', desc: "The little horse; the second-smallest constellation, wedged between Pegasus and Aquila in the sky." },
  ERI: { name: 'Eridanus',            origin: 'Ptolemy',              year: '~150 AD', desc: 'The celestial river; the sixth-largest constellation, winding from near Orion all the way to the south polar star Achernar.' },
  FOR: { name: 'Fornax',              origin: 'Nicolas de Lacaille',  year: '1756',    desc: "The chemical furnace; contains the Fornax Galaxy Cluster, one of the nearest galaxy clusters to Earth." },
  GEM: { name: 'Gemini',              origin: 'Ptolemy',              year: '~150 AD', desc: 'The twins Castor and Pollux; the radiant of the prolific Geminid meteor shower in December.' },
  GRU: { name: 'Grus',                origin: 'Petrus Plancius',      year: '1597',    desc: 'The crane; introduced by Dutch navigators Frederick de Houtman and Pieter Dirkszoon Keyser.' },
  HER: { name: 'Hercules',            origin: 'Ptolemy',              year: '~150 AD', desc: 'The great hero of twelve labors; the fifth-largest constellation, home to the magnificent Great Globular Cluster M13.' },
  HOR: { name: 'Horologium',          origin: 'Nicolas de Lacaille',  year: '1756',    desc: "The pendulum clock; named in honor of Christiaan Huygens's landmark invention of 1656." },
  HYA: { name: 'Hydra',               origin: 'Ptolemy',              year: '~150 AD', desc: 'The water snake; the largest constellation in the sky by area, stretching over 100 degrees of sky.' },
  HYI: { name: 'Hydrus',              origin: 'Petrus Plancius',      year: '1597',    desc: 'The little water snake; a southern constellation lying between the Large and Small Magellanic Clouds.' },
  IND: { name: 'Indus',               origin: 'Petrus Plancius',      year: '1597',    desc: 'The Indian; a faint southern constellation representing an indigenous American with a spear and arrows.' },
  LAC: { name: 'Lacerta',             origin: 'Johannes Hevelius',    year: '1690',    desc: 'The lizard; a small constellation between Cygnus and Andromeda, set in a rich Milky Way star field.' },
  LEO: { name: 'Leo',                 origin: 'Ptolemy',              year: '~150 AD', desc: 'The lion; its sickle-shaped head is one of the most recognizable asterisms among the zodiac constellations.' },
  LEP: { name: 'Lepus',               origin: 'Ptolemy',              year: '~150 AD', desc: "The hare crouching at Orion's feet, perpetually pursued by the hunter's dogs Canis Major and Minor." },
  LIB: { name: 'Libra',               origin: 'Ptolemy',              year: '~150 AD', desc: 'The scales of justice held by Virgo; the only inanimate object among the twelve zodiac constellations.' },
  LMI: { name: 'Leo Minor',           origin: 'Johannes Hevelius',    year: '1690',    desc: 'The little lion; a faint constellation introduced by Hevelius to fill the gap between Leo and Ursa Major.' },
  LUP: { name: 'Lupus',               origin: 'Ptolemy',              year: '~150 AD', desc: 'The wolf; an ancient southern constellation bordering Centaurus and Scorpius on the Milky Way.' },
  LYN: { name: 'Lynx',                origin: 'Johannes Hevelius',    year: '1690',    desc: '"You must have the eyes of a lynx to see it" — Hevelius named this dim constellation for its elusive stars.' },
  LYR: { name: 'Lyra',                origin: 'Ptolemy',              year: '~150 AD', desc: "Orpheus's lyre; contains Vega (fifth-brightest star in the sky) and the Ring Nebula M57." },
  MEN: { name: 'Mensa',               origin: 'Nicolas de Lacaille',  year: '1756',    desc: "Table Mountain above Cape Town, where Lacaille conducted his southern sky survey from 1750–1754." },
  MIC: { name: 'Microscopium',        origin: 'Nicolas de Lacaille',  year: '1756',    desc: "The microscope; named after Antonie van Leeuwenhoek's revolutionary 17th-century invention." },
  MON: { name: 'Monoceros',           origin: 'Petrus Plancius',      year: '1612',    desc: 'The unicorn; contains the Rosette Nebula, the Christmas Tree Cluster, and the Hubble Variable Nebula.' },
  MUS: { name: 'Musca',               origin: 'Petrus Plancius',      year: '1597',    desc: 'The fly; a small but conspicuous southern constellation lying directly below the Southern Cross.' },
  NOR: { name: 'Norma',               origin: 'Nicolas de Lacaille',  year: '1756',    desc: "The carpenter's square; set in a brilliant stretch of the Milky Way, rich in star clusters." },
  OCT: { name: 'Octans',              origin: 'Nicolas de Lacaille',  year: '1756',    desc: "The octant; contains the south celestial pole — unlike the north, there is no bright southern pole star." },
  OPH: { name: 'Ophiuchus',           origin: 'Ptolemy',              year: '~150 AD', desc: 'The serpent-bearer; sometimes called the 13th zodiac constellation; contains more Messier globular clusters than any other.' },
  ORI: { name: 'Orion',               origin: 'Ptolemy',              year: '~150 AD', desc: 'The hunter; contains the red supergiant Betelgeuse, blue supergiant Rigel, and the Orion Nebula M42.' },
  PAV: { name: 'Pavo',                origin: 'Petrus Plancius',      year: '1597',    desc: 'The peacock; a southern constellation representing the Indian peacock, introduced from Dutch voyages.' },
  PEG: { name: 'Pegasus',             origin: 'Ptolemy',              year: '~150 AD', desc: "The winged horse born from Medusa's blood; its Great Square is a landmark of autumn skies." },
  PER: { name: 'Perseus',             origin: 'Ptolemy',              year: '~150 AD', desc: 'The hero who slew Medusa; contains the Double Cluster (NGC 869/884) and the eclipsing binary Algol.' },
  PHE: { name: 'Phoenix',             origin: 'Petrus Plancius',      year: '1597',    desc: 'The mythical firebird that rises reborn from its own ashes; a southern constellation introduced by Dutch navigators.' },
  PIC: { name: 'Pictor',              origin: 'Nicolas de Lacaille',  year: '1756',    desc: "The painter's easel; contains Beta Pictoris, a young star famous for its edge-on protoplanetary disk." },
  PSA: { name: 'Piscis Austrinus',    origin: 'Ptolemy',              year: '~150 AD', desc: 'The southern fish drinking the water poured by Aquarius; contains Fomalhaut, the loneliest bright star.' },
  PSC: { name: 'Pisces',              origin: 'Ptolemy',              year: '~150 AD', desc: 'The two fish tied by a cord; the last zodiac sign, representing Aphrodite and Eros escaped from Typhon.' },
  PUP: { name: 'Puppis',              origin: 'Nicolas de Lacaille',  year: '1756',    desc: "The stern of Jason's ship Argo; one of three constellations Lacaille split from the ancient Argo Navis." },
  PYX: { name: 'Pyxis',               origin: 'Nicolas de Lacaille',  year: '1756',    desc: "The ship's compass; originally depicted as the mast of Argo Navis before Lacaille subdivided it." },
  RET: { name: 'Reticulum',           origin: 'Nicolas de Lacaille',  year: '1756',    desc: "The reticle eyepiece; named after the crosshair instrument Lacaille used to measure star positions precisely." },
  SCL: { name: 'Sculptor',            origin: 'Nicolas de Lacaille',  year: '1756',    desc: "The sculptor's studio; contains the Sculptor Galaxy (NGC 253), a magnificent edge-on spiral 11 million light-years away." },
  SCO: { name: 'Scorpius',            origin: 'Ptolemy',              year: '~150 AD', desc: 'The scorpion that slew Orion; contains the red supergiant Antares and the most spectacular Milky Way star fields.' },
  SCT: { name: 'Scutum',              origin: 'Johannes Hevelius',    year: '1684',    desc: "The shield of King John III Sobieski of Poland; home to the dazzling Wild Duck Cluster (M11)." },
  SER: { name: 'Serpens',             origin: 'Ptolemy',              year: '~150 AD', desc: 'The serpent held by Ophiuchus; unique among the 88 constellations in being divided into two separate regions.' },
  SEX: { name: 'Sextans',             origin: 'Johannes Hevelius',    year: '1690',    desc: "The sextant; named after the instrument Hevelius used until his entire observatory burned down in 1679." },
  SGE: { name: 'Sagitta',             origin: 'Ptolemy',              year: '~150 AD', desc: 'The arrow; one of the smallest constellations, yet rich in Milky Way background stars.' },
  SGR: { name: 'Sagittarius',         origin: 'Ptolemy',              year: '~150 AD', desc: 'The archer pointing toward the galactic center; the Teapot asterism sits atop the densest star clouds in the Milky Way.' },
  TAU: { name: 'Taurus',              origin: 'Ptolemy',              year: '~150 AD', desc: 'The bull; contains the Pleiades and Hyades clusters, and the Crab Nebula — remnant of a supernova seen in 1054 AD.' },
  TEL: { name: 'Telescopium',         origin: 'Nicolas de Lacaille',  year: '1756',    desc: "The telescope; a tribute to Galileo Galilei's instrument that revolutionized our understanding of the universe." },
  TRA: { name: 'Triangulum Australe', origin: 'Petrus Plancius',      year: '1597',    desc: 'The southern triangle; a compact, bright triangle of stars near Alpha Centauri, easy to recognize.' },
  TRI: { name: 'Triangulum',          origin: 'Ptolemy',              year: '~150 AD', desc: 'The triangle; contains the Triangulum Galaxy (M33), the third-largest member of the Local Group of galaxies.' },
  TUC: { name: 'Tucana',              origin: 'Petrus Plancius',      year: '1597',    desc: 'The toucan; contains the Small Magellanic Cloud and 47 Tucanae, one of the most spectacular globular clusters.' },
  UMA: { name: 'Ursa Major',          origin: 'Ptolemy',              year: '~150 AD', desc: "The great bear; its Big Dipper asterism is the most recognized star pattern in the northern sky." },
  UMI: { name: 'Ursa Minor',          origin: 'Ptolemy',              year: '~150 AD', desc: 'The little bear; its tail star Polaris is currently less than 1° from the north celestial pole.' },
  VEL: { name: 'Vela',                origin: 'Nicolas de Lacaille',  year: '1756',    desc: "The sails of the Argo; contains the Vela Supernova Remnant and a radio pulsar discovered in 1968." },
  VIR: { name: 'Virgo',               origin: 'Ptolemy',              year: '~150 AD', desc: 'The maiden; the largest zodiac constellation, and host to the Virgo Galaxy Cluster with over 1,300 galaxies.' },
  VOL: { name: 'Volans',              origin: 'Petrus Plancius',      year: '1597',    desc: 'The flying fish; a small southern constellation introduced alongside other exotic southern creatures.' },
  VUL: { name: 'Vulpecula',           origin: 'Johannes Hevelius',    year: '1690',    desc: 'The little fox; contains the Dumbbell Nebula (M27) and PSR B1919+21, the first pulsar ever discovered (1967).' },
};

export async function createConstellations(scene, hipMap) {
  let text;
  try {
    const res = await fetch('/data/constellation-lines-hip.utf8');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.text();
  } catch (err) {
    console.warn('[Constellations] Could not load constellation data:', err.message);
    return { lines: null, toggle: () => {}, isVisible: () => false, pick: () => null };
  }

  const { posArray, segCount, missingHips, constStars, constSegments } = parseConstellations(text, hipMap);

  if (missingHips > 0) {
    console.warn(`[Constellations] ${missingHips} HIP IDs not found in catalog (normal for faint/non-HYG stars)`);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

  const mat = new THREE.LineBasicMaterial({
    color:       0x4488cc,   // cool blue
    transparent: true,
    opacity:     0.28,
    depthWrite:  false,
  });

  const lines = new THREE.LineSegments(geo, mat);
  lines.name = 'constellations';
  lines.visible = true;
  scene.add(lines);

  console.log(`[Constellations] ${segCount} segments, ${constStars.size} constellations indexed for hover`);

  function isVisible() { return lines.visible; }

  const HL_MAX_FLOATS = 991 * 2 * 3;   // 991 segs × 2 pts × 3 components
  const hlBuf  = new Float32Array(HL_MAX_FLOATS);
  const hlAttr = new THREE.BufferAttribute(hlBuf, 3);
  hlAttr.setUsage(THREE.DynamicDrawUsage);

  const hlGeo = new THREE.BufferGeometry();
  hlGeo.setAttribute('position', hlAttr);
  hlGeo.setDrawRange(0, 0);   // draw nothing until a constellation is hovered

  const hlMat = new THREE.LineBasicMaterial({
    color:       0xa8ccee,   // brighter, cooler blue
    transparent: true,
    opacity:     0.85,
    depthWrite:  false,
    blending:    THREE.AdditiveBlending,
  });

  const hlMesh = new THREE.LineSegments(hlGeo, hlMat);
  hlMesh.name    = 'constellation-highlight';
  hlMesh.visible = false;
  scene.add(hlMesh);

  let _currentHighlight = null;

  function highlight(abbr) {
    if (abbr === _currentHighlight) return;
    _currentHighlight = abbr;

    if (!abbr || !lines.visible) {
      hlMesh.visible = false;
      return;
    }

    const segs = constSegments.get(abbr);
    if (!segs || segs.length === 0) {
      hlMesh.visible = false;
      return;
    }

    hlBuf.set(segs);
    hlAttr.needsUpdate = true;
    hlGeo.setDrawRange(0, segs.length / 3);   // vertices = floats / 3
    hlGeo.computeBoundingSphere();
    hlMesh.visible = true;
  }

  function toggle() {
    lines.visible = !lines.visible;
    if (!lines.visible) {
      hlMesh.visible = false;
      _currentHighlight = null;
      document.getElementById('constellation-hover')?.classList.remove('visible');
    }
    console.log(`[Constellations] ${lines.visible ? 'visible' : 'hidden'}`);
  }

  const _pickRay = new THREE.Raycaster();
  const _PICK_COS = Math.cos(2 * Math.PI / 180);    // cos(2°) ≈ 0.9994 — 1° wider selection area

  function pick(ndcX, ndcY, camera) {
    _pickRay.setFromCamera({ x: ndcX, y: ndcY }, camera);
    const dir = _pickRay.ray.direction;   // unit vector, world space

    let bestDot  = _PICK_COS;   // must exceed threshold
    let bestAbbr = null;

    for (const [abbr, stars] of constStars) {
      for (const star of stars) {
        const d = dir.dot(star);
        if (d > bestDot) {
          bestDot  = d;
          bestAbbr = abbr;
        }
      }
    }

    if (!bestAbbr) return null;
    const info = CONSTELLATION_CATALOG[bestAbbr];
    return info ? { abbr: bestAbbr, ...info } : null;
  }

  return { lines, toggle, isVisible, pick, highlight };
}

function parseConstellations(text, hipMap) {
  const posArray  = new Float32Array(991 * 2 * 3);
  let   writeIdx  = 0;
  let   segCount  = 0;
  let   missingHips = 0;

  const seenHips    = new Map();  // abbr → Set<number>
  const constStars  = new Map();  // abbr → THREE.Vector3[]
  const constSegBufs = new Map(); // abbr → number[]

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || !line.includes('=')) continue;

    const eqIdx    = line.indexOf('=');
    const abbr     = line.slice(0, eqIdx).trim().toUpperCase();
    const chainPart = line.slice(eqIdx + 1);

    if (!constStars.has(abbr)) {
      constStars.set(abbr, []);
      seenHips.set(abbr, new Set());
      constSegBufs.set(abbr, []);
    }
    const stars   = constStars.get(abbr);
    const hipSeen = seenHips.get(abbr);
    const segBuf  = constSegBufs.get(abbr);

    const groups = chainPart.match(/\[([^\]]+)\]/g);
    if (!groups) continue;

    for (const group of groups) {
      const hipIds = group.slice(1, -1)
        .split(',')
        .map(s => parseInt(s.trim(), 10));

      for (let i = 0; i < hipIds.length - 1; i++) {
        const h1 = hipIds[i];
        const h2 = hipIds[i + 1];
        const p1 = hipMap.get(h1);
        const p2 = hipMap.get(h2);

        if (!p1) { missingHips++; continue; }
        if (!p2) { missingHips++; continue; }

        posArray[writeIdx++] = p1.nx;
        posArray[writeIdx++] = p1.ny;
        posArray[writeIdx++] = p1.nz;
        posArray[writeIdx++] = p2.nx;
        posArray[writeIdx++] = p2.ny;
        posArray[writeIdx++] = p2.nz;
        segCount++;

        segBuf.push(p1.nx, p1.ny, p1.nz, p2.nx, p2.ny, p2.nz);

        if (!hipSeen.has(h1)) {
          hipSeen.add(h1);
          stars.push(new THREE.Vector3(p1.nx, p1.ny, p1.nz).normalize());
        }
        if (!hipSeen.has(h2)) {
          hipSeen.add(h2);
          stars.push(new THREE.Vector3(p2.nx, p2.ny, p2.nz).normalize());
        }
      }
    }
  }

  const constSegments = new Map();
  for (const [abbr, buf] of constSegBufs) {
    constSegments.set(abbr, new Float32Array(buf));
  }

  return {
    posArray:  posArray.subarray(0, writeIdx),
    segCount,
    missingHips,
    constStars,
    constSegments,
  };
}
