/**
 * SpaceNavigator — Embed Loader
 * ─────────────────────────────
 * Drop this script tag anywhere in your HTML:
 *
 *   <script
 *     src="https://your-host.com/spacenavigator-embed.js"
 *     data-src="https://your-host.com"
 *     data-mode="compact"
 *     data-width="100%"
 *     data-height="520px"
 *     data-radius="12px"
 *   ></script>
 *
 * Attributes
 * ──────────
 *   data-src      Base URL where SpaceNavigator is hosted (no trailing slash)
 *   data-mode     "compact" (default) | "full"
 *   data-width    CSS width  of the container  (default: "100%")
 *   data-height   CSS height of the container  (default: "520px")
 *   data-radius   Border-radius                (default: "10px")
 *   data-target   CSS selector of an element to inject into (default: after <script>)
 *
 * JS API  (window.SpaceNavigator)
 * ─────────────────────────────────
 *   SpaceNavigator.flyTo(target)              — 'earth' | 'sun' | 'moon' | 'mars' |
 *                                               'venus' | 'mercury' | 'jupiter' |
 *                                               'saturn' | 'uranus' | 'neptune' |
 *                                               'iss' | 'leo' | 'geo' | 'starlink'
 *   SpaceNavigator.toggleLayer(layer, bool)   — 'satellites' | 'debris' | 'risk' |
 *                                               'stars' | 'orbits' | 'constellations'
 *   SpaceNavigator.setFilter(fleet)           — 'starlink' | 'debris' | 'gps' | ...
 *   SpaceNavigator.clearFilter()
 *   SpaceNavigator.destroy()                  — removes the iframe from the DOM
 *
 * Events  (document.addEventListener('spacenavigator', fn))
 * ──────────────────────────────────────────────────────────
 *   e.detail.event === 'ready'               — iframe loaded and initialized
 *   e.detail.event === 'satSelect'           — { name, norad }
 *   e.detail.event === 'conjunctionAlert'    — { nameA, nameB, risk, distKm }
 */

(function () {
  'use strict';

  // ── Locate the script tag ───────────────────────────────────────────────────
  const scripts    = document.querySelectorAll('script[data-src], script[data-mode]');
  const scriptEl   = document.currentScript || scripts[scripts.length - 1];

  const dataSrc    = scriptEl?.getAttribute('data-src') || '';
  const mode       = scriptEl?.getAttribute('data-mode')   || 'compact';
  const width      = scriptEl?.getAttribute('data-width')  || '100%';
  const height     = scriptEl?.getAttribute('data-height') || '520px';
  const radius     = scriptEl?.getAttribute('data-radius') || '10px';
  const targetSel  = scriptEl?.getAttribute('data-target') || null;

  if (!dataSrc) {
    console.warn('[SpaceNavigator] Missing data-src attribute. Add data-src="https://your-host.com" to the <script> tag.');
  }

  // ── Build iframe URL ─────────────────────────────────────────────────────────
  const iframeUrl = (() => {
    try {
      const url = new URL(dataSrc || location.origin);
      url.searchParams.set('mode', mode);
      return url.toString();
    } catch {
      return `${dataSrc}?mode=${mode}`;
    }
  })();

  // ── Create container + iframe ────────────────────────────────────────────────
  const container = document.createElement('div');
  container.style.cssText = [
    `width:${width}`,
    `height:${height}`,
    'position:relative',
    'overflow:hidden',
    `border-radius:${radius}`,
    'background:#000',
    'display:block',
  ].join(';');

  const iframe = document.createElement('iframe');
  iframe.src   = iframeUrl;
  iframe.style.cssText = 'width:100%;height:100%;border:none;display:block;';
  // Allow autoplay (for audio) and fullscreen
  iframe.allow            = 'autoplay; fullscreen';
  iframe.allowFullscreen  = true;
  iframe.title            = 'SpaceNavigator';

  container.appendChild(iframe);

  // ── Inject into DOM ──────────────────────────────────────────────────────────
  if (targetSel) {
    const target = document.querySelector(targetSel);
    if (target) {
      target.appendChild(container);
    } else {
      console.warn(`[SpaceNavigator] data-target "${targetSel}" not found in DOM.`);
      scriptEl?.insertAdjacentElement('afterend', container);
    }
  } else {
    scriptEl?.insertAdjacentElement('afterend', container);
  }

  // ── postMessage helpers ──────────────────────────────────────────────────────
  function send(payload) {
    iframe.contentWindow?.postMessage({ type: 'spacenavigator', ...payload }, '*');
  }

  // ── Relay events: iframe → parent document ───────────────────────────────────
  window.addEventListener('message', (e) => {
    if (e.source !== iframe.contentWindow) return;
    if (!e.data || e.data.type !== 'spacenavigator') return;
    document.dispatchEvent(new CustomEvent('spacenavigator', { detail: e.data, bubbles: false }));
  });

  // ── Public API ───────────────────────────────────────────────────────────────
  const api = {
    /**
     * Fly the camera to a named target.
     * @param {string} target — 'earth' | 'sun' | 'moon' | 'mars' | 'venus' |
     *   'mercury' | 'jupiter' | 'saturn' | 'uranus' | 'neptune' |
     *   'iss' | 'leo' | 'geo' | 'starlink'
     */
    flyTo(target) {
      send({ action: 'flyTo', target: String(target).toLowerCase() });
    },

    /**
     * Show or hide a visual layer.
     * @param {string}  layer   — 'satellites' | 'debris' | 'risk' | 'stars' |
     *                            'orbits' | 'constellations'
     * @param {boolean} visible
     */
    toggleLayer(layer, visible) {
      send({ action: 'toggleLayer', layer: String(layer).toLowerCase(), visible: !!visible });
    },

    /**
     * Filter the satellite layer to only show a specific fleet.
     * @param {string} filter — 'starlink' | 'oneweb' | 'gps' | 'galileo' |
     *                          'glonass' | 'iridium' | 'debris' | 'station'
     */
    setFilter(filter) {
      send({ action: 'setFilter', filter: String(filter).toLowerCase() });
    },

    /** Remove any active satellite filter — show all satellites. */
    clearFilter() {
      send({ action: 'clearFilter' });
    },

    /** Remove the iframe and container from the DOM. */
    destroy() {
      container.remove();
      window.SpaceNavigator = null;
    },

    /** Reference to the underlying <iframe> element. */
    iframe,
    /** Reference to the wrapper <div>. */
    container,
  };

  // Expose globally
  window.SpaceNavigator = api;
})();
