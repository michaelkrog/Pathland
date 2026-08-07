/**
 * @pathland/platform-browser
 *
 * Worker-side entry point for Pathland applications.
 *
 * The application runs in a worker thread: it builds its view tree and emits
 * binary command messages to the main thread, where the renderer executes
 * them. The renderer sends events and gestures back to the worker as binary
 * protocol instructions (DISPATCH_EVENT / GESTURE_UPDATE), which are routed to
 * the application's handlers.
 *
 * This file is intended to run inside a worker bundled by the application
 * (e.g. `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })`).
 */

import type { Command } from '@pathland/protocol';
import type { Transport } from '@pathland/transport';
import { createTransferable, deserializeMessage } from '@pathland/transport';
import type { View, ViewNode } from '@pathland/view';

// The DOM lib types `self` as `Window`; inside a worker it is a
// WorkerGlobalScope (different postMessage signature). Use a structural type.
type WorkerScope = {
  onmessage: ((event: MessageEvent) => void) | null;
  postMessage(message: any, transfer?: Transferable[]): void;
};
const scope = self as unknown as WorkerScope;

// Type representing a View class with a static make() method
export type ViewClass = { new (...args: any[]): View } & { make(...args: any[]): ViewNode };

/**
 * Loader that returns the application's root view class.
 * The application's worker entry provides this (bundled by the app's bundler).
 */
export type ViewLoader = () => ViewClass | Promise<ViewClass>;

/**
 * Create a transport that sends commands to the main thread as zero-copy
 * binary messages (protocol-first: encoded via the binary protocol).
 */
function createWorkerTransport(): Transport {
  return {
    send(commands: Command[]): void {
      const { message, transferList } = createTransferable(commands);
      scope.postMessage({ type: 'BINARY', buffer: message }, transferList);
    },
    sendBinary(): void {
      // Commands are always sent encoded via send(); raw binary is not used.
    },
    close(): void {},
    onMessage: () => () => {},
    onError: () => () => {},
  };
}

/**
 * Start the application inside the worker.
 *
 * @param loadView - Function that resolves to the root View class. This is
 *                   provided by the application's worker entry.
 */
export function startWorker(loadView: ViewLoader): void {
  let handleDispatchEventRef: ((nodeId: number, eventType: number, data?: any) => void) | null = null;
  let handleGestureUpdateRef: ((nodeId: number, gestureType: number, gestureState: number, data?: any) => void) | null = null;

  // Handle binary instructions coming from the renderer on the main thread:
  // DISPATCH_EVENT and GESTURE_UPDATE are routed to the view.
  scope.onmessage = (event: MessageEvent) => {
    const data = event.data;
    if (data && data.type === 'BINARY' && data.buffer) {
      const { commands } = deserializeMessage(data.buffer);
      for (const command of commands) {
        if (command.opcode === 'DISPATCH_EVENT') {
          handleDispatchEventRef?.(command.targetId, command.eventType, command.data);
        } else if (command.opcode === 'GESTURE_UPDATE') {
          handleGestureUpdateRef?.(command.targetId, command.gestureType, command.gestureState, command.data);
        }
      }
    }
  };

  // Initialize immediately: the loader is already in scope (bundled with the app).
  (async () => {
    try {
      const { initialRender, handleDispatchEvent, handleGestureUpdate } = await import('@pathland/view');
      handleDispatchEventRef = handleDispatchEvent;
      handleGestureUpdateRef = handleGestureUpdate;

      const viewClass = await loadView();
      const root = viewClass.make();
      initialRender(root, createWorkerTransport());

      scope.postMessage({ type: 'READY' });
    } catch (error: any) {
      scope.postMessage({ type: 'ERROR', error: error?.message || String(error) });
    }
  })();
}

export default startWorker;
