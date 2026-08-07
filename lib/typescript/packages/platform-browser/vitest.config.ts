/**
 * @pathland/platform-browser
 * 
 * Vitest configuration for platform-browser package tests.
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

// Resolve package paths for tests
const resolvePackagePath = (packageName: string) => {
  return path.resolve(__dirname, '../..', 'packages', packageName, 'src');
};

export default defineConfig({
  test: {
    // Use jsdom for DOM testing
    environment: 'jsdom',
    globals: true,
    
    // Include test files
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    
    // Setup files
    setupFiles: ['./src/test/setup.ts'],
    
    // Coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/test/**']
    }
  },
  
  resolve: {
    alias: {
      // Map @pathland packages to their source directories for testing
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
