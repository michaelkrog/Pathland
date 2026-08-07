/**
 * @pathland/platform-browser
 *
 * Bootstrap and platform-specific utilities for Pathland applications.
 * By default, runs application logic in a worker thread with only rendering
 * on the main thread.
 */

export { bootstrapApplication } from './bootstrap';
export type { BootstrapOptions, AppSource } from './bootstrap';
export { bootstrapApplication as default } from './bootstrap';

// Export worker-related utilities
export { WorkerManager, startWorker } from './worker';
export type { WorkerState, ViewLoader, ViewClass } from './worker';

// Re-export types for convenience
export type { Renderer } from '@pathland/renderer';
export type { Transport } from '@pathland/transport';
export type { Command } from '@pathland/protocol';
