/**
 * @pathland/platform-browser
 * 
 * Generates worker bundle URLs for Pathland applications.
 * Uses standard paths that work with any bundler.
 */

/**
 * Generate the URL for the worker bundle.
 * Returns a path to the worker entry file.
 * 
 * The application's bundler is responsible for:
 * - Processing this file as a worker
 * - Making the view module path importable by the worker
 * - Serving the worker file at the returned URL
 * 
 * @param appName - Optional application name for multi-app support (unused currently)
 * @returns The URL to the worker bundle
 */
export function generateWorkerBundleUrl(appName?: string): string {
  // In browser environment, return path to worker entry
  if (typeof document !== 'undefined') {
    // The application must configure their bundler to serve the worker at this path
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
