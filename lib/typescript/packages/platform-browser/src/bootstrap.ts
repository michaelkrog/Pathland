/**
 * @pathland/platform-browser
 *
 * Bootstrap utility for Pathland applications in the browser.
 *
 * By default the application runs in a worker thread:
 * - The worker builds the view tree and emits binary command batches.
 * - The main thread receives them, decodes them, and executes them with the
 *   renderer (DOMRenderer by default).
 * - The renderer forwards events back to the worker, where the application
 *   handles them.
 *
 * Passing a View class instead runs everything on the main thread.
 */

import type { Renderer } from '@pathland/renderer';
import type { View, ViewNode } from '@pathland/view';
import type { Command } from '@pathland/protocol';
import type { Transport } from '@pathland/transport';
import { WorkerManager } from './worker';

// Type representing a View class with a static make() method
type ViewClass = { new (...args: any[]): View } & { make(...args: any[]): ViewNode };

/**
 * Application source:
 * - View class  → non-worker mode (runs on the main thread)
 * - Worker      → worker mode (already-created worker running the app)
 * - string      → worker mode (URL of the worker entry module to create)
 */
export type AppSource = ViewClass | Worker | string;

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

async function createDefaultRenderer(): Promise<Renderer> {
  const { DOMRenderer } = await import('@pathland/renderer-dom');
  return new DOMRenderer({});
}

function isWorkerSource(source: AppSource): source is Worker | string {
  return typeof source === 'string' || (typeof Worker !== 'undefined' && source instanceof Worker);
}

function createWorker(source: Worker | string): Worker {
  return typeof source === 'string' ? new Worker(source, { type: 'module' }) : source;
}

/**
 * Bootstrap a Pathland application in the browser.
 *
 * @param appSource - The application source. A View class for non-worker mode,
 *                    or a Worker / worker module URL for worker mode.
 * @param options - Optional bootstrap options.
 * @returns Promise that resolves when the application is bootstrapped (for
 *          worker mode, when the worker reports READY).
 *
 * @example
 * ```typescript
 * // Worker mode: pass the URL of the worker entry module.
 * // The worker entry calls startWorker(() => App) (see @pathland/platform-browser/worker).
 * import workerUrl from './worker?worker&url';
 * bootstrapApplication(workerUrl);
 * ```
 *
 * @example
 * ```typescript
 * // Worker mode with a pre-built Worker.
 * const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
 * bootstrapApplication(worker);
 * ```
 *
 * @example
 * ```typescript
 * // Non-worker mode: pass a View class directly.
 * import { App } from './app';
 * bootstrapApplication(App);
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
export async function bootstrapApplication(
  appSource: AppSource,
  options: BootstrapOptions = {}
): Promise<void> {
  const renderer: Renderer = options.renderer ? options.renderer : await createDefaultRenderer();

  if (isWorkerSource(appSource)) {
    // WORKER MODE: application runs in a worker; renderer on main thread.
    const worker = createWorker(appSource);
    const manager = new WorkerManager(renderer);

    // Renderer events and gestures are forwarded to the worker (as binary
    // DISPATCH_EVENT / GESTURE_UPDATE instructions), which routes them to the
    // application's handlers.
    renderer.setupEvents((nodeId: number, eventType: number, data) => {
      manager.sendEventToWorker(nodeId, eventType, data);
    });
    renderer.setupGestures((nodeId: number, gestureType: number, gestureState: number, data) => {
      manager.sendGestureToWorker(nodeId, gestureType, gestureState, data);
    });

    // Resolves once the worker reports READY (initial render executed).
    await manager.start(worker);
    return;
  }

  // NON-WORKER MODE: everything runs on the main thread.
  const viewModule = await import('@pathland/view');
  const viewClass = appSource as ViewClass;

  const transport: Transport = {
    send: (commands: Command[]) => {
      renderer.executeCommands(commands);
    },
    sendBinary: () => {},
    close: () => {},
    onMessage: () => () => {},
    onError: () => () => {},
  };

  renderer.setupEvents((nodeId: number, eventType: number, data) => {
    viewModule.handleDispatchEvent(nodeId, eventType, data);
  });
  renderer.setupGestures((nodeId: number, gestureType: number, gestureState: number, data) => {
    viewModule.handleGestureUpdate(nodeId, gestureType, gestureState, data);
  });

  const root = viewClass.make();
  viewModule.initialRender(root, transport);
}

export default bootstrapApplication;
