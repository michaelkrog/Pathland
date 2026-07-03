import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // For backwards compatibility with old POC
      '@pathland': path.resolve(__dirname, './src'),
      // Alias to node_modules for Vite to resolve
      '@pathland/renderer-dom': path.resolve(__dirname, './node_modules/@pathland/renderer-dom/dist/index.js'),
      '@pathland/view': path.resolve(__dirname, './node_modules/@pathland/view/dist/index.js'),
      '@pathland/protocol': path.resolve(__dirname, './node_modules/@pathland/protocol/dist/index.js'),
      '@pathland/transport': path.resolve(__dirname, './node_modules/@pathland/transport/dist/index.js'),
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
