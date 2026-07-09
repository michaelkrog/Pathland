/**
 * @pathland/platform-browser
 * 
 * Tests for package exports.
 */

import { describe, it, expect } from 'vitest';
import * as platformBrowser from './index';
import { bootstrapApplication } from './bootstrap';
import { WorkerManager, generateWorkerBundleUrl, resolveViewModulePath } from './worker';

describe('package exports', () => {
  describe('main exports', () => {
    it('should export bootstrapApplication', () => {
      expect(platformBrowser.bootstrapApplication).toBeDefined();
      expect(platformBrowser.bootstrapApplication).toBe(bootstrapApplication);
    });

    it('should export default as bootstrapApplication', () => {
      expect(platformBrowser.default).toBeDefined();
      expect(platformBrowser.default).toBe(bootstrapApplication);
    });

    it('should export BootstrapOptions type', () => {
      expect(platformBrowser.BootstrapOptions).toBeDefined();
    });
  });

  describe('worker exports', () => {
    it('should export WorkerManager', () => {
      expect(platformBrowser.WorkerManager).toBeDefined();
      expect(platformBrowser.WorkerManager).toBe(WorkerManager);
    });

    it('should export generateWorkerBundleUrl', () => {
      expect(platformBrowser.generateWorkerBundleUrl).toBeDefined();
      expect(platformBrowser.generateWorkerBundleUrl).toBe(generateWorkerBundleUrl);
    });

    it('should export resolveViewModulePath', () => {
      expect(platformBrowser.resolveViewModulePath).toBeDefined();
      expect(platformBrowser.resolveViewModulePath).toBe(resolveViewModulePath);
    });

    it('should export WorkerConfig type', () => {
      expect(platformBrowser.WorkerConfig).toBeDefined();
    });

    it('should export WorkerMessage type', () => {
      expect(platformBrowser.WorkerMessage).toBeDefined();
    });

    it('should export WorkerState type', () => {
      expect(platformBrowser.WorkerState).toBeDefined();
    });
  });

  describe('type re-exports', () => {
    it('should re-export Renderer type', () => {
      expect(platformBrowser.Renderer).toBeDefined();
    });

    it('should re-export Transport type', () => {
      expect(platformBrowser.Transport).toBeDefined();
    });

    it('should re-export Command type', () => {
      expect(platformBrowser.Command).toBeDefined();
    });
  });

  describe('functional tests', () => {
    it('should have all expected exports', () => {
      const expectedExports = [
        'bootstrapApplication',
        'default',
        'BootstrapOptions',
        'WorkerManager',
        'generateWorkerBundleUrl',
        'resolveViewModulePath',
        'WorkerConfig',
        'WorkerMessage',
        'WorkerState',
        'Renderer',
        'Transport',
        'Command'
      ];

      expectedExports.forEach(exportName => {
        expect(platformBrowser).toHaveProperty(exportName);
      });
    });

    it('should have correct number of exports', () => {
      const exportCount = Object.keys(platformBrowser).length;
      expect(exportCount).toBeGreaterThan(5); // Should have several exports
    });
  });
});
