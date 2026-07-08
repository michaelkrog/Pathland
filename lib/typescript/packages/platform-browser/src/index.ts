/**
 * @pathland/platform-browser
 * 
 * Bootstrap and platform-specific utilities for Pathland applications.
 */

export { bootstrapApplication } from './bootstrap';
export type { BootstrapOptions } from './bootstrap';
export { bootstrapApplication as default } from './bootstrap';

// Re-export types for convenience
export type { Renderer } from '@pathland/renderer';
