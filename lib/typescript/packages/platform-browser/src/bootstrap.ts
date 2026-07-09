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
import { WorkerManager, generateWorkerBundleUrl, resolveViewModulePath } from './worker';

// Type representing a View class with a static make() method
type ViewClass = { new (...args: any[]): View } & { make(...args: any[]): ViewNode };

// Type representing a lazy import function that resolves to a View class
type ViewClassProvider = () => Promise<ViewClass>;

// Union type for both direct class and lazy import
type ViewClassOrProvider = ViewClass | ViewClassProvider;

// Lazy load the actual modules - these will be resolved by Vite at build time
// using the alias configuration
let rendererModule: { DOMRenderer: new (config?: any) => Renderer } | null = null;
let viewModule: { 
  initialRender: (root: ViewNode, transport: Transport) => void;
  handleDispatchEvent: (nodeId: number, eventType: number) => void;
} | null = null;

// Cache for worker manager instances
let workerManager: WorkerManager | null = null;

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
 * By default, runs in worker mode for better performance. Set useWorker: false
 * to run everything on the main thread.
 *
 * @param viewClassOrProvider - Your root view class (extends View) or a function that
 *                               returns a promise of your view class for lazy loading
 * @param options - Optional bootstrap options including custom renderer
 * @returns Promise that resolves when the application is bootstrapped
 *
 * @example
 * ```typescript
 * import { bootstrapApplication } from '@pathland/platform-browser';
 * import { App } from './app';
 *
 * // Direct class reference
 * bootstrapApplication(App);
 * ```
 *
 * @example
 * ```typescript
 * // With lazy import (recommended for worker mode)
 * import { bootstrapApplication } from '@pathland/platform-browser';
 *
 * bootstrapApplication(() => import('./app').then(m => m.App));
 * ```
 *
 * @example
 * ```typescript
 * // With a custom renderer
 * import { bootstrapApplication } from '@pathland/platform-browser';
 * import { MyCustomRenderer } from './my-renderer';
 * import { App } from './app';
 *
 * bootstrapApplication(App, { renderer: new MyCustomRenderer(container) });
 * ```
 *
 * @example
 * ```typescript
 * // With explicit worker configuration
 * import { bootstrapApplication } from '@pathland/platform-browser';
 *
 * bootstrapApplication(() => import('./app').then(m => m.App), {
 *   useWorker: true,
 *   viewModulePath: '/src/app.ts'
 * });
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
  
  /**
   * Whether to use a worker thread for application logic.
   * Defaults to true for better performance.
   * Set to false to run everything on the main thread (legacy mode).
   */
  useWorker?: boolean;
  
  /**
   * Custom URL for the worker bundle.
   * If not provided, uses the default worker bundle URL.
   */
  workerUrl?: string;
  
  /**
   * Path to the view module for the worker to import.
   * If not provided, will try to resolve automatically.
   * Use this when the worker needs to import view classes from a specific path.
   */
  viewModulePath?: string;
}

export async function bootstrapApplication(
  viewClassOrProvider: ViewClassOrProvider,
  options: BootstrapOptions = {}
): Promise<void> {
  // Use worker by default for better performance
  const useWorker = options.useWorker !== false;
  
  // 1. Resolve the view class and determine module information
  let viewClass: ViewClass;
  let viewModulePath: string;
  let viewClassName: string;
  
  if (typeof viewClassOrProvider === 'function') {
    // Lazy import mode - the function returns a promise of the view class
    const viewClassProvider = viewClassOrProvider as ViewClassProvider;
    const viewClassPromise = viewClassProvider();
    
    // Resolve the view class (needed for non-worker mode and for class name)
    viewClass = await viewClassPromise;
    
    // Use provided module path or default
    viewModulePath = options.viewModulePath || '/src/app.ts';
    viewClassName = viewClass.name;
  } else {
    // Direct class mode
    viewClass = viewClassOrProvider;
    viewModulePath = options.viewModulePath || resolveViewModulePath(viewClass);
    viewClassName = viewClass.name;
  }

  // 2. Lazy load required packages
  const [rendererMod, viewMod] = await Promise.all([
    options.renderer ? Promise.resolve(null) : loadRendererModule(),
    useWorker ? Promise.resolve(null) : loadViewModule()
  ]);

  // 3. Set up renderer on main thread - use custom renderer or create DOMRenderer
  const renderer: Renderer = options.renderer 
    ? options.renderer 
    : new (rendererMod as { DOMRenderer: new (config?: any) => Renderer }).DOMRenderer({});

  if (useWorker) {
    // 4. WORKER MODE: Application logic runs in worker thread, renderer on main thread
    const workerUrl = options.workerUrl || generateWorkerBundleUrl();
    
    // Create worker manager to handle communication
    workerManager = new WorkerManager(renderer);
    
    // Start the worker with the view class information
    workerManager.startWorker(workerUrl, {
      viewModulePath: viewModulePath,
      viewClassName: viewClassName
    });
    
    // 5. Set up event handling - renderer events go to worker thread
    renderer.setupEvents((nodeId: number, eventType: number) => {
      workerManager?.sendEventToWorker(nodeId, eventType);
    });
  } else {
    // 4. LEGACY MODE: Everything runs on main thread
    
    // Ensure view module is loaded
    const viewModSync = viewMod || await loadViewModule();
    
    // 5. Set up transport - commands go directly to renderer
    const transport: Transport = {
      send: (commands: Command[]) => {
        renderer.executeCommands(commands);
      },
      sendBinary: () => {},
      close: () => {},
      onMessage: () => () => {},
      onError: () => () => {}
    };

    // 6. Set up event handling - renderer sets up its own event listeners
    renderer.setupEvents((nodeId: number, eventType: number) => {
      viewModSync.handleDispatchEvent(nodeId, eventType);
    });

    // 7. Create root view and initialize
    // viewClass.make() returns the ViewNode tree
    const root = viewClass.make();
    viewModSync.initialRender(root, transport);
  }
}

export default bootstrapApplication;
