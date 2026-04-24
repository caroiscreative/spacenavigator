
export function createPlanetPanel(flyToPlanet, backToEarth) {
  const panel = document.getElementById('planet-panel');
  if (!panel) {
    console.warn('[PlanetPanel] #planet-panel DOM element not found');
    return { show: () => {}, hide: () => {} };
  }

  let currentMesh = null;

  function show(def, mesh) {
    currentMesh = mesh;
    panel.innerHTML = buildHTML(def);
    panel.classList.remove('hidden');

    const backBtn  = panel.querySelector('.planet-back-btn');
    const closeBtn = panel.querySelector('.planet-close-btn');

    backBtn?.addEventListener('click', () => {
      if (backToEarth) backToEarth();
      hide();
    });

    closeBtn?.addEventListener('click', hide);
  }

  function hide() {
    panel.classList.add('hidden');
    currentMesh = null;
  }

  return { show, hide };
}

function buildHTML(def) {
  const daySign   = def.dayHours < 0 ? 'retrograde ' : '';
  const dayHrs    = Math.abs(def.dayHours);
  const dayStr    = dayHrs >= 24
    ? `${daySign}${(dayHrs / 24).toFixed(1)} days`
    : `${daySign}${dayHrs.toFixed(1)} hours`;

  const yearStr   = def.yearDays >= 365
    ? `${(def.yearDays / 365.25).toFixed(1)} years`
    : `${Math.round(def.yearDays)} days`;

  const massStr   = formatSci(def.massKg, 'kg');
  const tempStr   = `${def.tempKelvin} K  (${Math.round(def.tempKelvin - 273.15)}°C)`;
  const moonsStr  = def.moons.length === 0 ? 'None' : `${def.moons.length} known`;

  const moonRows  = def.moons.map(m => {
    const dist = m.distKm >= 1_000_000
      ? `${(m.distKm / 1_000_000).toFixed(2)} Mkm`
      : `${Math.round(m.distKm / 1000)} kkm`;
    const period = Math.abs(m.periodDays) >= 1
      ? `${Math.abs(m.periodDays).toFixed(2)}d`
      : `${Math.round(Math.abs(m.periodDays) * 24)}h`;
    const retroNote = m.periodDays < 0 ? ' ↺' : '';
    return `
      <tr>
        <td>${m.name}${retroNote}</td>
        <td>${m.radiusKm.toLocaleString()} km</td>
        <td>${dist}</td>
        <td>${period}</td>
      </tr>`;
  }).join('');

  const moonTable = def.moons.length === 0 ? '' : `
    <div class="planet-section-label">MOONS</div>
    <table class="planet-moon-table">
      <thead>
        <tr><th>Name</th><th>Radius</th><th>Distance</th><th>Period</th></tr>
      </thead>
      <tbody>${moonRows}</tbody>
    </table>`;

  const thumbHtml = def.imageUrl ? `
    <div class="planet-thumb-wrap">
      <img class="planet-thumb"
           src="${def.imageUrl}"
           alt="${def.name}"
           loading="lazy"
           onerror="this.parentElement.style.display='none'">
      <span class="planet-thumb-credit">${def.imageCredit ?? ''}</span>
    </div>` : '';

  return `
    <div class="planet-panel-inner">
      <button class="planet-close-btn" title="Close">✕</button>

      <div class="planet-name">${def.name}</div>
      <div class="planet-type">${def.type}</div>
      ${thumbHtml}
      <div class="planet-desc">${def.description}</div>

      <div class="planet-stats">
        <div class="planet-stat"><span class="stat-label">Diameter</span><span class="stat-val">${def.diameterKm.toLocaleString()} km</span></div>
        <div class="planet-stat"><span class="stat-label">Mass</span><span class="stat-val">${massStr}</span></div>
        <div class="planet-stat"><span class="stat-label">Gravity</span><span class="stat-val">${def.gravityMs2} m/s²</span></div>
        <div class="planet-stat"><span class="stat-label">Day length</span><span class="stat-val">${dayStr}</span></div>
        <div class="planet-stat"><span class="stat-label">Year length</span><span class="stat-val">${yearStr}</span></div>
        <div class="planet-stat"><span class="stat-label">Temperature</span><span class="stat-val">${tempStr}</span></div>
        <div class="planet-stat"><span class="stat-label">Distance from Sun</span><span class="stat-val">${def.distAU} AU</span></div>
        <div class="planet-stat"><span class="stat-label">Moons</span><span class="stat-val">${moonsStr}</span></div>
      </div>

      ${moonTable}

      <div class="planet-actions">
        <button class="planet-back-btn">← Back to Earth</button>
      </div>
    </div>`;
}

function formatSci(value, unit) {
  const exp = Math.floor(Math.log10(value));
  const man = (value / Math.pow(10, exp)).toFixed(2);
  return `${man} × 10^${exp} ${unit}`;
}
