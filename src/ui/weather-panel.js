
export function createWeatherPanel(spaceWeather) {
  const panel      = document.getElementById('weather-panel');
  const kpValue    = document.getElementById('wp-kp-value');
  const kpBar      = document.getElementById('wp-kp-bar');
  const kpClassEl  = document.getElementById('wp-kp-class');
  const xrayValue  = document.getElementById('wp-xray-value');
  const xrayBar    = document.getElementById('wp-xray-bar');
  const xrayClsEl  = document.getElementById('wp-xray-cls');
  const swSpeedEl  = document.getElementById('wp-sw-speed');
  const bzEl       = document.getElementById('wp-bz');
  const sfiEl      = document.getElementById('wp-sfi');
  const auroraEl   = document.getElementById('wp-aurora');
  const alertsEl   = document.getElementById('wp-alerts');
  const updatedEl  = document.getElementById('wp-updated');
  const flaresEl   = document.getElementById('wp-flares-list');
  const impactsEl  = document.getElementById('wp-impacts');
  const fcBarsEl   = document.getElementById('wp-forecast-bars');
  const riskRowEl  = document.getElementById('wp-risk-row');
  const timeBadgeEl = document.getElementById('wp-time-badge');

  if (!panel) {
    console.warn('[WeatherPanel] #weather-panel not found in DOM');
    return { show: () => {}, hide: () => {}, toggle: () => false, isVisible: () => false, updateForecast: () => {} };
  }

  function kpColor(kp) {
    if (kp === null) return '#888';
    if (kp >= 7)     return '#FF1744';
    if (kp >= 5)     return '#FF6D00';
    if (kp >= 4)     return '#FFCA28';
    return '#69F0AE';
  }

  function xrayColor(cls) {
    switch (cls) {
      case 'X': return '#FF1744';
      case 'M': return '#FF6D00';
      case 'C': return '#FFCA28';
      case 'B': return '#69F0AE';
      default:  return '#888';
    }
  }

  function scaleColor(level) {
    if (!level || level === 0) return '#69F0AE';
    if (level === 1)           return '#FFCA28';
    if (level === 2)           return '#FF6D00';
    return '#FF1744';
  }

  function xrayFluxLabel(flux) {
    if (flux === null) return '—';
    if (flux >= 1e-4) return 'X' + (flux / 1e-4).toFixed(1);
    if (flux >= 1e-5) return 'M' + (flux / 1e-5).toFixed(1);
    if (flux >= 1e-6) return 'C' + (flux / 1e-6).toFixed(1);
    if (flux >= 1e-7) return 'B' + (flux / 1e-7).toFixed(1);
    return 'A' + (flux / 1e-8).toFixed(1);
  }

  function xrayBarPct(flux) {
    if (!flux || flux <= 0) return 0;
    const logMin = -8, logMax = -3;
    return Math.max(2, Math.min((Math.log10(flux) - logMin) / (logMax - logMin) * 100, 100));
  }

  function kpToAurora(kp) {
    if (kp === null) return '—';
    if (kp >= 8)  return 'Widespread (70°+)';
    if (kp >= 6)  return 'Visible (50°+)';
    if (kp >= 5)  return 'Possible (55°+)';
    if (kp >= 4)  return 'High latitudes (60°+)';
    if (kp >= 2)  return 'Polar regions only';
    return 'Not expected';
  }

  function sfiLabel(sfi) {
    if (sfi === null) return '—';
    if (sfi > 200)    return `${Math.round(sfi)} sfu — Very High`;
    if (sfi > 150)    return `${Math.round(sfi)} sfu — High`;
    if (sfi > 100)    return `${Math.round(sfi)} sfu — Moderate`;
    if (sfi > 70)     return `${Math.round(sfi)} sfu — Low`;
    return `${Math.round(sfi)} sfu — Very Low`;
  }

  function sfiColor(sfi) {
    if (sfi === null || sfi <= 70)  return '#888';
    if (sfi <= 100)                 return '#69F0AE';
    if (sfi <= 150)                 return '#FFCA28';
    if (sfi <= 200)                 return '#FF6D00';
    return '#FF1744';
  }

  function kpToDragImpact(kp) {
    if (kp === null || kp < 3) return { status: 'Normal', color: '#69F0AE' };
    if (kp < 5)                return { status: 'Elevated', color: '#FFCA28' };
    if (kp < 7)                return { status: 'High drag', color: '#FF6D00' };
    return                            { status: 'Extreme', color: '#FF1744' };
  }

  function kpToChargingImpact(kp, bzNT) {
    const southward = bzNT !== null && bzNT < -10;
    if (kp === null || kp < 4) return { status: 'Low risk', color: '#69F0AE' };
    if (kp < 6)                return { status: `Moderate (GEO)${southward ? ' ↑' : ''}`, color: '#FFCA28' };
    return                            { status: 'High risk (GEO/HEO)', color: '#FF1744' };
  }

  function flareToRadioLabel(cls) {
    if (!cls || cls === '—') return null;
    const letter = cls[0].toUpperCase();
    if (letter === 'X') return { label: 'Severe HF', color: '#FF1744' };
    if (letter === 'M') return { label: 'Major HF', color: '#FF6D00' };
    if (letter === 'C') return { label: 'Minor HF', color: '#FFCA28' };
    return null;
  }

  function fmtFlareTime(date) {
    if (!date) return '—';
    const ageMins = Math.round((Date.now() - date.getTime()) / 60000);
    if (ageMins < 90) return `${ageMins}m ago`;
    const ageHrs = Math.round(ageMins / 60);
    if (ageHrs < 24) return `${ageHrs}h ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function renderFlares(recentFlares) {
    if (!flaresEl) return;
    if (!recentFlares || recentFlares.length === 0) {
      flaresEl.innerHTML = '<span class="wp-flare-none">No C+ flares in past 7 days</span>';
      return;
    }
    flaresEl.innerHTML = recentFlares.map(({ cls, beginTime, durationMin }) => {
      const letter    = cls[0]?.toUpperCase() ?? '?';
      const color     = xrayColor(letter);
      const radio     = flareToRadioLabel(cls);
      const timeStr   = fmtFlareTime(beginTime);
      const durStr    = durationMin !== null ? `${durationMin}min` : '';
      const metaParts = [timeStr, durStr].filter(Boolean).join(' · ');
      const radioHtml = radio
        ? `<span class="wp-flare-effect" style="color:${radio.color};border:1px solid ${radio.color}33;background:${radio.color}18">${radio.label}</span>`
        : '';
      return `<div class="wp-flare-item">
        <span class="wp-flare-cls" style="color:${color}">${cls}</span>
        <span class="wp-flare-meta">${metaParts}</span>
        ${radioHtml}
      </div>`;
    }).join('');
  }

  function renderImpacts(data) {
    if (!impactsEl) return;
    const sc = data.noaaScales ?? {};

    const SCALE_TIPS = {
      R: 'HF radio disruption on Earth\'s sunlit side, caused by X-ray bursts from solar flares. R1=minor degradation. R5=complete blackout for hours.',
      S: 'High-energy proton bombardment from solar particle events. Can damage satellite electronics and pose radiation risk to astronauts. S1–S5.',
      G: 'Magnetic field disturbance driven by solar wind or CMEs. Causes aurora, power grid issues, satellite charging, and increased drag. G1–G5.',
    };
    const SAT_TIPS = {
      'LEO Drag':     'Geomagnetic activity heats the upper atmosphere, raising density at 200–2000 km altitude. Satellites experience more drag and their orbits decay faster.',
      'GEO Charging': 'During storms, energetic electrons accumulate on geostationary satellite surfaces (~35,786 km), risking electrostatic discharge and electronics damage.',
    };

    function scaleRow(badge, label, level, text, forecastHtml) {
      const col = scaleColor(level);
      const badgeStyle = `background:${col}18;color:${col};border:1px solid ${col}40`;
      const tip = SCALE_TIPS[badge] ?? '';
      return `<div class="wp-impact-row">
        <span class="wp-scale-badge" style="${badgeStyle}">${badge}${level}</span>
        <div class="wp-scale-info">
          <span class="wp-impact-label">${label} <span class="info-tip" data-tip="${tip}">?</span></span>
          ${forecastHtml ? `<span class="wp-scale-forecast">${forecastHtml}</span>` : ''}
        </div>
        <span class="wp-impact-status" style="color:${col}">${level > 0 ? text : 'Clear'}</span>
      </div>`;
    }

    function satRow(icon, label, status, color) {
      const tip = SAT_TIPS[label] ?? '';
      return `<div class="wp-impact-row">
        <span class="wp-impact-icon">${icon}</span>
        <span class="wp-impact-label">${label} <span class="info-tip" data-tip="${tip}">?</span></span>
        <span class="wp-impact-status" style="color:${color}">${status}</span>
      </div>`;
    }

    const rForecast = sc.R24hMinorProb > 0
      ? `${sc.R24hMinorProb}% minor / ${sc.R24hMajorProb}% major in 24h`
      : null;

    const sForecast = sc.S24hProb > 0
      ? `${sc.S24hProb}% prob in 24h`
      : null;

    const gForecast = sc.G24h > 0
      ? `G${sc.G24h} ${sc.G24hText ?? ''} expected 24h`
      : null;

    const dragImpact     = kpToDragImpact(data.kp);
    const chargingImpact = kpToChargingImpact(data.kp, data.bzNT);

    impactsEl.innerHTML = [
      `<div class="wp-impact-section-label">NOAA Scales</div>`,
      scaleRow('R', 'Radio Blackout',     sc.R ?? 0, sc.RText ?? 'none',  rForecast),
      scaleRow('S', 'Radiation Storm',    sc.S ?? 0, sc.SText ?? 'none',  sForecast),
      scaleRow('G', 'Geomagnetic Storm',  sc.G ?? 0, sc.GText ?? 'none',  gForecast),
      `<div class="wp-impact-section-label" style="margin-top:6px">Satellite Impact</div>`,
      satRow('🛰',  'LEO Drag',     dragImpact.status,     dragImpact.color),
      satRow('⚡', 'GEO Charging', chargingImpact.status, chargingImpact.color),
    ].join('');
  }

  function render(data) {
    const kp    = data.kp;
    const color = kpColor(kp);
    const pct   = kp !== null ? Math.min(kp / 9, 1) * 100 : 0;

    if (timeBadgeEl) {
      if (data.isLive === false && data.histTime) {

        const d = data.histTime;
        const label = d.toLocaleString([], {
          month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit',
        });
        timeBadgeEl.textContent = `📅 ${label}`;
        timeBadgeEl.className = 'wp-time-badge historical';
      } else if (data.isLive === false && data.historicalUnavailable) {
        timeBadgeEl.textContent = 'Historical data unavailable';
        timeBadgeEl.className = 'wp-time-badge unavailable';
      } else {
        timeBadgeEl.textContent = '● LIVE';
        timeBadgeEl.className = 'wp-time-badge live';
      }
    }

    if (kpValue)   kpValue.textContent = kp !== null ? kp.toFixed(1) : '—';
    if (kpBar)    { kpBar.style.width = `${pct}%`; kpBar.style.background = color; }
    if (kpClassEl) {
      const cls = data.kpClass ?? 'quiet';
      kpClassEl.textContent = kp !== null ? cls.toUpperCase() : (data.historicalUnavailable ? 'N/A' : '—');
      kpClassEl.style.color = kp !== null ? color : '#888';
    }

    if (xrayValue) xrayValue.textContent = xrayFluxLabel(data.xrayFlux);
    if (xrayBar) {
      xrayBar.style.width      = `${xrayBarPct(data.xrayFlux)}%`;
      xrayBar.style.background = xrayColor(data.xrayClass);
    }
    if (xrayClsEl) { xrayClsEl.textContent = data.xrayClass; xrayClsEl.style.color = xrayColor(data.xrayClass); }

    if (swSpeedEl) {
      swSpeedEl.textContent = data.solarWindSpeed !== null
        ? `${Math.round(data.solarWindSpeed)} km/s`
        : '—';
      swSpeedEl.style.color = (data.solarWindSpeed !== null && data.solarWindSpeed > 500)
        ? '#FF6D00' : 'var(--text-secondary)';
    }

    if (bzEl) {
      const bz = data.bzNT;
      if (bz !== null) {
        const sign = bz >= 0 ? '+' : '';
        const dir  = bz < -5 ? ' ↓ SOUTH' : (bz > 5 ? ' ↑ NORTH' : '');
        bzEl.textContent = `${sign}${bz.toFixed(1)} nT${dir}`;
        bzEl.style.color = bz < -20 ? '#FF1744' : bz < -10 ? '#FF6D00' : bz < -5 ? '#FFCA28' : '#69F0AE';
      } else {
        bzEl.textContent = '—';
        bzEl.style.color = 'var(--text-secondary)';
      }
    }

    if (sfiEl) {
      sfiEl.textContent = sfiLabel(data.sfi);
      sfiEl.style.color = sfiColor(data.sfi);
    }

    if (auroraEl) auroraEl.textContent = kpToAurora(kp);

    if (alertsEl) {
      if (data.isLive === false && !data.historicalUnavailable) {
        alertsEl.textContent = '—';
        alertsEl.style.color = '#888';
      } else {
        const n = data.alertCount;
        alertsEl.textContent = `${n} alert${n !== 1 ? 's' : ''}`;
        alertsEl.style.color = n > 0 ? '#FF6D00' : '#888';
      }
    }

    if (updatedEl) {
      if (data.isLive === false && data.histTime) {

        updatedEl.textContent = data.histTime.toLocaleTimeString([], {
          hour: '2-digit', minute: '2-digit',
        });
      } else if (data.lastUpdate) {
        updatedEl.textContent = data.lastUpdate.toLocaleTimeString([], {
          hour: '2-digit', minute: '2-digit',
        });
      }
    }

    renderFlares(data.recentFlares);
    renderImpacts(data);

    if (panel) panel.classList.toggle('weather-storm', kp !== null && kp >= 5);
  }

  spaceWeather.onUpdate(render);
  render(spaceWeather.getData());

  function updateForecast(forecast, riskCounts) {
    if (fcBarsEl && Array.isArray(forecast) && forecast.length > 0) {
      fcBarsEl.innerHTML = '';
      forecast.slice(0, 24).forEach(({ kp: fKp }) => {
        const bar = document.createElement('div');
        bar.className        = 'wp-fc-bar';
        bar.style.height     = `${Math.max(4, Math.min(fKp / 9, 1) * 100)}%`;
        bar.style.background = kpColor(fKp);
        bar.style.opacity    = '0.75';
        fcBarsEl.appendChild(bar);
      });
    }

    if (riskRowEl && riskCounts) {
      const { elevated, high, extreme } = riskCounts;
      const total = elevated + high + extreme;
      if (total === 0) {
        riskRowEl.innerHTML = '<span class="wp-risk-badge none">No drag risk</span>';
      } else {
        riskRowEl.innerHTML = '';
        if (extreme > 0) {
          const b = document.createElement('span');
          b.className = 'wp-risk-badge extreme';
          b.textContent = `Extreme ${extreme.toLocaleString()}`;
          riskRowEl.appendChild(b);
        }
        if (high > 0) {
          const b = document.createElement('span');
          b.className = 'wp-risk-badge high';
          b.textContent = `High ${high.toLocaleString()}`;
          riskRowEl.appendChild(b);
        }
        if (elevated > 0) {
          const b = document.createElement('span');
          b.className = 'wp-risk-badge elevated';
          b.textContent = `Elevated ${elevated.toLocaleString()}`;
          riskRowEl.appendChild(b);
        }
      }
    }
  }

  function show()      { panel.classList.add('visible'); }
  function hide()      { panel.classList.remove('visible'); }
  function toggle()    { panel.classList.toggle('visible'); return panel.classList.contains('visible'); }
  function isVisible() { return panel.classList.contains('visible'); }

  function renderData(data) { render(data); }

  return { show, hide, toggle, isVisible, updateForecast, renderData };
}
