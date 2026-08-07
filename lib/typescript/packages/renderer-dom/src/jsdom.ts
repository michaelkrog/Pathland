/**
 * @pathland/renderer-dom/jsdom
 *
 * JSDOM-based renderer factory (Node.js / server-side rendering / tests).
 *
 * Kept in a separate entry point so that browser bundles never pull in jsdom:
 * the main `@pathland/renderer-dom` entry has no reference to jsdom at all.
 */

import { DOMRenderer } from './index';
import type { DOMRendererConfig } from './index';

/**
 * Create a DOMRenderer backed by JSDOM.
 *
 * @param html - Optional HTML to initialize the document with.
 * @param config - Optional renderer configuration.
 * @returns A promise resolving to a renderer attached to the JSDOM document.
 */
export async function createJSDOMRenderer(
  html?: string,
  config: DOMRendererConfig = {}
): Promise<DOMRenderer> {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM(html || '<!DOCTYPE html><html><body></body></html>');
  return new DOMRenderer({
    ...config,
    document: dom.window.document,
    container: dom.window.document.body as any,
  });
}
