import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // For backwards compatibility with old POC
      '@pathland': path.resolve(__dirname, './src'),
      // Alias @pathland packages to lib for direct imports
      '@pathland/platform-browser': path.resolve(__dirname, '../lib/typescript/packages/platform-browser'),
      '@pathland/view': path.resolve(__dirname, '../lib/typescript/packages/view'),
      '@pathland/renderer-dom': path.resolve(__dirname, '../lib/typescript/packages/renderer-dom'),
      '@pathland/protocol': path.resolve(__dirname, '../lib/typescript/packages/protocol'),
      '@pathland/transport': path.resolve(__dirname, '../lib/typescript/packages/transport'),
    },
  },
  esbuild: {
    // Ensure TypeScript files are handled correctly
    target: 'es2020',
  },
  optimizeDeps: {
    // Don't pre-bundle our local packages
    exclude: [
      '@pathland/protocol',
      '@pathland/transport', 
      '@pathland/view',
      '@pathland/renderer-dom',
      '@pathland/platform-browser'
    ]
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
  server: {
    port: 3000,
  },
});
