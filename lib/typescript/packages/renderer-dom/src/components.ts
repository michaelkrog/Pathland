/**
 * @pathland/renderer-dom
 *
 * Pathland host components: hand-rolled custom elements with shadow DOM.
 *
 * The renderer owns all styling; components are passive, stateless shells
 * that only provide an isolated shadow tree (hard CSS encapsulation) and the
 * internal DOM a leaf needs (text span, native button, inputs). The renderer
 * drives every value through inline CSS custom properties on the host
 * (`--pl-*`) or direct inline styles on shadow internals, so style
 * application stays per-element (no class-based selector matching) while
 * rules are shared and cached in a single stylesheet.
 */

import { ComponentType } from '@pathland/protocol';

/**
 * Shared `:host` rule set, injected as a <style> into every shadow root.
 *
 * Values are per-element inline CSS custom properties set by the renderer.
 * Inheritable properties (color, font-*) flow from the host across the shadow
 * boundary into internal elements, so leaves never need per-element rules.
 */
export const COMPONENT_STYLE_TEXT = `
:host {
  box-sizing: border-box;
  padding: var(--pl-padding, 0);
  padding-top: var(--pl-padding-top, var(--pl-padding, 0));
  padding-right: var(--pl-padding-right, var(--pl-padding, 0));
  padding-bottom: var(--pl-padding-bottom, var(--pl-padding, 0));
  padding-left: var(--pl-padding-left, var(--pl-padding, 0));
  width: var(--pl-width, auto);
  height: var(--pl-height, auto);
  background-color: var(--pl-bg, transparent);
  border: var(--pl-border-width, 0) solid var(--pl-border-color, transparent);
  border-radius: var(--pl-border-radius, 0);
  opacity: var(--pl-opacity, 1);
  color: var(--pl-color, inherit);
  font-size: var(--pl-font-size, inherit);
  font-weight: var(--pl-font-weight, inherit);
  font-family: var(--pl-font-family, inherit);
}
:host(pl-hstack) {
  display: var(--pl-display, flex);
  flex-direction: row;
  gap: var(--pl-spacing, 0);
  align-items: var(--pl-align, stretch);
  justify-content: var(--pl-justify, flex-start);
}
:host(pl-vstack) {
  display: var(--pl-display, flex);
  flex-direction: column;
  gap: var(--pl-spacing, 0);
  align-items: var(--pl-align, stretch);
  justify-content: var(--pl-justify, flex-start);
}
:host(pl-scrollview), :host(pl-list), :host(pl-grid) {
  display: var(--pl-display, flex);
  flex-direction: column;
  overflow: auto;
}
:host(pl-text) { display: var(--pl-display, inline-block); }
:host(pl-text) .pl-text-inner { display: block; width: 100%; }
:host(pl-root) { display: var(--pl-display, block); }
:host(pl-spacer) { display: var(--pl-display, block); flex: var(--pl-flex, 1 1 0); }
:host(pl-button) { display: var(--pl-display, inline-block); }
:host(pl-button) .pl-button-inner {
  border: none;
  background: transparent;
  padding: 0;
  font: inherit;
  color: inherit;
  cursor: pointer;
  width: 100%;
  height: 100%;
}
:host(pl-image) { display: var(--pl-display, block); }
:host(pl-switch) { display: var(--pl-display, inline-block); }
:host(pl-text-field) { display: var(--pl-display, inline-block); }
:host(pl-text-field) .pl-text-field-input {
  border: none;
  outline: none;
  font: inherit;
  color: inherit;
  background: transparent;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
}
`;

/**
 * A Pathland host element. Containers expose no inner element; leaves expose
 * their shadow-internal target (span/button/img/input) for the renderer.
 */
export interface PathlandHostElement extends HTMLElement {
  /** Shadow-internal target for leaf components (null for containers). */
  readonly inner: HTMLElement | null;
}

/** Maps a Pathland component type to its custom element tag name. */
export const COMPONENT_TO_TAG: Record<number, string> = {
  [0]: 'pl-root',
  [ComponentType.HSTACK]: 'pl-hstack',
  [ComponentType.VSTACK]: 'pl-vstack',
  [ComponentType.TEXT]: 'pl-text',
  [ComponentType.BUTTON]: 'pl-button',
  [ComponentType.IMAGE]: 'pl-image',
  [ComponentType.SPACER]: 'pl-spacer',
  [ComponentType.SCROLLVIEW]: 'pl-scrollview',
  [ComponentType.LIST]: 'pl-list',
  [ComponentType.GRID]: 'pl-grid',
  [ComponentType.SWITCH]: 'pl-switch',
  [ComponentType.TEXT_FIELD]: 'pl-text-field',
};

type Constructor<T = {}> = new (...args: any[]) => T;

interface ComponentClasses {
  [tag: string]: Constructor<PathlandHostElement>;
}

const classCache = new WeakMap<Document, ComponentClasses>();

function createStyleElement(doc: Document): HTMLStyleElement {
  const style = doc.createElement('style');
  style.textContent = COMPONENT_STYLE_TEXT;
  return style;
}

/**
 * Build (once per document/window) the custom element classes for a document.
 * Classes extend the document's own window.HTMLElement so they construct
 * correctly in that window's realm.
 */
function buildComponentClasses(doc: Document): ComponentClasses {
  const win = doc.defaultView;
  const Base = win ? win.HTMLElement : HTMLElement;

  const container = (tag: string): Constructor<PathlandHostElement> =>
    class extends Base {
      readonly inner: HTMLElement | null = null;
      constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        shadow.appendChild(createStyleElement(this.ownerDocument));
        shadow.appendChild(this.ownerDocument.createElement('slot'));
      }
    };

  const leaf = (tag: string, kind: 'span' | 'button' | 'img' | 'input', className: string, inputType?: string): Constructor<PathlandHostElement> =>
    class extends Base {
      readonly inner: HTMLElement;
      constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        shadow.appendChild(createStyleElement(this.ownerDocument));
        const el = this.ownerDocument.createElement(kind);
        el.className = className;
        if (kind === 'input' && inputType) {
          (el as HTMLInputElement).type = inputType;
        }
        this.inner = el;
        shadow.appendChild(el);
      }
    };

  const spacer = (): Constructor<PathlandHostElement> =>
    class extends Base {
      readonly inner: HTMLElement | null = null;
      constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        shadow.appendChild(createStyleElement(this.ownerDocument));
      }
    };

  return {
    'pl-root': container('pl-root'),
    'pl-hstack': container('pl-hstack'),
    'pl-vstack': container('pl-vstack'),
    'pl-scrollview': container('pl-scrollview'),
    'pl-list': container('pl-list'),
    'pl-grid': container('pl-grid'),
    'pl-text': leaf('pl-text', 'span', 'pl-text-inner'),
    'pl-button': leaf('pl-button', 'button', 'pl-button-inner'),
    'pl-image': leaf('pl-image', 'img', 'pl-image'),
    'pl-switch': leaf('pl-switch', 'input', 'pl-switch', 'checkbox'),
    'pl-text-field': leaf('pl-text-field', 'input', 'pl-text-field-input', 'text'),
    'pl-spacer': spacer(),
  };
}

/**
 * Register the Pathland custom elements on a document's window, once per
 * document. Each JSDOM instance / browser window has its own registry.
 */
export function definePathlandElements(doc: Document): void {
  const win = doc.defaultView;
  if (!win || !win.customElements) return;
  const registry = win.customElements;
  const classes = classCache.get(doc) || buildComponentClasses(doc);
  classCache.set(doc, classes);
  for (const tag of Object.keys(classes)) {
    if (!registry.get(tag)) {
      registry.define(tag, classes[tag]);
    }
  }
}

/**
 * Create a Pathland host element for a component type, ensuring the custom
 * elements are registered first.
 */
export function createComponentElement(doc: Document, componentType: number): HTMLElement {
  definePathlandElements(doc);
  const tag = COMPONENT_TO_TAG[componentType];
  return doc.createElement(tag || 'div') as HTMLElement;
}
