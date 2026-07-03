import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // For backwards compatibility with old POC
      '@pathland': path.resolve(__dirname, './src'),
      // Map @pathland packages to their node_modules location
      '@pathland/platform-browser': path.resolve(__dirname, './node_modules/@pathland/platform-browser'),
      '@pathland/view': path.resolve(__dirname, './node_modules/@pathland/view'),
      '@pathland/renderer-dom': path.resolve(__dirname, './node_modules/@pathland/renderer-dom'),
      '@pathland/protocol': path.resolve(__dirname, './node_modules/@pathland/protocol'),
      '@pathland/transport': path.resolve(__dirname, './node_modules/@pathland/transport'),
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
