/**
 * @pathland/platform-browser
 * 
 * Tests for worker bundle URL generation utilities.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateWorkerBundleUrl, resolveViewModulePath } from './generate-worker-bundle';

describe('generateWorkerBundleUrl', () => {
  let originalDocument: typeof document;
  let originalWindow: typeof window;

  beforeEach(() => {
    // Save original globals
    originalDocument = globalThis.document;
    originalWindow = globalThis.window;
  });

  afterEach(() => {
    // Restore original globals
    (globalThis as any).document = originalDocument;
    (globalThis as any).window = originalWindow;
    // Clean up any mocks
    vi.clearAllMocks();
  });

  it('should return default worker path when in browser production environment', () => {
    // Mock browser production environment
    (globalThis as any).document = {};
    (globalThis as any).window = { location: { origin: 'http://localhost:3000' } };
    (globalThis as any).__DEV__ = false;

    const result = generateWorkerBundleUrl();
    expect(result).toBe('/pathland-worker.js');
  });

  it('should return worker path with app name when provided in production', () => {
    // Mock browser production environment
    (globalThis as any).document = {};
    (globalThis as any).window = { location: { origin: 'http://localhost:3000' } };
    (globalThis as any).__DEV__ = false;

    const result = generateWorkerBundleUrl('my-app');
    expect(result).toBe('/pathland-worker-my-app.js');
  });

  it('should return fallback worker path when not in browser environment', () => {
    // Mock non-browser environment
    (globalThis as any).document = undefined;
    (globalThis as any).window = undefined;
    (globalThis as any).__DEV__ = false;

    const result = generateWorkerBundleUrl();
    expect(result).toBe('/pathland-worker.js');
  });
});

describe('resolveViewModulePath', () => {
  let originalDev: boolean | undefined;

  beforeEach(() => {
    originalDev = (globalThis as any).__DEV__;
  });

  afterEach(() => {
    (globalThis as any).__DEV__ = originalDev;
    vi.clearAllMocks();
  });

  it('should return virtual path in development environment', () => {
    (globalThis as any).__DEV__ = true;

    const mockViewClass = { name: 'TestApp' };
    const result = resolveViewModulePath(mockViewClass);
    expect(result).toBe('virtual:pathland-views');
  });

  it('should return bundle path in production environment', () => {
    (globalThis as any).__DEV__ = false;

    const mockViewClass = { name: 'TestApp' };
    const result = resolveViewModulePath(mockViewClass);
    expect(result).toBe('/views-bundle.js');
  });

  it('should return bundle path when __DEV__ is undefined', () => {
    (globalThis as any).__DEV__ = undefined;

    const mockViewClass = { name: 'TestApp' };
    const result = resolveViewModulePath(mockViewClass);
    expect(result).toBe('/views-bundle.js');
  });

  it('should work with any view class that has a name property', () => {
    (globalThis as any).__DEV__ = true;

    const mockViewClass = { name: 'MyCustomView' };
    const result = resolveViewModulePath(mockViewClass);
    expect(result).toBe('virtual:pathland-views');
  });
});