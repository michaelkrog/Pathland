import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // For backwards compatibility with old POC
      '@pathland': path.resolve(__dirname, './src'),
      // Map @pathland packages
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
  optimizeDeps: {},
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
