/**
 * @pathland/platform-browser
 *
 * Tests for package exports.
 */

import { describe, it, expect } from 'vitest';
import * as platformBrowser from './index';
import { bootstrapApplication } from './bootstrap';
import { WorkerManager, startWorker } from './worker';

describe('package exports', () => {
  it('should export bootstrapApplication', () => {
    expect(platformBrowser.bootstrapApplication).toBeDefined();
    expect(platformBrowser.bootstrapApplication).toBe(bootstrapApplication);
  });

  it('should export default as bootstrapApplication', () => {
    expect(platformBrowser.default).toBeDefined();
    expect(platformBrowser.default).toBe(bootstrapApplication);
  });

  it('should export WorkerManager', () => {
    expect(platformBrowser.WorkerManager).toBeDefined();
    expect(platformBrowser.WorkerManager).toBe(WorkerManager);
  });

  it('should export startWorker', () => {
    expect(platformBrowser.startWorker).toBeDefined();
    expect(platformBrowser.startWorker).toBe(startWorker);
  });
});
