/**
 * @pathland/platform-browser
 * 
 * Manages communication between main thread and worker thread.
 * Handles worker lifecycle, command dispatch, and event routing.
 */

import type { Command } from '@pathland/protocol';
import type { Renderer } from '@pathland/renderer';

interface WorkerMessage {
  type: 'INIT' | 'EVENT' | 'COMMANDS' | 'BINARY' | 'READY' | 'ERROR';
  viewModulePath?: string;
  viewClassName?: string;
  nodeId?: number;
  eventType?: number;
  commands?: Command[];
  buffer?: Uint8Array;
  error?: string;
}

interface WorkerConfig {
  viewModulePath: string;
  viewClassName: string;
}

/**
 * Worker state
 */
type WorkerState = 'init' | 'starting' | 'ready' | 'error' | 'terminated';

/**
 * Manages a worker thread for running Pathland application logic.
 * The worker runs view classes and generates commands, while the main thread
 * runs the renderer to execute those commands.
 */
export class WorkerManager {
  private worker: Worker | null = null;
  private renderer: Renderer;
  private state: WorkerState = 'init';
  private pendingCommands: Command[] = [];
  private pendingEvents: Array<{ nodeId: number; eventType: number }> = [];

  constructor(renderer: Renderer) {
    this.renderer = renderer;
  }

  /**
   * Start the worker thread with the given configuration.
   * @param workerUrl - URL to the worker entry point
   * @param config - Configuration for initializing the worker
   */
  startWorker(workerUrl: string, config: WorkerConfig): void {
    if (this.state !== 'init') {
      console.warn('[Pathland] Worker is already started or in an invalid state');
      return;
    }

    this.state = 'starting';

    try {
      console.log('[WorkerManager] Creating worker with URL:', workerUrl);
      // Use module type to support ES module syntax in workers
      this.worker = new Worker(workerUrl, { type: 'module' });

      // Set up message handler from worker
      this.worker.onmessage = (event: MessageEvent) => {
        const message = event.data as WorkerMessage;
        console.log('[WorkerManager] Received message from worker:', message.type);
        this.handleWorkerMessage(message);
      };

      // Set up error handler
      this.worker.onerror = (error: ErrorEvent) => {
        console.error('[Pathland] Worker error:', error);
        this.state = 'error';
      };

      // Send initialization message to worker
      this.worker.postMessage({
        type: 'INIT',
        viewModulePath: config.viewModulePath,
        viewClassName: config.viewClassName
      } as any);

    } catch (error) {
      console.error('[Pathland] Failed to create worker:', error);
      this.state = 'error';
      throw error;
    }
  }

  /**
   * Handle messages received from the worker thread.
   */
  private handleWorkerMessage(message: WorkerMessage): void {
    switch (message.type) {
      case 'READY':
        this.state = 'ready';
        // Flush pending commands
        this.pendingCommands.forEach(cmd => this.sendCommandToWorker(cmd));
        this.pendingCommands = [];
        // Flush pending events
        this.pendingEvents.forEach(event => this.sendEventToWorker(event.nodeId, event.eventType));
        this.pendingEvents = [];
        break;

      case 'COMMANDS':
        // Forward commands to renderer
        if (message.commands) {
          this.renderer.executeCommands(message.commands);
        }
        break;

      case 'BINARY':
        // Handle binary data (if needed)
        // For now, we assume commands are already decoded
        break;

      case 'ERROR':
        console.error('[Pathland] Worker initialization error:', message.error);
        this.state = 'error';
        break;

      default:
        console.warn('[Pathland] Unknown worker message type:', message.type);
    }
  }

  /**
   * Send a command to the worker for processing.
   * If worker is not ready, queues the command.
   */
  sendCommandToWorker(command: Command): void {
    if (this.state === 'ready' && this.worker) {
      this.worker.postMessage({
        type: 'COMMANDS',
        commands: [command]
      });
    } else if (this.state === 'starting') {
      // Queue command until worker is ready
      this.pendingCommands.push(command);
    } else if (this.state === 'error') {
      console.error('[Pathland] Cannot send command - worker is in error state');
    }
  }

  /**
   * Send an event to the worker for handling.
   * If worker is not ready, queues the event.
   */
  sendEventToWorker(nodeId: number, eventType: number): void {
    if (this.state === 'ready' && this.worker) {
      this.worker.postMessage({
        type: 'EVENT',
        nodeId,
        eventType
      });
    } else if (this.state === 'starting') {
      // Queue event until worker is ready
      this.pendingEvents.push({ nodeId, eventType });
    } else if (this.state === 'error') {
      console.error('[Pathland] Cannot send event - worker is in error state');
    }
  }

  /**
   * Get the current state of the worker.
   */
  getState(): WorkerState {
    return this.state;
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
  }

  /**
   * Check if the worker is ready to receive commands.
   */
  isReady(): boolean {
    return this.state === 'ready';
  }

  /**
   * Check if the worker is in an error state.
   */
  hasError(): boolean {
    return this.state === 'error';
  }
}

export type { WorkerConfig, WorkerMessage, WorkerState };