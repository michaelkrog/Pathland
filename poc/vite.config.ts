import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // For backwards compatibility with old POC
      '@pathland': path.resolve(__dirname, './src'),
      // New package structure
      '@pathland/protocol': path.resolve(__dirname, '../lib/typescript/packages/protocol/dist'),
      '@pathland/transport': path.resolve(__dirname, '../lib/typescript/packages/transport/dist'),
      '@pathland/view': path.resolve(__dirname, '../lib/typescript/packages/view/dist'),
      '@pathland/renderer-dom': path.resolve(__dirname, '../lib/typescript/packages/renderer-dom/dist'),
      '@pathland/platform-browser': path.resolve(__dirname, '../lib/typescript/packages/platform-browser/dist'),
    },
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
        main: path.resolve(__dirname, 'index-new.html'),
      },
    },
  },
  server: {
    port: 3000,
  },
});
