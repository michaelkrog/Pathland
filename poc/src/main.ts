/**
 * Pathland POC Main Entry Point
 *
 * Bootstraps the application in worker mode: the app runs in a worker thread
 * and emits binary command batches; the main thread renders them and forwards
 * events back to the worker.
 *
 * `?worker&url` is a Vite convention that yields the URL of the bundled worker
 * entry (src/worker.ts). The worker entry calls startWorker(() => POCApp).
 */

import { bootstrapApplication } from '@pathland/platform-browser';
import workerUrl from './worker?worker&url';

console.log('[Main] Starting bootstrap with worker URL:', workerUrl);

bootstrapApplication(workerUrl)
  .then(() => {
    console.log('✅ Pathland POC application started successfully with worker mode!');
  })
  .catch((error) => {
    console.error('❌ Failed to bootstrap Pathland application:', error);
    throw error;
  });
