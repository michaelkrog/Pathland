/**
 * Pathland POC Worker Entry
 *
 * Runs the Pathland application inside a worker thread. This module is bundled
 * by the application's bundler (Vite) as the worker; it loads the app and lets
 * the platform-browser worker runtime emit binary command batches to the main
 * thread and receive events from the renderer.
 */

import { startWorker } from '@pathland/platform-browser/worker';
import POCApp from './app';

startWorker(() => POCApp);
