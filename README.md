# SpaceNavigator

Real-time 3D space situational awareness platform built entirely in the browser.

Track **27,000+ satellites and debris objects** in real time using live TLE data from CelesTrak, propagated with SGP4 orbital mechanics. Explore the solar system, monitor space weather, and analyze orbital conjunction risk — no server required.

**[spacenavigator.app](https://spacenavigator.app)**

---

## Features

- Real-time SGP4 propagation of 27,000+ tracked objects
- Full solar system with VSOP87 ephemeris and Meeus lunar theory
- Orbital conjunction risk scanner
- Debris density heatmap by altitude shell
- Space weather dashboard (Kp index, solar wind, aurora)
- Deep-sky object catalog (galaxies, nebulae, black holes)
- Interstellar visitor trajectories (ʻOumuamua, Borisov, 3I/ATLAS)
- Historical space timeline — 1957 to today
- PDF report generator
- Time controls (±7 days scrub, ×1 to ×1,000,000 speed)

## Tech

- [Three.js](https://threejs.org) r168+ with WebGPU renderer
- [satellite.js](https://github.com/shashwatak/satellite-js) — SGP4/SDP4 propagation
- [Vite](https://vitejs.dev) — build tool
- TSL (Three.js Shading Language) — WebGPU-compatible shaders
- [HYG Database](https://github.com/astronexus/HYG-Database) — 119,617 stars
- [CelesTrak](https://celestrak.org) — live TLE catalog
- [NOAA SWPC](https://www.swpc.noaa.gov) — space weather data
- [NASA SDO](https://sdo.gsfc.nasa.gov) — solar imagery
- [Minor Planet Center](https://minorplanetcenter.net) — asteroid catalog

## Running locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`

## Keyboard shortcuts

Press `?` in the app for the full controls reference.

## Created by

**Carolina Franco** · [@caroiscreativee](https://x.com/caroiscreativee)

---

*100% browser · no server · no backend · no tracking*
