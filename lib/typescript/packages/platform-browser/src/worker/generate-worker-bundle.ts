/**
 * @pathland/platform-browser
 * 
 * Generates worker bundle URLs for Pathland applications.
 * Uses standard paths that work with any bundler.
 */

// Global variable set by Vite in development
declare const __DEV__: boolean;

/**
 * Generate the URL for the worker bundle.
 * Returns a path to the worker entry file in the platform-browser package.
 * 
 * The bundler is responsible for:
 * - Processing this file as a worker
 * - Making the view module path importable by the worker
 * 
 * @param appName - Optional application name for multi-app support (unused currently)
 * @returns The URL to the worker bundle
 */
export function generateWorkerBundleUrl(appName?: string): string {
  // In browser environment, return path to worker entry
  if (typeof document !== 'undefined') {
    // For development with Vite, use a path that Vite can serve
    // In production, use a standard path
    // The actual worker file path depends on the app's configuration
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      return '/src/pathland-worker.ts';
    }
    return '/pathland-worker.js';
  }
  
  // Fallback for non-browser environments
  return '/pathland-worker.js';
}

/**
 * Resolve the path to the view module for a given view class.
 * This is used as a fallback when the developer doesn't provide a module path.
 * 
 * Note: This is a best-effort fallback. For worker mode, developers should
 * provide the module path explicitly for reliable results across bundlers.
 * 
 * @param viewClass - The view class to resolve
 * @returns The module path as a string that can be dynamically imported
 */
export function resolveViewModulePath(viewClass: { name: string }): string {
  // This is a placeholder - developers should provide the module path explicitly
  // for worker mode to ensure it works across all bundlers.
  // In non-worker mode, this isn't used.
  return './app';
}

export default {
  generateWorkerBundleUrl,
  resolveViewModulePath
};
