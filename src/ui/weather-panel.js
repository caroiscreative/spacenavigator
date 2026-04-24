
export function createWeatherPanel(spaceWeather) {
  const panel     = document.getElementById('weather-panel');
  const kpValue   = document.getElementById('wp-kp-value');
  const kpBar     = document.getElementById('wp-kp-bar');
  const kpClass   = document.getElementById('wp-kp-class');
  const flareEl   = document.getElementById('wp-flare');
  const auroraEl  = document.getElementById('wp-aurora');
  const alertsEl  = document.getElementById('wp-alerts');
  const updatedEl = document.getElementById('wp-updated');

  if (!panel) {
    console.warn('[WeatherPanel] #weather-panel not found in DOM');
    return { show: () => {}, hide: () => {}, toggle: () => false, isVisible: () => false };
  }

  function kpColor(kp) {
    if (kp === null) return '#666';
    if (kp >= 7)     return '#FF1744';   // red — severe
    if (kp >= 5)     return '#FF6D00';   // orange — storm
    if (kp >= 4)     return '#FFCA28';   // yellow — unsettled
    return '#69F0AE';                    // green — quiet
  }

  function flareColor(cls) {
    switch (cls) {
      case 'X': return '#FF1744';
      case 'M': return '#FF6D00';
      case 'C': return '#FFCA28';
      default:  return '#69F0AE';
    }
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

  function render(data) {
    const kp     = data.kp;
    const color  = kpColor(kp);
    const pct    = kp !== null ? Math.min(kp / 9, 1) * 100 : 0;

    if (kpValue) kpValue.textContent = kp !== null ? kp.toFixed(1) : '—';

    if (kpBar) {
      kpBar.style.width      = `${pct}%`;
      kpBar.style.background = color;
    }

    if (kpClass) {
      kpClass.textContent = data.kpClass.toUpperCase();
      kpClass.style.color = color;
    }

    if (flareEl) {
      const intensity    = data.flareIntensity !== null ? data.flareIntensity.toFixed(1) : '';
      flareEl.textContent  = `${data.flareClass}${intensity}`;
      flareEl.style.color  = flareColor(data.flareClass);
    }

    if (auroraEl) auroraEl.textContent = kpToAurora(kp);

    if (alertsEl) {
      const n = data.alertCount;
      alertsEl.textContent = `${n} alert${n !== 1 ? 's' : ''}`;
      alertsEl.style.color = n > 0 ? '#FF6D00' : '#666';
    }

    if (updatedEl && data.lastUpdate) {
      updatedEl.textContent = data.lastUpdate.toLocaleTimeString([], {
        hour: '2-digit', minute: '2-digit',
      });
    }

    if (panel) {
      panel.classList.toggle('weather-storm', kp !== null && kp >= 5);
    }
  }

  spaceWeather.onUpdate(render);
  render(spaceWeather.getData());

  function show()      { panel.classList.add('visible'); }
  function hide()      { panel.classList.remove('visible'); }
  function toggle()    {
    panel.classList.toggle('visible');
    return panel.classList.contains('visible');
  }
  function isVisible() { return panel.classList.contains('visible'); }

  return { show, hide, toggle, isVisible };
}
