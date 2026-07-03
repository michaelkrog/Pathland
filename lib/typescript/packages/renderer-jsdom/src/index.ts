/**
 * @pathland/renderer-jsdom
 * 
 * JSDOM-based renderer for Pathland protocol.
 * Provides DOM manipulation in Node.js using jsdom.
 * 
 * Use this when you need:
 * - DOM APIs in Node.js
 * - To test DOM-based rendering without a browser
 * - To generate DOM snapshots in tests
 * 
 * For simple HTML string generation, use @pathland/renderer-html instead.
 * For browser rendering, use @pathland/renderer-dom instead.
 */

import { JSDOM } from 'jsdom';
import type { Command, PropertyValue, DecodedMessage } from '@pathland/protocol';
import { decodeMessage, ComponentType, StyleProperty, TextProperty, StackProperty, FILL, HUG_CONTENT } from '@pathland/protocol';

// ============================================
// RENDER ELEMENT
// ============================================

/**
 * Maps Pathland component types to DOM element tag names.
 */
const COMPONENT_TO_TAG: Record<number, string> = {
  [ComponentType.HSTACK]: 'div',
  [ComponentType.VSTACK]: 'div',
  [ComponentType.TEXT]: 'span',
  [ComponentType.BUTTON]: 'button',
  [ComponentType.IMAGE]: 'img',
  [ComponentType.SPACER]: 'div',
  [ComponentType.SCROLLVIEW]: 'div',
  [ComponentType.LIST]: 'div',
  [ComponentType.GRID]: 'div',
  [ComponentType.SWITCH]: 'input',
  [ComponentType.TEXT_FIELD]: 'input',
};

/**
 * A render element wraps a JSDOM element and handles property application.
 */
class JSDOMRenderElement {
  readonly id: number;
  readonly componentType: number;
  readonly element: Element;
  children: JSDOMRenderElement[] = [];
  parent: JSDOMRenderElement | null = null;

  constructor(nodeId: number, componentType: number, document: Document, container?: Element) {
    this.id = nodeId;
    this.componentType = componentType;
    
    const tag = COMPONENT_TO_TAG[componentType] || 'div';
    this.element = document.createElement(tag);
    this.element.setAttribute('data-pathland-id', nodeId.toString());
    this.element.setAttribute('data-pathland-component', componentType.toString());

    // Special setup for certain components
    if (componentType === ComponentType.SWITCH) {
      (this.element as HTMLInputElement).type = 'checkbox';
    }
    if (componentType === ComponentType.TEXT_FIELD) {
      (this.element as HTMLInputElement).type = 'text';
    }

    if (container) {
      container.appendChild(this.element);
    }
  }

  setProperty(propertyId: number, value: PropertyValue): void {
    this.applyProperty(propertyId, value);
  }

  private applyProperty(propertyId: number, value: PropertyValue): void {
    switch (propertyId) {
      // Text
      case TextProperty.TEXT:
        if (value.type === 'string') {
          this.element.textContent = value.value;
        }
        break;

      // Style properties
      case StyleProperty.BACKGROUND_COLOR:
        if (value.type === 'u32' || (value.type === 'color' && value.kind === 'literal')) {
          const rgba = value.type === 'u32' ? value.value : value.rgba;
          (this.element as HTMLElement).style.backgroundColor = rgbaToCss(rgba);
        }
        break;

      case StyleProperty.COLOR:
        if (value.type === 'u32' || (value.type === 'color' && value.kind === 'literal')) {
          const rgba = value.type === 'u32' ? value.value : value.rgba;
          (this.element as HTMLElement).style.color = rgbaToCss(rgba);
        }
        break;

      case StyleProperty.FONT_SIZE:
        if (value.type === 'f32') {
          (this.element as HTMLElement).style.fontSize = `${value.value}px`;
        }
        break;

      case StyleProperty.FONT_WEIGHT:
        if (value.type === 'u8' || value.type === 'u32') {
          (this.element as HTMLElement).style.fontWeight = String(value.value);
        }
        break;

      case StyleProperty.WIDTH:
        if (value.type === 'f32') {
          if (value.value === FILL) {
            (this.element as HTMLElement).style.width = '100%';
          } else if (value.value === HUG_CONTENT) {
            (this.element as HTMLElement).style.width = 'fit-content';
          } else {
            (this.element as HTMLElement).style.width = `${value.value}px`;
          }
        }
        break;

      case StyleProperty.HEIGHT:
        if (value.type === 'f32') {
          if (value.value === FILL) {
            (this.element as HTMLElement).style.height = '100%';
          } else if (value.value === HUG_CONTENT) {
            (this.element as HTMLElement).style.height = 'fit-content';
          } else {
            (this.element as HTMLElement).style.height = `${value.value}px`;
          }
        }
        break;

      case StyleProperty.OPACITY:
        if (value.type === 'f32') {
          (this.element as HTMLElement).style.opacity = String(value.value);
        }
        break;

      case StyleProperty.VISIBLE:
        if (value.type === 'u8') {
          (this.element as HTMLElement).style.display = value.value ? '' : 'none';
        }
        break;

      case StyleProperty.PADDING:
        if (value.type === 'f32') {
          (this.element as HTMLElement).style.padding = `${value.value}px`;
        }
        break;

      case StyleProperty.BORDER_WIDTH:
        if (value.type === 'f32') {
          (this.element as HTMLElement).style.borderWidth = `${value.value}px`;
        }
        break;

      case StyleProperty.BORDER_COLOR:
        if (value.type === 'u32' || (value.type === 'color' && value.kind === 'literal')) {
          const rgba = value.type === 'u32' ? value.value : value.rgba;
          (this.element as HTMLElement).style.borderColor = rgbaToCss(rgba);
        }
        break;

      case StyleProperty.BORDER_RADIUS:
        if (value.type === 'f32') {
          (this.element as HTMLElement).style.borderRadius = `${value.value}px`;
        }
        break;

      // Stack properties
      case StackProperty.SPACING:
        if (value.type === 'f32') {
          (this.element as HTMLElement).style.gap = `${value.value}px`;
        }
        break;

      case StackProperty.ALIGNMENT:
        if (value.type === 'enum') {
          (this.element as HTMLElement).style.alignItems = enumToAlignItems(value.value);
        }
        break;

      case StackProperty.JUSTIFICATION:
        if (value.type === 'enum') {
          (this.element as HTMLElement).style.justifyContent = enumToJustifyContent(value.value);
        }
        break;

      // Special handling for HSTACK/VSTACK
      case StackProperty.PADDING:
        if (value.type === 'f32') {
          (this.element as HTMLElement).style.padding = `${value.value}px`;
        }
        break;
    }
  }

  insertChild(child: JSDOMRenderElement, index: number): void {
    if (index >= this.children.length) {
      this.element.appendChild(child.element);
      this.children.push(child);
    } else {
      const nextSibling = this.children[index].element;
      this.element.insertBefore(child.element, nextSibling);
      this.children.splice(index, 0, child);
    }
    child.parent = this;
  }

  removeChild(child: JSDOMRenderElement): void {
    this.element.removeChild(child.element);
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
    }
    child.parent = null;
  }

  remove(): void {
    if (this.parent) {
      this.parent.removeChild(this);
    } else if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.children = [];
  }
}

// ============================================
// JSDOM RENDERER
// ============================================

/**
 * JSDOM-based renderer for Pathland protocol.
 * Uses jsdom to provide DOM manipulation in Node.js.
 * 
 * Maintains only nodeId -> element mapping for event routing.
 */
export class JSDOMRenderer {
  private dom: JSDOM;
  private root: JSDOMRenderElement;
  private elements: Map<number, JSDOMRenderElement> = new Map();

  /**
   * Create a new JSDOMRenderer.
   * @param html Optional initial HTML for the JSDOM
   */
  constructor(html?: string) {
    this.dom = new JSDOM(html || '<!DOCTYPE html><html><body></body></html>');
    
    // Create root container
    const body = this.dom.window.document.body;
    this.root = new JSDOMRenderElement(0, 0, this.dom.window.document, body);
    this.elements.set(0, this.root);
  }

  /**
   * Get the JSDOM instance.
   */
  getJSDOM(): JSDOM {
    return this.dom;
  }

  /**
   * Get the JSDOM window.
   */
  getWindow(): Window {
    return this.dom.window as unknown as Window;
  }

  /**
   * Get the JSDOM document.
   */
  getDocument(): Document {
    return this.dom.window.document;
  }

  /**
   * Execute a single command.
   */
  execute(command: Command): void {
    this.executeCommand(command);
  }

  /**
   * Execute multiple commands.
   */
  executeCommands(commands: Command[]): void {
    for (const command of commands) {
      this.executeCommand(command);
    }
  }

  /**
   * Process a binary-encoded message.
   */
  processMessage(buffer: Uint8Array): void {
    const { commands } = decodeMessage(buffer);
    this.executeCommands(commands);
  }

  private executeCommand(command: Command): void {
    switch (command.opcode) {
      case 'CREATE_NODE':
        this.createNode(command);
        break;
      case 'DELETE_NODE':
        this.deleteNode(command);
        break;
      case 'INSERT_CHILD':
        this.insertChild(command);
        break;
      case 'REMOVE_CHILD':
        this.removeChild(command);
        break;
      case 'SET_PROPERTY':
        this.setProperty(command);
        break;
    }
  }

  private createNode(command: Extract<Command, { opcode: 'CREATE_NODE' }>): void {
    if (this.elements.has(command.nodeId)) {
      console.warn(`Element ${command.nodeId} already exists`);
      return;
    }

    const element = new JSDOMRenderElement(command.nodeId, command.componentType, this.dom.window.document);
    this.elements.set(command.nodeId, element);

    for (const [propertyId, value] of command.properties) {
      element.setProperty(propertyId, value);
    }
  }

  private deleteNode(command: Extract<Command, { opcode: 'DELETE_NODE' }>): void {
    const element = this.elements.get(command.nodeId);
    if (element) {
      element.remove();
      this.elements.delete(command.nodeId);
    }
  }

  private insertChild(command: Extract<Command, { opcode: 'INSERT_CHILD' }>): void {
    const parent = this.elements.get(command.parentId);
    const child = this.elements.get(command.childId);

    if (!parent) {
      console.warn(`Cannot insert child: parent ${command.parentId} not found`);
      return;
    }
    if (!child) {
      console.warn(`Cannot insert child: child ${command.childId} not found`);
      return;
    }

    parent.insertChild(child, command.index);
  }

  private removeChild(command: Extract<Command, { opcode: 'REMOVE_CHILD' }>): void {
    const parent = this.elements.get(command.parentId);
    const child = this.elements.get(command.childId);

    if (!parent) {
      console.warn(`Cannot remove child: parent ${command.parentId} not found`);
      return;
    }
    if (!child) {
      console.warn(`Cannot remove child: child ${command.childId} not found`);
      return;
    }

    parent.removeChild(child);
  }

  private setProperty(command: Extract<Command, { opcode: 'SET_PROPERTY' }>): void {
    const element = this.elements.get(command.nodeId);
    if (!element) {
      console.warn(`Cannot set property: element ${command.nodeId} not found`);
      return;
    }
    element.setProperty(command.propertyId, command.value);
  }

  /**
   * Get a render element by node ID.
   */
  getElement(nodeId: number): JSDOMRenderElement | undefined {
    return this.elements.get(nodeId);
  }

  /**
   * Get the DOM element for a node.
   */
  getDOMElement(nodeId: number): Element | undefined {
    return this.elements.get(nodeId)?.element;
  }

  /**
   * Get the root container element.
   */
  getRootElement(): JSDOMRenderElement {
    return this.root;
  }

  /**
   * Get the HTML string of the entire document.
   */
  getHTML(): string {
    return this.dom.serialize();
  }

  /**
   * Get the HTML string of the body content.
   */
  getBodyHTML(): string {
    return this.dom.window.document.body.innerHTML;
  }

  /**
   * Clear all elements except root.
   */
  clear(): void {
    for (const [nodeId, element] of this.elements) {
      if (nodeId !== 0) {
        element.remove();
      }
    }
    this.elements.clear();
    this.root = new JSDOMRenderElement(0, 0, this.dom.window.document, this.dom.window.document.body);
    this.elements.set(0, this.root);
  }

  /**
   * Get the node count.
   */
  getNodeCount(): number {
    return this.elements.size;
  }

  /**
   * Query the DOM using CSS selectors.
   */
  querySelector(selector: string): Element | null {
    return this.dom.window.document.querySelector(selector);
  }

  /**
   * Query all matching elements.
   */
  querySelectorAll(selector: string): Element[] {
    return Array.from(this.dom.window.document.querySelectorAll(selector));
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function rgbaToCss(rgba: number): string {
  const r = (rgba >>> 24) & 0xFF;
  const g = (rgba >>> 16) & 0xFF;
  const b = (rgba >>> 8) & 0xFF;
  const a = rgba & 0xFF;
  return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
}

function enumToAlignItems(value: number): string {
  const mapping: Record<number, string> = {
    0x00: 'flex-start',
    0x01: 'center',
    0x02: 'flex-end',
    0x03: 'stretch',
  };
  return mapping[value] || 'stretch';
}

function enumToJustifyContent(value: number): string {
  const mapping: Record<number, string> = {
    0x00: 'flex-start',
    0x01: 'center',
    0x02: 'flex-end',
    0x03: 'space-between',
    0x04: 'space-around',
    0x05: 'space-evenly',
  };
  return mapping[value] || 'flex-start';
}

// Export types
export type { JSDOMRenderElement };

export { JSDOMRenderer as default };
