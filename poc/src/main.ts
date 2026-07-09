/**
 * Pathland POC Main Entry Point
 * 
 * Uses the bootstrapApplication method from platform-browser package.
 */

import { bootstrapApplication } from '@pathland/platform-browser';
import { POCApp } from './app';

// Bootstrap the application using the platform-browser utility
// Use worker mode for better performance
// Note: In Vite, worker files need to be referenced with ?worker suffix
const workerUrl = new URL('/src/worker.ts?worker', window.location.origin).toString();

bootstrapApplication(POCApp, {
  useWorker: true,
  workerUrl: workerUrl,
  viewModulePath: '/src/app.ts'
})
  .then(() => {
    console.log('✅ Pathland POC application started successfully with worker mode!');
  })
  .catch((error) => {
    console.error('❌ Failed to bootstrap Pathland application:', error);
    throw error;
  });
