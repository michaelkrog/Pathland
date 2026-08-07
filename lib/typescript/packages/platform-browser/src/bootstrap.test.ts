/**
 * @pathland/platform-browser
 *
 * Tests for bootstrapApplication (worker mode + non-worker fallback).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { encodeMessage } from '@pathland/protocol';
import { bootstrapApplication } from './bootstrap';

// Collect the renderer instance the mocked DOMRenderer produces.
// vi.hoisted makes these available to the (hoisted) mock factories below.
const { rendererInstance, viewModule } = vi.hoisted(() => ({
  rendererInstance: {
    executeCommands: vi.fn(),
    setupEvents: vi.fn(),
  },
  viewModule: {
    initialRender: vi.fn(),
    handleDispatchEvent: vi.fn(),
  },
}));

// Mock the lazily-loaded packages.
vi.mock('@pathland/renderer-dom', () => ({
  DOMRenderer: class {
    constructor() {
      return rendererInstance;
    }
  },
}));

vi.mock('@pathland/view', () => viewModule);

let workerInstances: any[] = [];

class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  messages: any[] = [];
  url: string;

  constructor(url: string, _opts?: any) {
    this.url = url;
    workerInstances.push(this);
  }

  postMessage(message: any): void {
    this.messages.push(message);
  }

  terminate(): void {
    this.onmessage = null;
    this.onerror = null;
  }

  emit(message: any): void {
    this.onmessage?.({ data: message } as MessageEvent);
  }

  fail(message: string): void {
    this.onerror?.({ message } as ErrorEvent);
  }
}

const MockView: any = class {
  static make() {
    return { type: 'MockViewNode' } as any;
  }
};

describe('bootstrapApplication', () => {
  let originalWorker: any;

  beforeEach(() => {
    originalWorker = globalThis.Worker;
    (globalThis as any).Worker = MockWorker;
    workerInstances = [];
    vi.clearAllMocks();
  });

  afterEach(() => {
    (globalThis as any).Worker = originalWorker;
  });

  describe('worker mode', () => {
    it('creates a worker from a URL and resolves on READY', async () => {
      const promise = bootstrapApplication('worker-url.js');

      await vi.waitFor(() => {
        expect(workerInstances).toHaveLength(1);
      });
      expect(workerInstances[0].url).toBe('worker-url.js');

      workerInstances[0].emit({ type: 'READY' });
      await expect(promise).resolves.toBeUndefined();
    });

    it('accepts a pre-built Worker instance', async () => {
      const worker = new MockWorker('prebuilt.js');
      const promise = bootstrapApplication(worker as any);

      // Wait until bootstrap has attached its message handler (manager.start).
      await vi.waitFor(() => {
        expect(worker.onmessage).not.toBeNull();
      });
      worker.emit({ type: 'READY' });
      await expect(promise).resolves.toBeUndefined();
    });

    it('rejects when the worker reports an error', async () => {
      const promise = bootstrapApplication('worker-url.js');

      await vi.waitFor(() => {
        expect(workerInstances).toHaveLength(1);
      });
      workerInstances[0].emit({ type: 'ERROR', error: 'init failed' });
      await expect(promise).rejects.toThrow('init failed');
    });

    it('decodes binary command batches and executes them with the renderer', async () => {
      const promise = bootstrapApplication('worker-url.js');

      await vi.waitFor(() => {
        expect(workerInstances).toHaveLength(1);
      });
      const worker = workerInstances[0];

      const commands = [
        { opcode: 'CREATE_NODE' as const, nodeId: 1, componentType: 0x0002, properties: new Map() },
        { opcode: 'INSERT_CHILD' as const, parentId: 1, childId: 2, index: 0 },
      ];
      worker.emit({ type: 'BINARY', buffer: encodeMessage(commands) });
      worker.emit({ type: 'READY' });
      await promise;

      expect(rendererInstance.executeCommands).toHaveBeenCalledWith(commands);
    });

    it('forwards renderer events to the worker', async () => {
      const promise = bootstrapApplication('worker-url.js');

      await vi.waitFor(() => {
        expect(workerInstances).toHaveLength(1);
      });
      const worker = workerInstances[0];
      worker.emit({ type: 'READY' });
      await promise;

      // Capture the dispatch callback registered via renderer.setupEvents.
      const dispatch = rendererInstance.setupEvents.mock.calls[0][0];
      dispatch(5, 0x04);

      expect(worker.messages).toContainEqual({ type: 'EVENT', nodeId: 5, eventType: 0x04 });
    });

    it('uses a custom renderer when provided', async () => {
      const custom = { executeCommands: vi.fn(), setupEvents: vi.fn() };
      const promise = bootstrapApplication('worker-url.js', { renderer: custom as any });

      await vi.waitFor(() => {
        expect(workerInstances).toHaveLength(1);
      });
      workerInstances[0].emit({ type: 'READY' });
      await promise;

      expect(custom.setupEvents).toHaveBeenCalled();
    });
  });

  describe('non-worker mode', () => {
    it('runs the view on the main thread without creating a worker', async () => {
      await bootstrapApplication(MockView);
      expect(workerInstances).toHaveLength(0);
      expect(viewModule.initialRender).toHaveBeenCalled();
    });

    it('dispatches renderer events to the view on the main thread', async () => {
      await bootstrapApplication(MockView);
      const dispatch = rendererInstance.setupEvents.mock.calls[0][0];
      dispatch(7, 0x01);
      expect(viewModule.handleDispatchEvent).toHaveBeenCalledWith(7, 0x01);
    });
  });
});
