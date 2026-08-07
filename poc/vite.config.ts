import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
    }
  },
  server: {
    port: 3000,
    fs: {
      // Allow serving files from parent directory (lib packages) and POC itself
      allow: [
        path.resolve(__dirname),
        path.resolve(__dirname, '../lib/typescript/packages'),
      ],
    },
  },
  optimizeDeps: {
    // Don't pre-bundle @pathland packages (they're local and don't need it)
    exclude: [
      '@pathland/protocol',
      '@pathland/transport',
      '@pathland/view', 
      '@pathland/platform-browser',
      '@pathland/renderer-dom'
    ],
  },
  esbuild: {
    // Ensure TypeScript files are handled correctly
    target: 'es2020',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        canvas: path.resolve(__dirname, 'canvas.html'),
      },
    },
  },
  worker: {
    // Configure worker bundling
    format: 'es',
    rollupOptions: {
      // Ensure worker files can access the @pathland packages
      external: [],
    },
  },
});
