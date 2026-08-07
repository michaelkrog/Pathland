/**
 * @pathland/platform-browser
 *
 * Worker module exports.
 * Contains all worker-related functionality for running Pathland applications
 * on a separate thread.
 */

export { startWorker } from './worker';
export type { ViewLoader, ViewClass } from './worker';
export { WorkerManager } from './worker-manager';
export type { WorkerState } from './worker-manager';
