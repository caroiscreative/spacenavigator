
const NAVY   = '#0A1628';
const CYAN   = '#4FC3F7';
const CYAN_D = '#1E5B7A';   // darker cyan for borders
const SKY    = '#90CAF9';
const GREEN  = '#69F0AE';
const RED    = '#EF5350';
const ORANGE = '#FF6D00';
const YELLOW = '#FFD600';
const PURPLE = '#CE93D8';

const TEXT_DARK = '#1A1A2E';
const TEXT_MID  = '#444466';
const TEXT_DIM  = '#888899';

const RISK_COLOR = {
  critical: RED,
  warning:  ORANGE,
  caution:  YELLOW,
};

function statTile(label, value, color) {
  return {
    table: {
      widths: ['*'],
      body: [[{
        stack: [
          { text: value, fontSize: 20, bold: true, color, margin: [0, 0, 0, 2] },
          { text: label, fontSize: 7.5, color: TEXT_DIM, characterSpacing: 0.8 },
        ],
        fillColor: '#EEF3F8',
        margin: [10, 10, 10, 10],
      }]],
    },
    layout: 'noBorders',
  };
}

function sectionBar(text) {
  return {
    table: {
      widths: ['*'],
      body: [[{
        text: text.toUpperCase(),
        fontSize: 9,
        bold: true,
        color: CYAN,
        characterSpacing: 1.2,
        fillColor: NAVY,
        margin: [10, 6, 10, 6],
      }]],
    },
    layout: 'noBorders',
    marginTop: 10,
    marginBottom: 6,
  };
}

function weatherTable(weather) {
  const kpNum   = weather?.kp   != null ? Number(weather.kp).toFixed(1) : '—';
  const kpClass = weather?.kpClass ?? 'quiet';
  const kpColor = kpClass === 'severe'    ? RED
                : kpClass === 'storm'     ? ORANGE
                : kpClass === 'unsettled' ? YELLOW
                : GREEN;

  const flare   = weather?.flareClass && weather.flareClass !== '—'
                  ? `${weather.flareClass}${weather.flareIntensity != null ? weather.flareIntensity.toFixed(1) : ''}`
                  : '—';

  const updated = weather?.lastUpdate
                  ? new Date(weather.lastUpdate).toISOString().replace('T', '  ').substring(0, 19) + ' UTC'
                  : 'No data';

  const rows = [
    ['Kp Index',       { text: `${kpNum}  (${kpClass.toUpperCase()})`, color: kpColor, bold: true }],
    ['Solar Flare',    flare],
    ['Active Alerts',  weather?.alertCount != null ? String(weather.alertCount) : '—'],
    ['Last Updated',   updated],
  ];

  return {
    table: {
      widths: [120, '*'],
      body: rows.map(([label, val], i) => [
        {
          text: label,
          fontSize: 8.5,
          color: TEXT_MID,
          fillColor: i % 2 === 0 ? '#F4F8FC' : '#FFFFFF',
          margin: [8, 5, 8, 5],
        },
        {
          ...(typeof val === 'string'
            ? { text: val, fontSize: 8.5, color: TEXT_DARK }
            : { ...val, fontSize: 8.5 }),
          fillColor: i % 2 === 0 ? '#F4F8FC' : '#FFFFFF',
          margin: [8, 5, 8, 5],
        },
      ]),
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0,
      hLineColor: () => '#D8E4EC',
    },
  };
}

function conjunctionTable(conjunctions) {
  if (!conjunctions || conjunctions.length === 0) {
    return {
      text: 'No conjunction data available. Enable risk overlay (G) and wait for a scan cycle.',
      fontSize: 8.5,
      color: TEXT_DIM,
      italics: true,
      margin: [4, 4, 4, 4],
    };
  }

  const topN = conjunctions.slice(0, 10);

  const headerRow = ['RISK', 'OBJECT A', 'OBJECT B', 'DIST (KM)'].map(h => ({
    text: h,
    fontSize: 8,
    bold: true,
    color: CYAN,
    fillColor: NAVY,
    characterSpacing: 0.8,
    margin: [6, 5, 6, 5],
  }));

  const dataRows = topN.map((c, i) => {
    const riskColor = RISK_COLOR[c.risk] ?? YELLOW;
    const altBg     = i % 2 === 0 ? '#FFFFFF' : '#F4F8FC';
    return [
      {
        text: (c.risk ?? 'caution').toUpperCase(),
        fontSize: 8,
        bold: true,
        color: riskColor,
        fillColor: altBg,
        margin: [6, 5, 6, 5],
      },
      {
        text: c.nameA ?? '—',
        fontSize: 8,
        color: TEXT_DARK,
        fillColor: altBg,
        margin: [6, 5, 6, 5],
      },
      {
        text: c.nameB ?? '—',
        fontSize: 8,
        color: TEXT_DARK,
        fillColor: altBg,
        margin: [6, 5, 6, 5],
      },
      {
        text: c.distKm != null ? c.distKm.toFixed(1) : '—',
        fontSize: 8,
        color: TEXT_DARK,
        alignment: 'right',
        fillColor: altBg,
        margin: [6, 5, 6, 5],
      },
    ];
  });

  return {
    table: {
      widths: [55, '*', '*', 55],
      body: [headerRow, ...dataRows],
    },
    layout: {
      hLineWidth: (i) => (i === 0 || i === 1) ? 0 : 0.5,
      vLineWidth: () => 0,
      hLineColor: () => '#D8E4EC',
    },
  };
}

function distributionTable(stats) {
  const total = stats.total || 1;   // avoid divide-by-zero

  const rows = [
    ['Debris / Rocket Bodies', stats.debris,   RED],
    ['LEO (General)',          stats.leo,      CYAN],
    ['Starlink',               stats.starlink, SKY],
    ['GEO (Geostationary)',    stats.geo,      PURPLE],
    ['OneWeb',                 stats.oneweb,   GREEN],
    ['MEO (Navigation)',       stats.meo,      '#81C784'],
    ['Space Stations',         stats.stations, '#FFB74D'],
  ];

  const headerRow = ['CATEGORY', 'COUNT', '% OF TOTAL'].map(h => ({
    text: h,
    fontSize: 8,
    bold: true,
    color: CYAN,
    fillColor: NAVY,
    characterSpacing: 0.8,
    margin: [8, 5, 8, 5],
  }));

  const dataRows = rows.map(([label, count, color], i) => {
    const n    = count ?? 0;
    const pct  = ((n / total) * 100).toFixed(1);
    const bg   = i % 2 === 0 ? '#FFFFFF' : '#F4F8FC';
    return [
      { text: label,            fontSize: 8.5, color: TEXT_DARK, fillColor: bg, margin: [8, 5, 8, 5] },
      { text: n.toLocaleString(), fontSize: 8.5, color, bold: true, fillColor: bg, margin: [8, 5, 8, 5], alignment: 'right' },
      { text: `${pct}%`,        fontSize: 8.5, color: TEXT_MID, fillColor: bg, margin: [8, 5, 8, 5], alignment: 'right' },
    ];
  });

  dataRows.push([
    { text: 'TOTAL', fontSize: 8.5, bold: true, color: TEXT_DARK, fillColor: '#E8F4FD', margin: [8, 5, 8, 5] },
    { text: total.toLocaleString(), fontSize: 8.5, bold: true, color: TEXT_DARK, fillColor: '#E8F4FD', margin: [8, 5, 8, 5], alignment: 'right' },
    { text: '100.0%', fontSize: 8.5, bold: true, color: TEXT_MID, fillColor: '#E8F4FD', margin: [8, 5, 8, 5], alignment: 'right' },
  ]);

  return {
    table: {
      widths: ['*', 65, 65],
      body: [headerRow, ...dataRows],
    },
    layout: {
      hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? 0 : 0.5,
      vLineWidth: () => 0,
      hLineColor: () => '#D8E4EC',
    },
  };
}

export function buildOrbitalRiskDoc({ screenshot, stats, conjunctions, weather, simDate }) {
  const now     = new Date();
  const genDate = now.toISOString().replace('T', '  ').substring(0, 19) + ' UTC';

  return {
    pageSize:    'A4',
    pageMargins: [32, 32, 32, 44],

    defaultStyle: {
      font:     'Roboto',
      fontSize: 9,
      color:    TEXT_DARK,
    },

    footer: (currentPage, pageCount) => ({
      columns: [
        {
          text: 'Data: CelesTrak TLE Catalog  ·  NOAA SWPC  ·  NASA SDO  ·  HYG Star Catalog',
          fontSize: 7,
          color: TEXT_DIM,
          margin: [32, 0, 0, 0],
        },
        {
          text: `SpaceNavigator v0.1.0  ·  Page ${currentPage} of ${pageCount}`,
          fontSize: 7,
          color: TEXT_DIM,
          alignment: 'right',
          margin: [0, 0, 32, 0],
        },
      ],
      margin: [0, 8, 0, 0],
    }),

    content: [

      {
        table: {
          widths: ['*'],
          body: [[{
            stack: [
              {
                columns: [
                  {
                    stack: [
                      { text: 'SPACENAVIGATOR', fontSize: 18, bold: true, color: CYAN, characterSpacing: 2, margin: [0, 0, 0, 3] },
                      { text: 'ORBITAL SITUATIONAL REPORT', fontSize: 10, color: SKY, characterSpacing: 3, margin: [0, 0, 0, 6] },
                    ],
                    width: '*',
                  },
                  {
                    stack: [
                      { text: 'GENERATED',  fontSize: 7.5, color: CYAN_D, characterSpacing: 0.8 },
                      { text: genDate,      fontSize: 8, color: '#6BAED6', margin: [0, 1, 0, 6] },
                      { text: 'SIM TIME',   fontSize: 7.5, color: CYAN_D, characterSpacing: 0.8 },
                      { text: simDate,      fontSize: 8, color: '#6BAED6', margin: [0, 1, 0, 0] },
                    ],
                    width: 170,
                    alignment: 'right',
                  },
                ],
              },
            ],
            fillColor: NAVY,
            margin: [16, 12, 16, 12],
          }]],
        },
        layout: 'noBorders',
        marginBottom: 12,
      },

      screenshot
        ? { image: screenshot, width: 531, margin: [0, 0, 0, 12] }
        : {
            table: {
              widths: ['*'],
              body: [[{
                text: '[Scene capture unavailable — canvas screenshot could not be taken]',
                fontSize: 8, color: TEXT_DIM, italics: true,
                fillColor: '#EEF3F8', margin: [12, 20, 12, 20], alignment: 'center',
              }]],
            },
            layout: 'noBorders',
            marginBottom: 12,
          },

      {
        columns: [
          statTile('TOTAL OBJECTS',  (stats.total   ?? 0).toLocaleString(), TEXT_DARK),
          statTile('ACTIVE SATS',    (stats.active  ?? 0).toLocaleString(), CYAN),
          statTile('DEBRIS',         (stats.debris  ?? 0).toLocaleString(), RED),
          statTile('SPACE STATIONS', (stats.stations ?? 0).toString(),      PURPLE),
        ],
        columnGap: 8,
        marginBottom: 4,
      },

      sectionBar('☀  Space Weather'),
      weatherTable(weather),

      { text: '', pageBreak: 'after' },

      {
        table: {
          widths: ['*'],
          body: [[{
            text: 'SPACENAVIGATOR  ·  CONTINUED',
            fontSize: 8, bold: false, color: CYAN_D, characterSpacing: 1.5,
            fillColor: NAVY,
            margin: [10, 5, 10, 5],
          }]],
        },
        layout: 'noBorders',
        marginBottom: 8,
      },

      sectionBar('⚡  Conjunction Risk — Top Close Approaches'),
      conjunctionTable(conjunctions),

      { text: '', marginTop: 4 },

      sectionBar('🛰  Orbital Distribution by Category'),
      distributionTable(stats),

    ],
  };
}
