/**
 * @pathland/platform-browser
 * 
 * Tests for WorkerManager class.
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { WorkerManager } from './worker-manager';
import type { Renderer } from '@pathland/renderer';

// Mock Renderer implementation for testing
class MockRenderer implements Renderer {
  executeCommandsMock = vi.fn();
  setupEventsMock = vi.fn();

  executeCommands(commands: any[]): void {
    this.executeCommandsMock(commands);
  }

  setupEvents(dispatchEvent: (nodeId: number, eventType: number) => void): void {
    this.setupEventsMock(dispatchEvent);
  }
}

// Mock Worker class for testing
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((error: ErrorEvent) => void) | null = null;
  
  messages: any[] = [];
  
  constructor(url: string) {
    // Store the URL for verification
    (this as any).url = url;
  }
  
  postMessage(message: any, transfer?: any): void {
    this.messages.push(message);
    // Simulate message reception after a small delay
    setTimeout(() => {
      if (this.onmessage) {
        this.onmessage({ data: message } as MessageEvent);
      }
    }, 0);
  }
  
  terminate(): void {
    // Clean up
    this.onmessage = null;
    this.onerror = null;
  }
}

describe('WorkerManager', () => {
  let mockRenderer: MockRenderer;
  let workerManager: WorkerManager;
  let originalWorker: typeof Worker;

  beforeEach(() => {
    // Save original Worker
    originalWorker = globalThis.Worker;
    
    // Replace global Worker with our mock
    (globalThis as any).Worker = MockWorker as any;
    
    // Create mock renderer
    mockRenderer = new MockRenderer();
    
    // Create worker manager
    workerManager = new WorkerManager(mockRenderer);
  });

  afterEach(() => {
    // Restore original Worker
    (globalThis as any).Worker = originalWorker;
    
    // Clean up
    if (workerManager) {
      workerManager.terminate();
    }
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create a WorkerManager instance', () => {
      expect(workerManager).toBeInstanceOf(WorkerManager);
    });

    it('should have initial state of "init"', () => {
      expect(workerManager.getState()).toBe('init');
    });

    it('should store the renderer reference', () => {
      // Access private field via any for testing
      expect((workerManager as any).renderer).toBe(mockRenderer);
    });
  });

  describe('startWorker', () => {
    it('should start a worker with the given URL and config', () => {
      const workerUrl = 'test-worker.js';
      const config = { viewModulePath: 'test-module.js', viewClassName: 'TestApp' };
      
      workerManager.startWorker(workerUrl, config);
      
      // Check that worker was created with correct URL
      expect((workerManager as any).worker).toBeInstanceOf(MockWorker as any);
      expect((workerManager as any).worker.url).toBe(workerUrl);
      
      // Check state changed to starting
      expect(workerManager.getState()).toBe('starting');
      
      // Check that INIT message was sent
      expect((workerManager as any).worker.messages).toHaveLength(1);
      expect((workerManager as any).worker.messages[0].type).toBe('INIT');
      expect((workerManager as any).worker.messages[0].viewModulePath).toBe(config.viewModulePath);
      expect((workerManager as any).worker.messages[0].viewClassName).toBe(config.viewClassName);
    });

    it('should not start worker twice', () => {
      const workerUrl = 'test-worker.js';
      const config = { viewModulePath: 'test-module.js', viewClassName: 'TestApp' };
      
      workerManager.startWorker(workerUrl, config);
      workerManager.startWorker(workerUrl, config);
      
      // Should only have one worker
      expect((workerManager as any).worker).toBeInstanceOf(MockWorker as any);
      expect((workerManager as any).worker.messages).toHaveLength(1);
    });

    it('should handle worker creation errors', () => {
      // Mock Worker to throw error
      const error = new Error('Failed to create worker');
      (globalThis as any).Worker = vi.fn(() => { throw error; });
      
      const workerUrl = 'test-worker.js';
      const config = { viewModulePath: 'test-module.js', viewClassName: 'TestApp' };
      
      expect(() => workerManager.startWorker(workerUrl, config)).toThrow();
      expect(workerManager.getState()).toBe('error');
    });
  });

  describe('sendEventToWorker', () => {
    it('should queue events when worker is starting', () => {
      const workerUrl = 'test-worker.js';
      const config = { viewModulePath: 'test-module.js', viewClassName: 'TestApp' };
      
      workerManager.startWorker(workerUrl, config);
      
      // Send events before worker is ready
      workerManager.sendEventToWorker(1, 0x04); // click event
      workerManager.sendEventToWorker(2, 0x04);
      
      // Check that events are queued
      expect((workerManager as any).pendingEvents).toHaveLength(2);
      expect((workerManager as any).pendingEvents[0]).toEqual({ nodeId: 1, eventType: 0x04 });
      expect((workerManager as any).pendingEvents[1]).toEqual({ nodeId: 2, eventType: 0x04 });
    });

    it('should send events directly when worker is ready', async () => {
      const workerUrl = 'test-worker.js';
      const config = { viewModulePath: 'test-module.js', viewClassName: 'TestApp' };
      
      workerManager.startWorker(workerUrl, config);
      
      // Simulate worker becoming ready
      workerManager['handleWorkerMessage']({ type: 'READY' } as any);
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(workerManager.isReady()).toBe(true);
      
      // Now send events
      workerManager.sendEventToWorker(1, 0x04);
      workerManager.sendEventToWorker(2, 0x05);
      
      // Check that events were sent to worker
      expect((workerManager as any).worker.messages).toHaveLength(3); // INIT + 2 events
      expect((workerManager as any).worker.messages[1].type).toBe('EVENT');
      expect((workerManager as any).worker.messages[1].nodeId).toBe(1);
      expect((workerManager as any).worker.messages[1].eventType).toBe(0x04);
    });

    it('should not send events when worker is in error state', () => {
      // Put worker in error state
      (workerManager as any).state = 'error';
      
      const consoleSpy = vi.spyOn(console, 'error');
      
      workerManager.sendEventToWorker(1, 0x04);
      
      expect((workerManager as any).worker?.messages).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('terminate', () => {
    it('should terminate the worker and update state', () => {
      const workerUrl = 'test-worker.js';
      const config = { viewModulePath: 'test-module.js', viewClassName: 'TestApp' };
      
      workerManager.startWorker(workerUrl, config);
      
      workerManager.terminate();
      
      expect(workerManager.getState()).toBe('terminated');
      expect((workerManager as any).worker).toBeNull();
    });

    it('should handle terminate when no worker exists', () => {
      // Terminate without starting
      expect(() => workerManager.terminate()).not.toThrow();
      expect(workerManager.getState()).toBe('terminated');
    });
  });

  describe('state checks', () => {
    it('should correctly report isReady state', () => {
      expect(workerManager.isReady()).toBe(false);
      
      workerManager.startWorker('test-worker.js', { viewModulePath: 'test.js', viewClassName: 'Test' });
      expect(workerManager.isReady()).toBe(false);
      
      workerManager['handleWorkerMessage']({ type: 'READY' } as any);
      expect(workerManager.isReady()).toBe(true);
    });

    it('should correctly report hasError state', () => {
      expect(workerManager.hasError()).toBe(false);
      
      (workerManager as any).state = 'error';
      expect(workerManager.hasError()).toBe(true);
    });
  });

  describe('message handling', () => {
    it('should handle READY message by flushing pending events and commands', async () => {
      const workerUrl = 'test-worker.js';
      const config = { viewModulePath: 'test-module.js', viewClassName: 'TestApp' };
      
      workerManager.startWorker(workerUrl, config);
      
      // Queue some events and commands
      workerManager.sendEventToWorker(1, 0x04);
      workerManager.sendEventToWorker(2, 0x05);
      
      // Simulate worker becoming ready
      workerManager['handleWorkerMessage']({ type: 'READY' } as any);
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(workerManager.isReady()).toBe(true);
      // Events should have been flushed (sent to worker)
      expect((workerManager as any).pendingEvents).toHaveLength(0);
    });

    it('should handle COMMANDS message by forwarding to renderer', () => {
      const workerUrl = 'test-worker.js';
      const config = { viewModulePath: 'test-module.js', viewClassName: 'TestApp' };
      
      workerManager.startWorker(workerUrl, config);
      
      // Simulate worker being ready
      workerManager['handleWorkerMessage']({ type: 'READY' } as any);
      
      // Simulate commands from worker
      const commands = [{ opcode: 'CREATE_NODE', nodeId: 1, componentType: 1, properties: new Map() }];
      workerManager['handleWorkerMessage']({ type: 'COMMANDS', commands } as any);
      
      // Check that commands were forwarded to renderer
      expect(mockRenderer.executeCommandsMock).toHaveBeenCalledWith(commands);
    });

    it('should handle ERROR message by setting error state', () => {
      const workerUrl = 'test-worker.js';
      const config = { viewModulePath: 'test-module.js', viewClassName: 'TestApp' };
      
      workerManager.startWorker(workerUrl, config);
      
      workerManager['handleWorkerMessage']({ type: 'ERROR', error: 'Test error' } as any);
      
      expect(workerManager.getState()).toBe('error');
    });

    it('should warn on unknown message types', () => {
      const consoleSpy = vi.spyOn(console, 'warn');
      
      workerManager['handleWorkerMessage']({ type: 'UNKNOWN' } as any);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Pathland] Unknown worker message type: UNKNOWN'
      );
      
      consoleSpy.mockRestore();
    });
  });
});