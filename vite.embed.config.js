/**
 * Vite build config — Embed loader only
 *
 * Builds src/embed/spacenavigator-embed.js as a self-contained IIFE
 * (no ES module syntax) so it can be dropped into any webpage with
 * a plain <script src="…"> tag.
 *
 * Output: dist-embed/spacenavigator-embed.js
 *
 * Usage:
 *   npm run build:embed
 */
import { defineConfig } from 'vite';

export default defineConfig({
  // Build from project root (not src/)
  root: '.',

  build: {
    target: 'es2017',
    outDir: 'dist-embed',
    emptyOutDir: true,

    lib: {
      entry:    'src/embed/spacenavigator-embed.js',
      name:     'SpaceNavigator',   // window.SpaceNavigator (though the script sets it itself)
      formats:  ['iife'],
      fileName: () => 'spacenavigator-embed.js',
    },

    // No sourcemaps for the embed — keep it lean
    sourcemap: false,

    rollupOptions: {
      output: {
        // Prevent Rollup from wrapping the IIFE in another IIFE
        inlineDynamicImports: true,
      },
    },

    // The embed loader is ~3KB — no chunk splitting needed
    chunkSizeWarningLimit: 50,
  },
});
