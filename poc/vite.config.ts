import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // For backwards compatibility with old POC
      '@pathland': path.resolve(__dirname, './src'),
      // Map @pathland packages to their actual locations
      '@pathland/protocol': path.resolve(__dirname, '../lib/typescript/packages/protocol'),
      '@pathland/transport': path.resolve(__dirname, '../lib/typescript/packages/transport'),
      '@pathland/view': path.resolve(__dirname, '../lib/typescript/packages/view'),
      '@pathland/platform-browser': path.resolve(__dirname, '../lib/typescript/packages/platform-browser'),
      '@pathland/renderer-dom': path.resolve(__dirname, '../lib/typescript/packages/renderer-dom'),
    },
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
      },
    },
  },
});
