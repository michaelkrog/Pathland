/**
 * @pathland/platform-browser
 *
 * Main-thread manager for a Pathland worker.
 *
 * Owns the worker ↔ main-thread message routing:
 * - Worker → main: binary command batches are decoded and executed by the
 *   renderer (protocol-first boundary).
 * - Main → worker: renderer events are forwarded to the worker, where the
 *   application handles them.
 *
 * A READY handshake resolves the start() promise once the worker has
 * initialized its view and flushed the initial command batch.
 */

import type { Command, EventData } from '@pathland/protocol';
import type { Renderer } from '@pathland/renderer';
import { deserializeMessage, createTransferable } from '@pathland/transport';

export type WorkerState = 'init' | 'starting' | 'ready' | 'error' | 'terminated';

/**
 * Manages a worker thread that runs Pathland application logic.
 */
export class WorkerManager {
  private worker: Worker | null = null;
  private renderer: Renderer;
  private state: WorkerState = 'init';
  private resolveReady: (() => void) | null = null;
  private rejectError: ((error: Error) => void) | null = null;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
  }

  /**
   * Attach to a worker and begin routing messages.
   * Resolves once the worker reports READY (its view initialized and the
   * initial command batch was executed); rejects if the worker errors.
   *
   * @param worker - The worker running the application
   */
  start(worker: Worker): Promise<void> {
    if (this.state !== 'init') {
      return Promise.reject(new Error('[Pathland] WorkerManager is already started'));
    }

    this.worker = worker;
    this.state = 'starting';

    return new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectError = reject;

      worker.onmessage = (event: MessageEvent) => {
        const message = event.data as { type: string; buffer?: ArrayBuffer; error?: string };
        if (!message) return;

        switch (message.type) {
          case 'BINARY':
            if (message.buffer) {
              const decoded = deserializeMessage(message.buffer);
              this.renderer.executeCommands(decoded.commands);
            }
            break;

          case 'READY':
            this.state = 'ready';
            this.resolveReady?.();
            this.resolveReady = null;
            break;

          case 'ERROR':
            this.state = 'error';
            this.rejectError?.(new Error(message.error || 'Unknown worker error'));
            this.rejectError = null;
            break;

          default:
            console.warn(`[Pathland] Unknown worker message type: ${message.type}`);
        }
      };

      worker.onerror = (event: ErrorEvent) => {
        this.state = 'error';
        this.rejectError?.(new Error(event.message || 'Worker error'));
        this.rejectError = null;
      };
    });
  }

  /**
   * Send a DISPATCH_EVENT instruction to the worker for handling, encoded as
   * a binary message (the protocol is the wire contract between threads).
   */
  sendEventToWorker(nodeId: number, eventType: number, data?: EventData): void {
    this.sendBinaryToWorker([{ opcode: 'DISPATCH_EVENT', targetId: nodeId, eventType, data }]);
  }

  /**
   * Send a GESTURE_UPDATE instruction to the worker for handling, encoded as
   * a binary message.
   */
  sendGestureToWorker(
    nodeId: number,
    gestureType: number,
    gestureState: number,
    data?: EventData
  ): void {
    this.sendBinaryToWorker([
      { opcode: 'GESTURE_UPDATE', targetId: nodeId, gestureType, gestureState, gestureId: 0, data },
    ]);
  }

  private sendBinaryToWorker(commands: Command[]): void {
    if (this.state === 'ready' && this.worker) {
      const { message, transferList } = createTransferable(commands);
      this.worker.postMessage({ type: 'BINARY', buffer: message }, transferList);
    } else if (this.state === 'starting') {
      console.warn('[Pathland] Cannot send to worker before it is ready');
    } else if (this.state === 'error') {
      console.error('[Pathland] Cannot send to worker - worker is in error state');
    }
  }

  /**
   * Terminate the worker thread.
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.state = 'terminated';
    this.resolveReady = null;
    this.rejectError = null;
  }

  getState(): WorkerState {
    return this.state;
  }

  isReady(): boolean {
    return this.state === 'ready';
  }

  hasError(): boolean {
    return this.state === 'error';
  }
}

export type { Command };
