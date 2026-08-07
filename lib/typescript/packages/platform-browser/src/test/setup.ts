/**
 * @pathland/platform-browser
 * 
 * Test setup file for platform-browser package.
 * Configures global variables and mocks for testing.
 */

// Mock global variables for testing
import { beforeAll, afterAll, vi } from 'vitest';

// Mock the global self for worker tests
if (typeof global !== 'undefined') {
  (global as any).self = global;
}

// Mock the Worker class for node environments
if (typeof Worker === 'undefined') {
  (global as any).Worker = class MockWorker {
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((error: ErrorEvent) => void) | null = null;
    
    constructor(url: string) {
      // In tests, we'll mock this
    }
    
    postMessage(message: any, transfer?: any): void {
      // In tests, we'll mock this
    }
    
    terminate(): void {
      // In tests, we'll mock this
    }
  };
}

// Mock import.meta for tests
if (typeof global !== 'undefined') {
  (global as any).importMeta = {
    url: 'file:///test.js',
    env: {
      DEV: true,
      PROD: false,
      MODE: 'development'
    }
  };
}

// Global test timeout
vi.setConfig({ testTimeout: 10000 });

// Clean up after tests
beforeAll(() => {
  // Any setup before all tests
});

afterAll(() => {
  // Any cleanup after all tests
  vi.clearAllMocks();
});
