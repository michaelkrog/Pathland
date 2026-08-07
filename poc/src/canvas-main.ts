/**
 * Pathland POC - Canvas Renderer Entry
 *
 * Renders the SAME Pathland application (src/app.ts) on a <canvas> via the
 * CanvasRenderer, in worker mode: the app runs in a worker thread and emits
 * binary commands to the main thread, where the canvas renderer draws them.
 * This demonstrates "write once, run anywhere" - identical app + protocol,
 * different surface.
 */

import { bootstrapApplication } from '@pathland/platform-browser';
import { CanvasRenderer } from '@pathland/renderer-canvas';
import workerUrl from './worker?worker&url';

const canvas = document.getElementById('app') as HTMLCanvasElement;
const renderer = new CanvasRenderer({ canvas, width: 480, height: 2200 });

console.log('[Canvas] Starting bootstrap with worker URL:', workerUrl);

bootstrapApplication(workerUrl, { renderer })
  .then(() => {
    console.log('✅ Pathland POC rendered on canvas with worker mode!');
  })
  .catch((error) => {
    console.error('❌ Failed to bootstrap canvas application:', error);
    throw error;
  });
