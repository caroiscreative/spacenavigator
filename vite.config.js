import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',              // index.html lives in src/
  publicDir: '../public',   // public assets folder stays at project root
  server: {
    port: 3000,
    open: true,
    // ── NASA SDO proxy ──────────────────────────────────────────────────────────
    // sdo.gsfc.nasa.gov doesn't send Access-Control-Allow-Origin headers, so the
    // browser blocks the texture from being read into WebGPU.
    // This proxy forwards /sdo/* requests server-side (no browser CORS check).
    // In production, replace with a thin edge function or server route.
    proxy: {
      '/sdo': {
        target: 'https://sdo.gsfc.nasa.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/sdo/, ''),
        timeout: 8000,
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            // Suppress the full stack trace — DNS failures are expected on restricted networks
            console.warn(`[proxy/sdo] ${err.code ?? err.message}`);
            if (res && !res.headersSent) { res.writeHead(503); res.end(''); }
          });
        },
      },
      // ── NOAA SWPC proxy ───────────────────────────────────────────────────────
      // services.swpc.noaa.gov is CORS-enabled but adding a proxy keeps fetch
      // consistent between dev and any future edge-function deployment.
      '/swpc': {
        target: 'https://services.swpc.noaa.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/swpc/, ''),
        timeout: 8000,
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            console.warn(`[proxy/swpc] ${err.code ?? err.message}`);
            if (res && !res.headersSent) { res.writeHead(503); res.end('{}'); }
          });
        },
      },
      // ── CelesTrak proxy ────────────────────────────────────────────────────────
      // CelesTrak doesn't send CORS headers AND blocks requests that look like
      // browser traffic (Origin/Referer headers trigger a 403).
      // The configure hook strips those headers and sets a plain User-Agent
      // before the request leaves the Vite dev server.
      '/celestrak': {
        target: 'https://celestrak.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/celestrak/, ''),
        timeout: 15000,
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            console.warn(`[proxy/celestrak] ${err.code ?? err.message}`);
            if (res && !res.headersSent) { res.writeHead(503); res.end(''); }
          });
          proxy.on('proxyReq', (proxyReq) => {
            // Remove headers that trigger CelesTrak's bot/hotlink filter
            proxyReq.removeHeader('origin');
            proxyReq.removeHeader('referer');
            proxyReq.removeHeader('sec-fetch-site');
            proxyReq.removeHeader('sec-fetch-mode');
            proxyReq.removeHeader('sec-fetch-dest');
            proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (compatible; SpaceNavigator/1.0)');
          });
        },
      },
    },
  },
  build: {
    target:      'esnext',
    outDir:      '../dist',
    emptyOutDir: true,
    sourcemap:             false,
    chunkSizeWarningLimit: 2500,

    // Prevent Vite from adding <link rel="modulepreload"> for pdfmake chunks.
    // pdfmake/vfs_fonts uses `this` as `window` (CJS pattern) — it crashes when
    // the browser evaluates the chunk at page load in strict ES module context.
    // By filtering preloads, the chunk only executes on actual PDF button click.
    modulePreload: {
      resolveDependencies: (url, deps) =>
        deps.filter(d => !d.includes('pdfmake')),
    },

    rollupOptions: {
      output: {
        manualChunks: {
          'three':     ['three'],
          'ephemeris': ['ephemeris'],
          'satellite': ['satellite.js'],
          // pdfmake intentionally excluded — lazy chunk, must not preload
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['three'],
  },
  resolve: {
    // Alias bare 'three' → 'three/webgpu' so that three/addons/* (OrbitControls,
    // etc.) and our own code all resolve to the same module instance.
    alias: [
      { find: /^three$/, replacement: 'three/webgpu' },
    ],
    dedupe: ['three'],
  },
});
