/**
 * @pathland/platform-browser
 * 
 * Worker module exports.
 * Contains all worker-related functionality for running Pathland applications
 * on a separate thread.
 */

export { startWorker } from './worker';
export { WorkerManager } from './worker-manager';
export type { WorkerConfig, WorkerMessage, WorkerState } from './worker-manager';
export { generateWorkerBundleUrl, resolveViewModulePath } from './generate-worker-bundle';
