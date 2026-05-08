

(function () {
  'use strict';

  const scripts    = document.querySelectorAll('script[data-src], script[data-mode]');
  const scriptEl   = document.currentScript || scripts[scripts.length - 1];

  const dataSrc    = scriptEl?.getAttribute('data-src') || 'https://spacenavigator-ten.vercel.app';
  const mode       = scriptEl?.getAttribute('data-mode')   || 'compact';
  const width      = scriptEl?.getAttribute('data-width')  || '100%';
  const height     = scriptEl?.getAttribute('data-height') || '520px';
  const radius     = scriptEl?.getAttribute('data-radius') || '10px';
  const targetSel  = scriptEl?.getAttribute('data-target') || null;

  const iframeUrl = (() => {
    try {
      const url = new URL(dataSrc || location.origin);
      url.searchParams.set('mode', mode);
      return url.toString();
    } catch {
      return `${dataSrc}?mode=${mode}`;
    }
  })();

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

  iframe.allow            = 'autoplay; fullscreen';
  iframe.allowFullscreen  = true;
  iframe.title            = 'SpaceNavigator';

  container.appendChild(iframe);

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

  function send(payload) {
    iframe.contentWindow?.postMessage({ type: 'spacenavigator', ...payload }, '*');
  }

  window.addEventListener('message', (e) => {
    if (e.source !== iframe.contentWindow) return;
    if (!e.data || e.data.type !== 'spacenavigator') return;
    document.dispatchEvent(new CustomEvent('spacenavigator', { detail: e.data, bubbles: false }));
  });

  const api = {

    flyTo(target) {
      send({ action: 'flyTo', target: String(target).toLowerCase() });
    },

    toggleLayer(layer, visible) {
      send({ action: 'toggleLayer', layer: String(layer).toLowerCase(), visible: !!visible });
    },

    setFilter(filter) {
      send({ action: 'setFilter', filter: String(filter).toLowerCase() });
    },

    clearFilter() {
      send({ action: 'clearFilter' });
    },

    destroy() {
      container.remove();
      window.SpaceNavigator = null;
    },

    iframe,

    container,
  };

  window.SpaceNavigator = api;
})();
