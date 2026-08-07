/**
 * Pathland POC Main Entry Point
 * 
 * Uses the bootstrapApplication method from platform-browser package.
 */

import { bootstrapApplication } from '@pathland/platform-browser';

// Bootstrap the application using the platform-browser utility
// For worker mode (default), pass the module path to the app
// The bundler (Vite) is responsible for making this importable by the worker
bootstrapApplication('/src/app.ts')
  .then(() => {
    console.log('✅ Pathland POC application started successfully with worker mode!');
  })
  .catch((error) => {
    console.error('❌ Failed to bootstrap Pathland application:', error);
    throw error;
  });
