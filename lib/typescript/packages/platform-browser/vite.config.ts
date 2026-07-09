/**
 * @pathland/platform-browser
 * 
 * Vite configuration for the platform-browser package.
 * Handles both the main bundle and worker bundle generation.
 */

import { defineConfig } from 'vite';
import path from 'path';

// Get the root directory of the typescript lib
const libRoot = path.resolve(__dirname, '../../..');

// Resolve package paths
const resolvePackagePath = (packageName: string) => {
  return path.resolve(libRoot, 'packages', packageName);
};

export default defineConfig({
  build: {
    // Build both the main entry and worker entry
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/index.ts'),
        worker: path.resolve(__dirname, 'src/worker/entry.ts')
      },
      output: {
        entryFileNames: '[name].js',
        assetFileNames: '[name]-[hash].[ext]'
      },
      // Externalize other @pathland packages to avoid bundling them
      external: [
        '@pathland/protocol',
        '@pathland/transport',
        '@pathland/view',
        '@pathland/renderer',
        '@pathland/renderer-dom'
      ]
    },
    // Don't minify in development for easier debugging
    minify: false,
    // Output to dist folder
    outDir: 'dist',
    emptyOutDir: true
  },
  
  // Worker-specific configuration
  worker: {
    format: 'es',
    rollupOptions: {
      output: {
        entryFileNames: '[name].js'
      },
      external: [
        '@pathland/protocol',
        '@pathland/transport',
        '@pathland/view'
      ]
    }
  },
  
  resolve: {
    alias: {
      // Ensure @pathland packages are resolved correctly
      '@pathland/protocol': resolvePackagePath('protocol'),
      '@pathland/transport': resolvePackagePath('transport'),
      '@pathland/view': resolvePackagePath('view'),
      '@pathland/renderer': resolvePackagePath('renderer'),
      '@pathland/renderer-dom': resolvePackagePath('renderer-dom')
    }
  },
  
  esbuild: {
    target: 'es2020'
  }
});
