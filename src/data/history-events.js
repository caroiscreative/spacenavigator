
export const EVENT_CATEGORIES = {
  launch:       { color: '#4FC3F7', label: 'Launch / Mission' },
  debris:       { color: '#EF5350', label: 'Debris Event' },
  astronomy:    { color: '#FFD600', label: 'Astronomy Discovery' },
  interstellar: { color: '#CE93D8', label: 'Interstellar Object' },
  milestone:    { color: '#69F0AE', label: 'Historic Milestone' },
};

export const HISTORY_EVENTS = [

  { id: 'sputnik',       date: '1957-10-04', year: 1957, category: 'launch',
    icon: '🛰', title: 'Sputnik 1',
    detail: "First artificial satellite. The Space Age begins. 83.6 kg sphere, 58cm diameter. Transmitted for 21 days before batteries died. Reentered atmosphere Jan 4, 1958." },

  { id: 'sputnik2',      date: '1957-11-03', year: 1957, category: 'launch',
    icon: '🐕', title: 'Sputnik 2 — Laika',
    detail: "First living creature in orbit. Laika, a stray dog, survived 7 hours in space. The capsule orbited Earth for 5 months before reentry." },

  { id: 'explorer1',     date: '1958-02-01', year: 1958, category: 'launch',
    icon: '🛰', title: 'Explorer 1 — Van Allen belts',
    detail: "First US satellite. Its instruments discovered the Van Allen radiation belts surrounding Earth — first major scientific discovery of the Space Age." },

  { id: 'gagarin',       date: '1961-04-12', year: 1961, category: 'milestone',
    icon: '👨‍🚀', title: 'Yuri Gagarin — First human in space',
    detail: "Vostok 1. 108 minutes, one orbit. Gagarin's 'Poyekhali!' ('Let's go!') — the most famous words in space history. He landed by parachute 7km from the capsule." },

  { id: 'telstar',       date: '1962-07-10', year: 1962, category: 'launch',
    icon: '📡', title: 'Telstar 1 — First live transatlantic TV',
    detail: "First active communications satellite. Relayed the first live transatlantic television pictures between the US and Europe." },

  { id: 'apollo11',      date: '1969-07-20', year: 1969, category: 'milestone',
    icon: '🌙', title: 'Apollo 11 — First Moon landing',
    detail: "'That's one small step for man, one giant leap for mankind.' Neil Armstrong and Buzz Aldrin landed in the Sea of Tranquility. 382 kg of lunar samples returned across all Apollo missions." },

  { id: 'skylab',        date: '1973-05-14', year: 1973, category: 'launch',
    icon: '🏠', title: 'Skylab — First US space station',
    detail: "Three crews lived aboard Skylab for a combined 171 days. The station reentered uncontrolled in 1979, scattering debris across Western Australia." },

  { id: 'kessler',       date: '1978-06-01', year: 1978, category: 'milestone',
    icon: '⚠️', title: 'Kessler Syndrome paper published',
    detail: "Donald Kessler and Burton Cour-Palais publish 'Collision Frequency of Artificial Satellites.' The paper predicts a cascade where debris creates more debris — an uncontrolled chain reaction. A warning largely ignored for decades." },

  { id: 'solwind',       date: '1985-09-13', year: 1985, category: 'debris',
    icon: '💥', title: 'US ASAT test — P78-1 Solwind',
    detail: "First successful US direct-ascent ASAT test. The F-15 fighter-launched missile destroyed the Solwind solar observation satellite at 555 km altitude, creating 285 tracked fragments." },

  { id: 'hubble',        date: '1990-04-24', year: 1990, category: 'launch',
    icon: '🔭', title: 'Hubble Space Telescope launch',
    detail: "The most impactful scientific instrument ever built. Revealed the age of the universe (~13.8 Gy), deep field images containing thousands of galaxies, and confirmed the accelerating expansion of the universe." },

  { id: 'iss_start',     date: '1998-11-20', year: 1998, category: 'launch',
    icon: '🏗', title: 'ISS construction begins — Zarya module',
    detail: "The first module of the International Space Station. 16 nations, 110 launches, and 30 years of continuous habitation. The largest structure ever assembled in space." },

  { id: 'iss_habitation',date: '2000-11-02', year: 2000, category: 'milestone',
    icon: '👨‍🚀', title: 'ISS — Continuous human presence begins',
    detail: "Expedition 1 docks at the ISS. Humanity has maintained uninterrupted human presence in space ever since — over 24 years and counting." },

  { id: 'fengyun',       date: '2007-01-11', year: 2007, category: 'debris',
    icon: '💥', title: "China ASAT test — Fengyun-1C destroyed",
    detail: "China destroys its own Fengyun-1C weather satellite at 865 km altitude using a KT-2 missile. Creates 3,500+ trackable fragments and an estimated 150,000+ pieces over 1 cm — the single largest debris creation event in history. Fragments will remain in orbit for centuries." },

  { id: 'phoenix',       date: '2007-05-25', year: 2007, category: 'launch',
    icon: '🔴', title: 'Phoenix lander — Mars north pole',
    detail: "NASA Phoenix discovers water ice just below the Martian surface at the north pole. First direct confirmation of liquid water on Mars in the past." },

  { id: 'cosmos_iridium', date: '2009-02-10', year: 2009, category: 'debris',
    icon: '💥', title: 'Cosmos 2251 × Iridium 33 collision',
    detail: "The first-ever accidental collision between two intact satellites. The 950 kg Iridium 33 communications satellite struck the 900 kg decommissioned Russian Cosmos 2251 at 42,000 km/h above Siberia at 789 km altitude. Generated 2,300+ trackable fragments. A watershed moment that made orbital congestion real." },

  { id: 'kepler',        date: '2009-03-07', year: 2009, category: 'launch',
    icon: '⭐', title: 'Kepler Space Telescope — Exoplanet hunter',
    detail: "Kepler discovers 2,662 confirmed exoplanets over 9 years. Reveals that most stars host planets, that Earth-size worlds are common, and that potentially habitable zones are crowded. Fundamentally changes our understanding of our place in the universe." },

  { id: 'dragon_1',      date: '2012-05-22', year: 2012, category: 'milestone',
    icon: '🐉', title: 'SpaceX Dragon — First commercial ISS docking',
    detail: "SpaceX Dragon becomes the first commercial spacecraft to berth with the ISS, delivering cargo. Begins the commercial spaceflight era that would eventually lower launch costs by 90%." },

  { id: 'gwave',         date: '2015-09-14', year: 2015, category: 'astronomy',
    icon: '🌊', title: 'LIGO detects first gravitational wave',
    detail: "Two merging black holes 1.3 billion light-years away create a ripple in spacetime. LIGO's detectors measure a distortion smaller than 1/10,000th the width of a proton. Einstein's 1916 prediction confirmed — opens an entirely new way to observe the universe." },

  { id: 'juno',          date: '2016-07-04', year: 2016, category: 'launch',
    icon: '🪐', title: 'Juno arrives at Jupiter',
    detail: "First spacecraft to orbit Jupiter's poles. Discovers that the Great Red Spot extends 300 km below the cloud tops. Reveals chaotic cyclones at both poles 1,400 km wide." },

  { id: 'oumuamua_entry', date: '2017-09-09', year: 2017, category: 'interstellar',
    icon: '🌠', title: "ʻOumuamua — First interstellar object (perihelion)",
    detail: "1I/2017 U1 passes within 0.255 AU of the Sun on September 9, 2017 — already exiting when discovered on October 14. Elongated, cigar-shaped, no visible coma. Its anomalous acceleration puzzles astronomers. First confirmed object from another star system." },

  { id: 'oumuamua_exit',  date: '2018-01-02', year: 2018, category: 'interstellar',
    icon: '🌠', title: "ʻOumuamua — Exits inner solar system",
    detail: "Now 2.9 AU from the Sun and receding at 87,000 km/h. Too faint to observe further. Its origin star and system remain unknown. Never to return." },

  { id: 'bh_image',      date: '2019-04-10', year: 2019, category: 'astronomy',
    icon: '🌑', title: 'First black hole image — M87*',
    detail: "The Event Horizon Telescope, a planet-sized radio array, captures the first direct image of a black hole's shadow: M87* in the Virgo galaxy, 6.5 billion solar masses, 55 million light-years away. The bright ring is superheated gas orbiting at near the speed of light." },

  { id: 'borisov_entry',  date: '2019-08-30', year: 2019, category: 'interstellar',
    icon: '☄️', title: "2I/Borisov — Second interstellar object discovered",
    detail: "Gennady Borisov discovers the second known interstellar object. Unlike ʻOumuamua, it's an active comet — clearly extrasolar origin confirmed by its hyperbolic orbit (e=3.36). Perihelion: Dec 8, 2019 at 2.009 AU. Now beyond Neptune and receding forever." },

  { id: 'india_asat',    date: '2019-03-27', year: 2019, category: 'debris',
    icon: '💥', title: 'India ASAT test — Mission Shakti',
    detail: "India destroys its own Microsat-R satellite at 283 km altitude. Creates ~400 trackable fragments. Most debris reentered within weeks due to low altitude — but demonstrates a fourth nation's ASAT capability." },

  { id: 'starlink_100',  date: '2020-01-07', year: 2020, category: 'launch',
    icon: '🌐', title: 'Starlink — 180 satellites operational',
    detail: "SpaceX Starlink constellation grows rapidly. By 2024, over 6,000 Starlink satellites orbit Earth — representing 60% of all active satellites. The mega-constellation era fundamentally changes orbital dynamics and light pollution." },

  { id: 'jwst',          date: '2021-12-25', year: 2021, category: 'launch',
    icon: '🔭', title: 'James Webb Space Telescope launch',
    detail: "The most powerful space telescope ever built. 6.5m gold mirror, infrared, images galaxies formed 300 million years after the Big Bang. Direct images of exoplanet atmospheres. First detection of CO₂ on an exoplanet." },

  { id: 'russia_asat',   date: '2021-11-15', year: 2021, category: 'debris',
    icon: '💥', title: 'Russia ASAT test — Cosmos 1408',
    detail: "Russia destroys Cosmos 1408 at 480 km altitude. Creates 1,500+ tracked fragments and forces ISS crew to shelter in Soyuz. Condemned internationally. The debris cloud intersects the ISS orbit 15 times per day." },

  { id: 'sgra',          date: '2022-05-12', year: 2022, category: 'astronomy',
    icon: '🌌', title: "First image of Milky Way's black hole — Sgr A*",
    detail: "Event Horizon Telescope captures Sagittarius A*, the 4-million solar mass black hole at the center of our own galaxy, 27,000 light-years away. Its event horizon is smaller than our solar system yet contains the mass of 4 million suns." },

  { id: 'artemis1',      date: '2022-11-16', year: 2022, category: 'milestone',
    icon: '🌙', title: 'Artemis I — Return to the Moon',
    detail: "NASA's SLS/Orion flies the first uncrewed mission around the Moon since Apollo. Prepares for Artemis II crewed flyby and eventual lunar landing. Humanity's first visit to the lunar vicinity in 50 years." },

  { id: 'dart',          date: '2022-09-26', year: 2022, category: 'milestone',
    icon: '☄️', title: 'DART — First planetary defense test',
    detail: "NASA's DART spacecraft intentionally impacts asteroid Dimorphos at 6.1 km/s, shortening its orbital period by 32 minutes — far more than expected. First successful demonstration that humanity can deflect an asteroid." },

  { id: 'euclid',        date: '2023-07-01', year: 2023, category: 'launch',
    icon: '🌌', title: "ESA Euclid — Dark energy mapper",
    detail: "Maps the 3D distribution of 2 billion galaxies across 10 billion light-years. First detailed maps of dark matter distribution. Probes why the universe's expansion is accelerating — the greatest unsolved mystery in physics." },

];

export const POPULATION_DATA = [
  { year: 1957, total: 2,     active: 2,   debris: 0    },
  { year: 1958, total: 8,     active: 8,   debris: 0    },
  { year: 1960, total: 40,    active: 15,  debris: 25   },
  { year: 1962, total: 150,   active: 50,  debris: 100  },
  { year: 1965, total: 500,   active: 120, debris: 380  },
  { year: 1967, total: 1100,  active: 200, debris: 900  },
  { year: 1970, total: 2000,  active: 350, debris: 1650 },
  { year: 1975, total: 3500,  active: 480, debris: 3020 },
  { year: 1978, total: 4500,  active: 550, debris: 3950 },
  { year: 1980, total: 5200,  active: 570, debris: 4630 },
  { year: 1985, total: 6200,  active: 600, debris: 5600 },
  { year: 1990, total: 7200,  active: 660, debris: 6540 },
  { year: 1992, total: 7500,  active: 680, debris: 6820 },
  { year: 1995, total: 8100,  active: 730, debris: 7370 },
  { year: 1998, total: 8700,  active: 800, debris: 7900 },
  { year: 2000, total: 9200,  active: 860, debris: 8340 },
  { year: 2002, total: 9400,  active: 890, debris: 8510 },
  { year: 2005, total: 10500, active: 930, debris: 9570 },
  { year: 2007, total: 14000, active: 960, debris: 13040 },  // Fengyun spike
  { year: 2008, total: 14200, active: 980, debris: 13220 },
  { year: 2009, total: 15500, active: 990, debris: 14510 },  // Cosmos-Iridium
  { year: 2010, total: 16100, active: 1010,debris: 15090 },
  { year: 2012, total: 17000, active: 1060,debris: 15940 },
  { year: 2014, total: 17700, active: 1170,debris: 16530 },
  { year: 2016, total: 18400, active: 1400,debris: 17000 },
  { year: 2018, total: 20000, active: 2000,debris: 18000 },
  { year: 2019, total: 21000, active: 2500,debris: 18500 },  // India ASAT
  { year: 2020, total: 23000, active: 3400,debris: 19600 },
  { year: 2021, total: 27000, active: 5200,debris: 21800 },  // Russia ASAT
  { year: 2022, total: 29000, active: 6100,debris: 22900 },
  { year: 2023, total: 31500, active: 7800,debris: 23700 },
  { year: 2024, total: 34000, active: 9200,debris: 24800 },
  { year: 2025, total: 36000, active: 10500,debris: 25500 },
  { year: 2026, total: 38000, active: 11800,debris: 26200 },
];

export function getPopulationAt(year) {
  const data = POPULATION_DATA;
  if (year <= data[0].year) return { ...data[0] };
  if (year >= data[data.length - 1].year) return { ...data[data.length - 1] };

  for (let i = 0; i < data.length - 1; i++) {
    if (year >= data[i].year && year < data[i + 1].year) {
      const t = (year - data[i].year) / (data[i + 1].year - data[i].year);
      return {
        year,
        total:  Math.round(data[i].total  + t * (data[i + 1].total  - data[i].total)),
        active: Math.round(data[i].active + t * (data[i + 1].active - data[i].active)),
        debris: Math.round(data[i].debris + t * (data[i + 1].debris - data[i].debris)),
      };
    }
  }
  return { ...data[data.length - 1] };
}
