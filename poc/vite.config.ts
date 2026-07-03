import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // For backwards compatibility with old POC
      '@pathland': path.resolve(__dirname, './src'),
      // Map @pathland packages to their source directories for future use
      '@pathland/view': path.resolve(__dirname, '../lib/typescript/packages/view/src'),
      '@pathland/renderer-dom': path.resolve(__dirname, '../lib/typescript/packages/renderer-dom/src'),
      '@pathland/protocol': path.resolve(__dirname, '../lib/typescript/packages/protocol/src'),
      '@pathland/transport': path.resolve(__dirname, '../lib/typescript/packages/transport/src'),
      '@pathland/platform-browser': path.resolve(__dirname, '../lib/typescript/packages/platform-browser/src'),
    },
  },
  server: {
    port: 3000,
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
