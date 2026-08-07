/**
 * @pathland/platform-browser
 *
 * Tests for the WorkerManager (main-thread worker lifecycle and routing).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { encodeMessage } from '@pathland/protocol';
import { deserializeMessage } from '@pathland/transport';
import { WorkerManager } from './worker-manager';
import type { Renderer } from '@pathland/renderer';

class MockRenderer implements Renderer {
  executeCommandsMock = vi.fn();
  setupEventsMock = vi.fn();
  setupGesturesMock = vi.fn();

  executeCommands(commands: any[]): void {
    this.executeCommandsMock(commands);
  }

  setupEvents(dispatchEvent: (nodeId: number, eventType: number, data?: any) => void): void {
    this.setupEventsMock(dispatchEvent);
  }

  setupGestures(dispatchGesture: (nodeId: number, gestureType: number, gestureState: number, data?: any) => void): void {
    this.setupGesturesMock(dispatchGesture);
  }
}

class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  messages: any[] = [];
  url: string;

  constructor(url: string) {
    this.url = url;
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

describe('WorkerManager', () => {
  let renderer: MockRenderer;
  let manager: WorkerManager;
  let worker: MockWorker;

  beforeEach(() => {
    renderer = new MockRenderer();
    manager = new WorkerManager(renderer);
    worker = new MockWorker('worker.js');
  });

  afterEach(() => {
    manager.terminate();
    vi.restoreAllMocks();
  });

  describe('lifecycle', () => {
    it('starts with init state', () => {
      expect(manager.getState()).toBe('init');
      expect(manager.isReady()).toBe(false);
    });

    it('resolves when the worker reports READY', async () => {
      const promise = manager.start(worker as any);
      worker.emit({ type: 'READY' });
      await expect(promise).resolves.toBeUndefined();
      expect(manager.isReady()).toBe(true);
    });

    it('rejects when the worker reports ERROR', async () => {
      const promise = manager.start(worker as any);
      worker.emit({ type: 'ERROR', error: 'boom' });
      await expect(promise).rejects.toThrow('boom');
      expect(manager.hasError()).toBe(true);
    });

    it('rejects when the worker fires onerror', async () => {
      const promise = manager.start(worker as any);
      worker.fail('worker exploded');
      await expect(promise).rejects.toThrow('worker exploded');
    });

    it('rejects if started twice', async () => {
      manager.start(worker as any);
      await expect(manager.start(worker as any)).rejects.toThrow(/already started/);
    });

    it('terminates the worker and updates state', () => {
      manager.start(worker as any);
      worker.emit({ type: 'READY' });
      manager.terminate();
      expect(manager.getState()).toBe('terminated');
      expect((manager as any).worker).toBeNull();
    });
  });

  describe('message routing', () => {
    it('decodes binary command batches and executes them with the renderer', async () => {
      const commands = [
        { opcode: 'CREATE_NODE' as const, nodeId: 1, componentType: 0x0002, properties: new Map() },
        { opcode: 'INSERT_CHILD' as const, parentId: 1, childId: 2, index: 0 },
      ];
      const buffer = encodeMessage(commands);

      const promise = manager.start(worker as any);
      worker.emit({ type: 'BINARY', buffer });
      worker.emit({ type: 'READY' });
      await expect(promise).resolves.toBeUndefined();

      expect(renderer.executeCommandsMock).toHaveBeenCalledWith(commands);
    });

    it('warns on unknown message types', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const promise = manager.start(worker as any);
      worker.emit({ type: 'MYSTERY' });
      worker.emit({ type: 'READY' });
      await expect(promise).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith('[Pathland] Unknown worker message type: MYSTERY');
    });
  });

  describe('sendEventToWorker', () => {
    it('forwards events to the worker as binary DISPATCH_EVENT when ready', async () => {
      const promise = manager.start(worker as any);
      worker.emit({ type: 'READY' });
      await promise;

      manager.sendEventToWorker(1, 0x04, { x: 5, y: 6 });
      expect(worker.messages).toHaveLength(1);
      expect(worker.messages[0].type).toBe('BINARY');

      const decoded = deserializeMessage(worker.messages[0].buffer);
      expect(decoded.commands[0]).toMatchObject({
        opcode: 'DISPATCH_EVENT',
        targetId: 1,
        eventType: 0x04,
        data: { x: 5, y: 6 },
      });
    });

    it('forwards gestures to the worker as binary GESTURE_UPDATE when ready', async () => {
      const promise = manager.start(worker as any);
      worker.emit({ type: 'READY' });
      await promise;

      manager.sendGestureToWorker(1, 0x12, 0x01, { translationX: 30, translationY: 40 });
      expect(worker.messages).toHaveLength(1);
      expect(worker.messages[0].type).toBe('BINARY');

      const decoded = deserializeMessage(worker.messages[0].buffer);
      expect(decoded.commands[0]).toMatchObject({
        opcode: 'GESTURE_UPDATE',
        targetId: 1,
        gestureType: 0x12,
        gestureState: 0x01,
        data: { translationX: 30, translationY: 40 },
      });
    });

    it('does not send events while starting (queues nothing, warns)', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const promise = manager.start(worker as any);

      manager.sendEventToWorker(1, 0x04);
      expect(worker.messages).toHaveLength(0);
      expect(warnSpy).toHaveBeenCalledWith('[Pathland] Cannot send to worker before it is ready');

      worker.emit({ type: 'READY' });
      await promise;
    });

    it('does not send events when the worker is in error state', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (manager as any).state = 'error';

      manager.sendEventToWorker(1, 0x04);
      expect(worker.messages).toHaveLength(0);
      expect(errorSpy).toHaveBeenCalledWith('[Pathland] Cannot send to worker - worker is in error state');
    });
  });
});
