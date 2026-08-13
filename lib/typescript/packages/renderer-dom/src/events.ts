/**
 * @pathland/renderer-dom
 *
 * Event-target resolution for DOM-based renderers.
 *
 * Renderers delegate events (and pointer hit-testing) at the container level
 * and map a DOM target back to a Pathland node id via the
 * `data-pathland-node-id` attribute on host elements. With shadow-DOM
 * components, an event's target may live *inside* a shadow root, so the walk
 * must cross shadow boundaries by climbing out through `host` (equivalent to
 * a composed path). The implementation uses plain properties only (never
 * `instanceof`) so it works across jsdom/window realms.
 */

/**
 * Resolve the nearest Pathland node id for a DOM event target, climbing
 * ancestors and crossing shadow-root boundaries.
 */
export function resolveNodeId(target: EventTarget | null): number | null {
  let node: any = target;
  while (node && typeof node === 'object') {
    if (node.nodeType === 1 && typeof node.getAttribute === 'function') {
      const id = node.getAttribute('data-pathland-node-id');
      if (id !== null && id !== undefined && id !== '') {
        return parseInt(id, 10);
      }
    }
    if (node.parentNode) {
      node = node.parentNode;
    } else if (typeof node.getRootNode === 'function') {
      const root = node.getRootNode();
      // ShadowRoot is a DocumentFragment (nodeType 11) with a host element.
      if (root && root.nodeType === 11 && root.host) {
        node = root.host;
      } else {
        node = null;
      }
    } else {
      node = null;
    }
  }
  return null;
}
