/**
 * @pathland/renderer-dom
 * 
 * DOM-based renderer for Pathland protocol.
 * Executes Pathland commands to create and manage DOM elements.
 */

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
 * A render element wraps a DOM element and handles property application.
 */
class RenderElement {
  readonly id: number;
  readonly componentType: number;
  readonly element: HTMLElement;
  children: RenderElement[] = [];
  parent: RenderElement | null = null;

  constructor(nodeId: number, componentType: number, container?: HTMLElement) {
    this.id = nodeId;
    this.componentType = componentType;
    
    const tag = COMPONENT_TO_TAG[componentType] || 'div';
    this.element = document.createElement(tag);
    this.element.dataset.pathlandNodeId = nodeId.toString();
    this.element.dataset.pathlandComponentType = componentType.toString();

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
          this.element.style.backgroundColor = rgbaToCss(rgba);
        }
        break;

      case StyleProperty.COLOR:
        if (value.type === 'u32' || (value.type === 'color' && value.kind === 'literal')) {
          const rgba = value.type === 'u32' ? value.value : value.rgba;
          this.element.style.color = rgbaToCss(rgba);
        }
        break;

      case StyleProperty.FONT_SIZE:
        if (value.type === 'f32') {
          this.element.style.fontSize = `${value.value}px`;
        }
        break;

      case StyleProperty.FONT_WEIGHT:
        if (value.type === 'u8' || value.type === 'u32') {
          this.element.style.fontWeight = String(value.value);
        }
        break;

      case StyleProperty.WIDTH:
        if (value.type === 'f32') {
          if (value.value === FILL) {
            this.element.style.width = '100%';
          } else if (value.value === HUG_CONTENT) {
            this.element.style.width = 'fit-content';
          } else {
            this.element.style.width = `${value.value}px`;
          }
        }
        break;

      case StyleProperty.HEIGHT:
        if (value.type === 'f32') {
          if (value.value === FILL) {
            this.element.style.height = '100%';
          } else if (value.value === HUG_CONTENT) {
            this.element.style.height = 'fit-content';
          } else {
            this.element.style.height = `${value.value}px`;
          }
        }
        break;

      case StyleProperty.OPACITY:
        if (value.type === 'f32') {
          this.element.style.opacity = String(value.value);
        }
        break;

      case StyleProperty.VISIBLE:
        if (value.type === 'u8') {
          this.element.style.display = value.value ? '' : 'none';
        }
        break;

      case StyleProperty.PADDING:
        if (value.type === 'f32') {
          this.element.style.padding = `${value.value}px`;
        }
        break;

      case StyleProperty.BORDER_WIDTH:
        if (value.type === 'f32') {
          this.element.style.borderWidth = `${value.value}px`;
        }
        break;

      case StyleProperty.BORDER_COLOR:
        if (value.type === 'u32' || (value.type === 'color' && value.kind === 'literal')) {
          const rgba = value.type === 'u32' ? value.value : value.rgba;
          this.element.style.borderColor = rgbaToCss(rgba);
        }
        break;

      case StyleProperty.BORDER_RADIUS:
        if (value.type === 'f32') {
          this.element.style.borderRadius = `${value.value}px`;
        }
        break;

      // Stack properties
      case StackProperty.SPACING:
        if (value.type === 'f32') {
          this.element.style.gap = `${value.value}px`;
        }
        break;

      case StackProperty.ALIGNMENT:
        if (value.type === 'enum') {
          this.element.style.alignItems = enumToAlignItems(value.value);
        }
        break;

      case StackProperty.JUSTIFICATION:
        if (value.type === 'enum') {
          this.element.style.justifyContent = enumToJustifyContent(value.value);
        }
        break;

      // Special handling for HSTACK/VSTACK
      case StackProperty.PADDING:
        if (value.type === 'f32') {
          this.element.style.padding = `${value.value}px`;
        }
        break;
    }
  }

  insertChild(child: RenderElement, index: number): void {
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

  removeChild(child: RenderElement): void {
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
// RENDERER
// ============================================

/**
 * DOM-based renderer for Pathland protocol.
 * Maintains only nodeId -> RenderElement mapping for event routing.
 */
export class DOMRenderer {
  private root: RenderElement;
  private elements: Map<number, RenderElement> = new Map();
  private container: HTMLElement;

  /**
   * Create a new DOMRenderer.
   * @param container The DOM element to render into (defaults to document.body)
   */
  constructor(container: HTMLElement = document.body) {
    this.container = container;
    
    // Create root container
    this.root = new RenderElement(0, 0, this.container);
    this.elements.set(0, this.root);
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
      // Other command types are ignored by the renderer
    }
  }

  private createNode(command: Extract<Command, { opcode: 'CREATE_NODE' }>): void {
    if (this.elements.has(command.nodeId)) {
      console.warn(`Element ${command.nodeId} already exists`);
      return;
    }

    const element = new RenderElement(command.nodeId, command.componentType);
    this.elements.set(command.nodeId, element);

    // Apply initial properties
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
  getElement(nodeId: number): RenderElement | undefined {
    return this.elements.get(nodeId);
  }

  /**
   * Get the root container element.
   */
  getRootElement(): RenderElement {
    return this.root;
  }

  /**
   * Get the DOM container.
   */
  getContainer(): HTMLElement {
    return this.container;
  }

  /**
   * Clear all elements.
   */
  clear(): void {
    for (const [nodeId, element] of this.elements) {
      if (nodeId !== 0) {
        element.remove();
      }
    }
    this.elements.clear();
    this.root = new RenderElement(0, 0, this.container);
    this.elements.set(0, this.root);
  }

  /**
   * Get the DOM element for a node.
   */
  getDOMElement(nodeId: number): HTMLElement | undefined {
    return this.elements.get(nodeId)?.element;
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

export { DOMRenderer as default };
