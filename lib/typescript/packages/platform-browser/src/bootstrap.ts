/**
 * @pathland/platform-browser
 * 
 * Bootstrap utility for Pathland applications in the browser.
 * Provides a simple, Angular-like bootstrap function that handles
 * renderer setup, transport configuration, view initialization, and event handling.
 * 
 * By default, runs the application in a worker thread for better performance,
 * with only the renderer running on the main thread.
 */

import type { Renderer } from '@pathland/renderer';
import type { View, ViewNode } from '@pathland/view';
import type { Command } from '@pathland/protocol';
import type { Transport } from '@pathland/transport';
import { startWorker } from './worker';

// Type representing a View class with a static make() method
type ViewClass = { new (...args: any[]): View } & { make(...args: any[]): ViewNode };

// Type for the first parameter - can be a ViewClass (non-worker) or module path string (worker)
type AppSource = ViewClass | string;

// Lazy load the actual modules - these will be resolved by Vite at build time
// using the alias configuration
let rendererModule: { DOMRenderer: new (config?: any) => Renderer } | null = null;
let viewModule: { 
  initialRender: (root: ViewNode, transport: Transport) => void;
  handleDispatchEvent: (nodeId: number, eventType: number) => void;
} | null = null;



async function loadRendererModule() {
  if (!rendererModule) {
    // Use package import for @pathland/renderer-dom
    rendererModule = await import('@pathland/renderer-dom');
  }
  return rendererModule;
}

async function loadViewModule() {
  if (!viewModule) {
    // Use package import for @pathland/view
    viewModule = await import('@pathland/view');
  }
  return viewModule;
}

/**
 * Bootstrap a Pathland application in the browser.
 * 
 * This is the main entry point for Pathland applications. It automatically:
 * - Sets up the renderer (DOMRenderer by default, or a custom renderer)
 * - Configures the command transport
 * - Initializes the root view
 * - Connects renderer events to the view's event handlers
 * 
 * Note: When using DOMRenderer, it will automatically look for <app-root> element,
 * falling back to document.body if not found.
 * 
 * Mode is determined by the first parameter:
 * - String: Worker mode (module path to load in worker)
 * - ViewClass: Non-worker mode (everything runs in main thread)
 * 
 * @param appSource - Your root view. Can be:
 *                    - A View class (extends View) for non-worker mode
 *                    - A module path string (e.g., '/src/app.ts') for worker mode
 * @param options - Optional bootstrap options (currently only custom renderer)
 * @returns Promise that resolves when the application is bootstrapped
 *
 * @example
 * ```typescript
 * import { bootstrapApplication } from '@pathland/platform-browser';
 * import { App } from './app';
 *
 * // Non-worker mode: pass View class directly
 * bootstrapApplication(App);
 * ```
 *
 * @example
 * ```typescript
 * // Worker mode: pass module path (bundler handles the import)
 * import { bootstrapApplication } from '@pathland/platform-browser';
 *
 * bootstrapApplication('/src/app.ts');
 * ```
 *
 * @example
 * ```typescript
 * // With a custom renderer (non-worker mode)
 * import { bootstrapApplication } from '@pathland/platform-browser';
 * import { MyCustomRenderer } from './my-renderer';
 * import { App } from './app';
 *
 * bootstrapApplication(App, { renderer: new MyCustomRenderer(container) });
 * ```
 *
 * @example
 * ```html
 * <!-- Required in your HTML -->
 * <body>
 *   <app-root></app-root>
 * </body>
 * ```
 */

/**
 * Options for bootstrapApplication.
 */
export interface BootstrapOptions {
  /**
   * Custom renderer to use instead of the default DOMRenderer.
   * Must implement the Renderer interface.
   */
  renderer?: Renderer;
}

export async function bootstrapApplication(
  appSource: AppSource,
  options: BootstrapOptions = {}
): Promise<void> {
  // Determine mode based on appSource type:
  // - String: worker mode (module path to load in worker)
  // - ViewClass: non-worker mode (everything runs in main thread)
  const useWorker = typeof appSource === 'string';

  // Lazy load required packages
  const [rendererMod, viewMod] = await Promise.all([
    options.renderer ? Promise.resolve(null) : loadRendererModule(),
    useWorker ? Promise.resolve(null) : loadViewModule()
  ]);

  // Set up renderer on main thread
  const renderer: Renderer = options.renderer 
    ? options.renderer 
    : new (rendererMod as { DOMRenderer: new (config?: any) => Renderer }).DOMRenderer({});

  if (useWorker) {
    // WORKER MODE: appSource is a module path
    // Generate worker script dynamically using Blob
    // This avoids needing the developer to configure bundler for worker files
    
    // The worker script imports the app module and passes the View class to startWorker
    // This way, the dynamic import uses a literal string that bundlers can understand
    const workerScript = `
      import { startWorker } from '@pathland/platform-browser/worker';
      import App from '${appSource}';
      startWorker(undefined, App.default);
    `;
    
    const blob = new Blob([workerScript], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    
    // Create the worker with the generated script
    const worker = new Worker(workerUrl, { type: 'module' });
    
    // Set up message handler from worker
    worker.onmessage = (event) => {
      const message = event.data;
      if (message.type === 'COMMANDS') {
        // Forward commands to renderer
        if (message.commands) {
          renderer.executeCommands(message.commands);
        }
      } else if (message.type === 'BINARY') {
        // Handle binary data (if needed)
        // For now, we assume commands are already decoded
      } else if (message.type === 'ERROR') {
        console.error('[Pathland] Worker initialization error:', message.error);
      }
    };
    
    worker.onerror = (error) => {
      console.error('[Pathland] Worker error:', error);
    };
    
    // Set up event handling - renderer events go to worker thread
    renderer.setupEvents((nodeId: number, eventType: number) => {
      worker.postMessage({ type: 'EVENT', nodeId, eventType });
    });
  } else {
    // NON-WORKER MODE: appSource is a ViewClass
    const viewClass = appSource as ViewClass;
    const viewModSync = viewMod || await loadViewModule();
    
    // Set up transport - commands go directly to renderer
    const transport: Transport = {
      send: (commands: Command[]) => {
        renderer.executeCommands(commands);
      },
      sendBinary: () => {},
      close: () => {},
      onMessage: () => () => {},
      onError: () => () => {}
    };

    // Set up event handling - renderer sets up its own event listeners
    renderer.setupEvents((nodeId: number, eventType: number) => {
      viewModSync.handleDispatchEvent(nodeId, eventType);
    });

    // Create root view and initialize
    const root = viewClass.make();
    viewModSync.initialRender(root, transport);
  }
}

export default bootstrapApplication;
