/**
 * @pathland/platform-browser
 * 
 * Bootstrap and platform-specific utilities for Pathland applications.
 * By default, runs application logic in a worker thread with only rendering on main thread.
 */

export { bootstrapApplication } from './bootstrap';
export type { BootstrapOptions } from './bootstrap';
export { bootstrapApplication as default } from './bootstrap';

// Export worker-related utilities
export { WorkerManager, generateWorkerBundleUrl, resolveViewModulePath } from './worker';
export type { WorkerConfig, WorkerMessage, WorkerState } from './worker';

// Re-export types for convenience
export type { Renderer } from '@pathland/renderer';
export type { Transport } from '@pathland/transport';
export type { Command } from '@pathland/protocol';
