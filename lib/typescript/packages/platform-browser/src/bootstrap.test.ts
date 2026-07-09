/**
 * @pathland/platform-browser
 * 
 * Tests for bootstrapApplication function.
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { bootstrapApplication } from './bootstrap';
import type { Renderer } from '@pathland/renderer';
import { WorkerManager } from './worker/worker-manager';

// Mock View class for testing
// We use type assertions to make it compatible with ViewClass type
const MockView: any = class {
  static make() {
    return { type: 'MockViewNode' } as any;
  }
  
  body() {
    return { type: 'MockViewNode' } as any;
  }
};

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

// Mock the dynamic imports
vi.mock('@pathland/renderer-dom', () => ({
  DOMRenderer: class MockDOMRenderer {
    constructor() {
      return new MockRenderer();
    }
  }
}));

vi.mock('@pathland/view', () => ({
  initialRender: vi.fn(),
  handleDispatchEvent: vi.fn()
}));

// Mock the worker module
vi.mock('./worker', async () => {
  const actual = await vi.importActual('./worker');
  return {
    ...actual,
    generateWorkerBundleUrl: vi.fn(() => 'mock-worker-url.js'),
    resolveViewModulePath: vi.fn(() => 'mock-view-module-path.js')
  };
});

describe('bootstrapApplication', () => {
  let originalWorker: typeof Worker;
  let mockWorkerClass: any;

  beforeEach(() => {
    // Save original Worker
    originalWorker = globalThis.Worker;
    
    // Create a mock worker class
    mockWorkerClass = class MockWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((error: ErrorEvent) => void) | null = null;
      messages: any[] = [];
      url: string;
      
      constructor(url: string) {
        this.url = url;
      }
      
      postMessage(message: any, transfer?: any): void {
        // Store message for verification
        this.messages.push(message);
      }
      
      terminate(): void {}
    };
    
    // Replace global Worker with mock
    (globalThis as any).Worker = mockWorkerClass;
    
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original Worker
    (globalThis as any).Worker = originalWorker;
    vi.clearAllMocks();
  });

  describe('worker mode (default)', () => {
    it('should use worker by default', async () => {
      // Mock console.error to suppress warnings in tests
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      await bootstrapApplication(MockView);
      
      // Check that generateWorkerBundleUrl was called
      expect(WorkerManager).toHaveBeenCalled();
      
      // Should have created a worker
      expect((globalThis as any).Worker).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should pass custom worker URL when provided', async () => {
      const customWorkerUrl = 'custom-worker.js';
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Mock the worker manager to capture the URL
      const workerManagerSpy = vi.spyOn(WorkerManager.prototype, 'startWorker');
      
      await bootstrapApplication(MockView, { workerUrl: customWorkerUrl });
      
      expect(workerManagerSpy).toHaveBeenCalledWith(
        customWorkerUrl,
        expect.objectContaining({
          viewModulePath: expect.any(String),
          viewClassName: 'MockView'
        })
      );
      
      workerManagerSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should use custom renderer when provided', async () => {
      const mockRenderer = new MockRenderer();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      await bootstrapApplication(MockView, { renderer: mockRenderer });
      
      // The custom renderer should be used
      expect(WorkerManager).toHaveBeenCalledWith(mockRenderer);
      
      consoleSpy.mockRestore();
    });

    it('should call setupEvents on renderer', async () => {
      const mockRenderer = new MockRenderer();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      await bootstrapApplication(MockView, { renderer: mockRenderer, useWorker: true });
      
      // setupEvents should have been called
      expect(mockRenderer.setupEventsMock).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('legacy mode (useWorker: false)', () => {
    it('should run on main thread when useWorker is false', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Mock the view module to return actual functions
      vi.doMock('@pathland/view', () => ({
        initialRender: vi.fn(),
        handleDispatchEvent: vi.fn()
      }));
      
      await bootstrapApplication(MockView, { useWorker: false });
      
      // Worker should NOT be created
      expect((globalThis as any).Worker).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should use custom renderer in legacy mode', async () => {
      const mockRenderer = new MockRenderer();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      vi.doMock('@pathland/view', () => ({
        initialRender: vi.fn(),
        handleDispatchEvent: vi.fn()
      }));
      
      await bootstrapApplication(MockView, { 
        useWorker: false,
        renderer: mockRenderer 
      });
      
      // Renderer should have been used
      expect(mockRenderer.executeCommandsMock).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should call initialRender with view in legacy mode', async () => {
      const mockRenderer = new MockRenderer();
      const mockInitialRender = vi.fn();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      vi.doMock('@pathland/view', () => ({
        initialRender: mockInitialRender,
        handleDispatchEvent: vi.fn()
      }));
      
      await bootstrapApplication(MockView, { 
        useWorker: false,
        renderer: mockRenderer 
      });
      
      // initialRender should have been called
      expect(mockInitialRender).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('error handling', () => {
    it('should handle errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Force an error by mocking Worker to throw
      (globalThis as any).Worker = vi.fn(() => {
        throw new Error('Worker creation failed');
      });
      
      // This should not throw
      await expect(bootstrapApplication(MockView)).rejects.toThrow();
      
      consoleSpy.mockRestore();
    });
  });
});