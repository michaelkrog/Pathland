import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // For backwards compatibility with old POC
      '@pathland': path.resolve(__dirname, './src'),
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
