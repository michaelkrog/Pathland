/**
 * @pathland/platform-browser
 * 
 * Generates worker bundle URLs for Pathland applications.
 * Handles both development and production environments.
 */

// Type for import.meta.env in Vite
interface ImportMetaEnv {
  DEV: boolean;
  PROD: boolean;
  MODE: string;
}

interface ImportMeta {
  url: string;
  env: ImportMetaEnv;
}

declare const __DEV__: boolean;

/**
 * Generate the URL for the worker bundle.
 * In development with Vite, uses a virtual worker URL that Vite can process.
 * In production, uses a pre-built worker bundle path.
 * 
 * @param appName - Optional application name for multi-app support
 * @returns The URL to the worker bundle
 */
export function generateWorkerBundleUrl(appName?: string): string {
  // Check if we're in a browser environment
  if (typeof document !== 'undefined') {
    // Browser environment
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      // Development mode with Vite
      // In development, we use a virtual worker path that Vite can resolve
      return new URL(
        '/@id/__x00__/@pathland/platform-browser/src/worker/entry.ts',
        window.location.origin
      ).toString();
    }
    
    // Production mode
    // Assume worker bundle is at a standard location
    return `/pathland-worker${appName ? `-${appName}` : ''}.js`;
  }
  
  // Fallback for non-browser environments (shouldn't happen in practice)
  return '/pathland-worker.js';
}

/**
 * Resolve the path to the view module for a given view class.
 * This is used by the main thread to tell the worker which module to import.
 * 
 * @param viewClass - The view class to resolve
 * @returns The module path as a string that can be dynamically imported
 */
export function resolveViewModulePath(viewClass: { name: string }): string {
  // In production, the view classes are bundled together
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return '/views-bundle.js';
  }
  
  // In development with Vite, we need to resolve the actual module path.
  // The default behavior uses a relative path, but users should provide
  // the correct path via BootstrapOptions.viewModulePath for their specific setup.
  // This is a placeholder that should be overridden by users.
  return './app';
}

export default {
  generateWorkerBundleUrl,
  resolveViewModulePath
};