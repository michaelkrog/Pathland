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
  optimizeDeps: {
    // Include our local packages in optimization
    include: [
      '@pathland/protocol',
      '@pathland/transport', 
      '@pathland/view',
      '@pathland/renderer-dom',
      '@pathland/platform-browser'
    ],
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
