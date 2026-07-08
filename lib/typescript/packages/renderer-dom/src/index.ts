/**
 * @pathland/renderer-dom
 * 
 * Unified DOM-based renderer for Pathland protocol.
 * Works with both browser DOM and JSDOM (Node.js).
 * Executes Pathland commands to create and manage DOM elements.
 */

import type { Command, PropertyValue } from '@pathland/protocol';
import { ComponentType, StyleProperty, TextProperty, StackProperty, FILL, HUG_CONTENT, decodeMessage } from '@pathland/protocol';
import type { Renderer } from '@pathland/renderer';

// ============================================
// LOGGING CONFIGURATION
// ============================================

/**
 * Configuration options for the DOMRenderer.
 */
interface DOMRendererConfig {
  /** Enable verbose command logging to console */
  debug?: boolean;
  /** Custom logger function (defaults to console.log) */
  logger?: (message: string) => void;
}

// ============================================
// TYPE DEFINITIONS
// ============================================

/**
 * DOM element type that works with both browser DOM and JSDOM
 * Includes regular elements and comment nodes
 */
type DOMNode = Element | HTMLElement | Comment;

/**
 * Document type that works with both browser and JSDOM
 */
type DOMDocument = Document;

/**
 * Type guard to check if an object is a Document
 */
function isDocument(obj: any): obj is DOMDocument {
  return obj && typeof obj.createElement === 'function' && obj.nodeType === 9;
}

/**
 * Type guard to check if an object is an Element (nodeType 1)
 */
function isElement(obj: any): obj is Element {
  return obj && typeof obj.appendChild === 'function' && obj.nodeType === 1;
}

/**
 * Type guard to check if an object is a Comment (nodeType 8)
 */
function isComment(obj: any): obj is Comment {
  return obj && obj.nodeType === 8;
}

/**
 * Type guard to check if an object is a DOM node (Element or Comment)
 */
function isDOMNode(obj: any): obj is DOMNode {
  return obj && (obj.nodeType === 1 || obj.nodeType === 8);
}

// ============================================
// RENDER ELEMENT
// ============================================

/**
 * Maps Pathland component types to DOM element tag names.
 * COMMENT maps to 'comment' which is handled specially to create DOM comment nodes.
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
  [ComponentType.COMMENT]: 'comment',
};

/**
 * Helper to set data attributes that works with both DOM and JSDOM.
 * Note: Comment nodes don't support setAttribute, so this should only be called on Elements.
 */
function setDataAttribute(element: Element, name: string, value: string): void {
  element.setAttribute(`data-pathland-${name}`, value);
}

/**
 * A render element wraps a DOM node (Element or Comment) and handles property application.
 * Works with both browser HTMLElement and JSDOM Element, and Comment nodes.
 */
class RenderElement {
  readonly id: number;
  readonly componentType: number;
  readonly element: DOMNode;
  children: RenderElement[] = [];
  parent: RenderElement | null = null;

  constructor(nodeId: number, componentType: number, document: DOMDocument, container?: DOMNode) {
    this.id = nodeId;
    this.componentType = componentType;
    
    // Special handling for COMMENT component type
    if (componentType === ComponentType.COMMENT) {
      this.element = document.createComment('pathland-conditional');
      // Note: Comment nodes don't support setAttribute, so we use a different approach
      // For now, we'll skip data attributes on comments as they're not standard
    } else {
      const tag = COMPONENT_TO_TAG[componentType] || 'div';
      this.element = document.createElement(tag);
      setDataAttribute(this.element, 'node-id', nodeId.toString());
      setDataAttribute(this.element, 'component-type', componentType.toString());

      // Setup flex layout for stack containers
      if (componentType === ComponentType.HSTACK) {
        (this.element as HTMLElement).style.display = 'flex';
        (this.element as HTMLElement).style.flexDirection = 'row';
      } else if (componentType === ComponentType.VSTACK) {
        (this.element as HTMLElement).style.display = 'flex';
        (this.element as HTMLElement).style.flexDirection = 'column';
      }

      // Special setup for certain components
      if (componentType === ComponentType.SWITCH) {
        (this.element as HTMLInputElement).type = 'checkbox';
      }
      if (componentType === ComponentType.TEXT_FIELD) {
        (this.element as HTMLInputElement).type = 'text';
      }
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
          (this.element as HTMLElement).style.borderStyle = `solid`;
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

  insertChild(child: RenderElement, index: number): void {
    // Special handling for COMMENT nodes: insert as sibling after the comment
    if (this.componentType === ComponentType.COMMENT) {
      // For comment nodes, we insert the child as a sibling after the comment
      if (this.element.parentNode) {
        if (index >= this.children.length) {
          this.element.parentNode.insertBefore(child.element, this.element.nextSibling);
          this.children.push(child);
        } else {
          // Find the reference node (next sibling after comment that is our child)
          let refNode = this.element.nextSibling;
          for (let i = 0; i < index && refNode; i++) {
            refNode = refNode.nextSibling;
          }
          this.element.parentNode.insertBefore(child.element, refNode);
          this.children.splice(index, 0, child);
        }
      }
      child.parent = this.parent; // Comment's parent becomes child's parent
    } else {
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
  }

  removeChild(child: RenderElement): void {
    // Special handling for COMMENT nodes: remove sibling
    if (this.componentType === ComponentType.COMMENT) {
      if (child.element.parentNode) {
        child.element.parentNode.removeChild(child.element);
      }
      const index = this.children.indexOf(child);
      if (index !== -1) {
        this.children.splice(index, 1);
      }
      child.parent = null;
    } else {
      this.element.removeChild(child.element);
      const index = this.children.indexOf(child);
      if (index !== -1) {
        this.children.splice(index, 1);
      }
      child.parent = null;
    }
  }

  remove(): void {
    // For COMMENT nodes, remove from parent's children list and from DOM
    if (this.parent) {
      this.parent.removeChild(this);
    } else if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    // Also remove all children (siblings for comment nodes)
    for (const child of [...this.children]) {
      if (child.element.parentNode) {
        child.element.parentNode.removeChild(child.element);
      }
    }
    this.children = [];
  }
}

// ============================================
// RENDERER
// ============================================

/**
 * DOM-based renderer for Pathland protocol.
 * Works with both browser DOM and JSDOM.
 * Maintains only nodeId -> RenderElement mapping for event routing.
 */
export class DOMRenderer implements Renderer {
  private root: RenderElement;
  private elements: Map<number, RenderElement> = new Map();
  private container: DOMNode;
  private document: DOMDocument;
  private config: DOMRendererConfig = {};
  private logger: (message: string) => void;
  private dispatchEvent: (nodeId: number, eventType: number) => void = () => {};

  /**
   * Create a new DOMRenderer.
   * @param containerOrDocument The DOM node to render into, or a Document for JSDOM
   * @param config Optional configuration options
   * @param optionalDocument Optional document to use (for JSDOM when first param is a container element)
   */
  constructor(
    containerOrDocument: DOMNode | DOMDocument = (typeof document !== 'undefined' ? document.body : undefined) as DOMNode | DOMDocument,
    config: DOMRendererConfig = {},
    optionalDocument?: DOMDocument
  ) {
    this.config = config;
    this.logger = config.logger || console.log;
    
    // Determine document and container from parameters
    if (isDocument(containerOrDocument)) {
      // First parameter is a document (JSDOM case)
      this.document = containerOrDocument;
      this.container = this.document.body as DOMNode;
    } else if (isDOMNode(containerOrDocument)) {
      // First parameter is a container node (element or comment)
      this.container = containerOrDocument;
      this.document = optionalDocument || (typeof document !== 'undefined' ? document : undefined) as DOMDocument;
    } else {
      // Fallback for default parameter
      if (typeof document !== 'undefined') {
        this.document = document;
        this.container = document.body;
      } else {
        throw new Error('No valid container or document provided and no global document available. For JSDOM, pass the document parameter or use DOMRenderer.createJSDOMRenderer().');
      }
    }
    
    if (!this.document) {
      throw new Error('No document provided and no global document available. For JSDOM, pass the document parameter or use DOMRenderer.createJSDOMRenderer().');
    }
    
    if (!this.container) {
      throw new Error('No container node available.');
    }
    
    // Create root container
    this.root = new RenderElement(0, 0, this.document, this.container);
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

  /**
   * Log a command in human-readable format.
   * Only logs if debug mode is enabled.
   */
  private logCommand(command: Command): void {
    if (this.config.debug) {
      this.logger(`[Pathland] ${formatCommand(command)}`);
    }
  }

  /**
   * Set debug mode on/off.
   * @param enabled Whether to enable debug logging
   */
  setDebug(enabled: boolean): void {
    this.config.debug = enabled;
  }

  /**
   * Set a custom logger function.
   * @param logger Function to use for logging
   */
  setLogger(logger: (message: string) => void): void {
    this.logger = logger;
  }

  /**
   * Set up event handling for this renderer.
   * Sets up DOM event listeners and calls dispatchEvent when events occur.
   * 
   * @param dispatchEvent Callback: (nodeId, eventType) => void
   */
  setupEvents(dispatchEvent: (nodeId: number, eventType: number) => void): void {
    this.dispatchEvent = dispatchEvent;
    
    // Set up event delegation on the container for DOM events
    if (isElement(this.container)) {
      // Click events
      this.container.addEventListener('click', (event: Event) => {
        let target = event.target as HTMLElement;
        while (target && !target.dataset.pathlandNodeId) {
          target = target.parentElement as HTMLElement;
        }
        if (target?.dataset.pathlandNodeId) {
          const nodeId = parseInt(target.dataset.pathlandNodeId, 10);
          this.dispatchEvent(nodeId, 0x04); // EventType.CLICK
        }
      });
    }
  }

  private executeCommand(command: Command): void {
    // Log command if debug mode is enabled
    this.logCommand(command);
    
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

    const element = new RenderElement(command.nodeId, command.componentType, this.document);
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
  getContainer(): DOMNode {
    return this.container;
  }

  /**
   * Get the document being used.
   */
  getDocument(): DOMDocument | undefined {
    return this.document;
  }

  /**
   * Get the HTML string of the container.
   * Only works with JSDOM or if container is a complete document.
   */
  getHTML(): string | undefined {
    if (this.document && 'serialize' in this.document) {
      // JSDOM
      return (this.document as any).serialize();
    }
    // Browser - can only get innerHTML (only works for Element nodes, not Comment)
    if (isElement(this.container)) {
      return this.container.innerHTML;
    }
    return undefined;
  }

  /**
   * Get the HTML string of the body content.
   * Only works with JSDOM.
   */
  getBodyHTML(): string | undefined {
    if (this.document && this.document.body) {
      return this.document.body.innerHTML;
    }
    return undefined;
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
    this.root = new RenderElement(0, 0, this.document, this.container);
    this.elements.set(0, this.root);
  }

  /**
   * Get the DOM node for a node.
   */
  getDOMElement(nodeId: number): DOMNode | undefined {
    return this.elements.get(nodeId)?.element;
  }

  /**
   * Create a new JSDOM renderer for server-side use.
   * This is a convenience factory for Node.js environments.
   */
  static async createJSDOMRenderer(html?: string, config: DOMRendererConfig = {}): Promise<DOMRenderer> {
    // Dynamic import for ESM compatibility
    const { JSDOM } = await import('jsdom');
    const dom = new JSDOM(html || '<!DOCTYPE html><html><body></body></html>');
    return new DOMRenderer(dom.window.document.body as unknown as Element, config, dom.window.document);
  }
}

// ============================================
// COMMAND LOGGING
// ============================================

/**
 * Maps opcode to human-readable string.
 */
const OPCODE_NAMES: Record<string, string> = {
  'CREATE_NODE': 'CREATE_NODE',
  'DELETE_NODE': 'DELETE_NODE',
  'INSERT_CHILD': 'INSERT_CHILD',
  'REMOVE_CHILD': 'REMOVE_CHILD',
  'SET_PROPERTY': 'SET_PROPERTY',
  'SET_DESIGN_TOKEN': 'SET_DESIGN_TOKEN',
  'REGISTER_EVENT_HANDLER': 'REGISTER_EVENT_HANDLER'
};

/**
 * Maps component type ID to human-readable string.
 */
const COMPONENT_TYPE_NAMES: Record<number, string> = {
  [ComponentType.HSTACK]: 'HSTACK',
  [ComponentType.VSTACK]: 'VSTACK',
  [ComponentType.TEXT]: 'TEXT',
  [ComponentType.BUTTON]: 'BUTTON',
  [ComponentType.SPACER]: 'SPACER',
  [ComponentType.IMAGE]: 'IMAGE',
  [ComponentType.SCROLLVIEW]: 'SCROLLVIEW',
  [ComponentType.LIST]: 'LIST',
  [ComponentType.GRID]: 'GRID',
  [ComponentType.SWITCH]: 'SWITCH',
  [ComponentType.TEXT_FIELD]: 'TEXT_FIELD',
  [ComponentType.COMMENT]: 'COMMENT'
};

/**
 * Maps property ID to human-readable string.
 */
const PROPERTY_NAMES: Record<number, string> = {
  // Stack properties
  [StackProperty.SPACING]: 'SPACING',
  [StackProperty.ALIGNMENT]: 'ALIGNMENT',
  [StackProperty.JUSTIFICATION]: 'JUSTIFICATION',
  [StackProperty.PADDING]: 'PADDING',
  
  // Text properties
  [TextProperty.TEXT]: 'TEXT',
  [TextProperty.TEXT_ALIGNMENT]: 'TEXT_ALIGNMENT',
  [TextProperty.LINE_LIMIT]: 'LINE_LIMIT',
  
  // Style properties
  [StyleProperty.COLOR]: 'COLOR',
  [StyleProperty.BACKGROUND_COLOR]: 'BACKGROUND_COLOR',
  [StyleProperty.FONT_SIZE]: 'FONT_SIZE',
  [StyleProperty.FONT_WEIGHT]: 'FONT_WEIGHT',
  [StyleProperty.FONT_FAMILY]: 'FONT_FAMILY',
  [StyleProperty.WIDTH]: 'WIDTH',
  [StyleProperty.HEIGHT]: 'HEIGHT',
  [StyleProperty.OPACITY]: 'OPACITY',
  [StyleProperty.VISIBLE]: 'VISIBLE',
  [StyleProperty.BORDER_WIDTH]: 'BORDER_WIDTH',
  [StyleProperty.BORDER_COLOR]: 'BORDER_COLOR',
  [StyleProperty.BORDER_RADIUS]: 'BORDER_RADIUS',
  [StyleProperty.PADDING]: 'PADDING'
};

/**
 * Format a property value for logging.
 */
function formatPropertyValue(value: any): string {
  if (!value) {
    return 'undefined';
  }
  
  if (value.type === 'string') {
    return `"${value.value}"`;
  }
  if (value.type === 'u8' || value.type === 'u16' || value.type === 'u32' || value.type === 'i32') {
    return String(value.value);
  }
  if (value.type === 'f32') {
    return value.value.toFixed(2);
  }
  if (value.type === 'color') {
    if (value.kind === 'semantic') {
      return `semantic(${value.tokenId})`;
    }
    if (value.kind === 'literal') {
      return `0x${value.rgba.toString(16).padStart(8, '0').toUpperCase()}`;
    }
  }
  if (value.type === 'enum') {
    return `enum(${value.value})`;
  }
  if (value.type === 'bool') {
    return value.value ? 'true' : 'false';
  }
  if (value.type === 'designToken') {
    return `designToken(${value.path})`;
  }
  return JSON.stringify(value);
}

/**
 * Format a command for human-readable logging.
 */
function formatCommand(command: Command): string {
  const opcodeName = OPCODE_NAMES[command.opcode] || command.opcode;
  
  switch (command.opcode) {
    case 'CREATE_NODE':
      const componentName = COMPONENT_TYPE_NAMES[command.componentType] || command.componentType;
      return `[${opcodeName}] nodeId=${command.nodeId}, componentType=${componentName}`;
    
    case 'DELETE_NODE':
      return `[${opcodeName}] nodeId=${command.nodeId}`;
    
    case 'INSERT_CHILD':
      return `[${opcodeName}] parentId=${command.parentId}, childId=${command.childId}, index=${command.index}`;
    
    case 'REMOVE_CHILD':
      return `[${opcodeName}] parentId=${command.parentId}, childId=${command.childId}`;
    
    case 'SET_PROPERTY':
      const propertyName = PROPERTY_NAMES[command.propertyId] || command.propertyId;
      return `[${opcodeName}] nodeId=${command.nodeId}, property=${propertyName}, value=${formatPropertyValue(command.value)}`;
    
    case 'SET_DESIGN_TOKEN':
      const setTokenCmd = command as any;
      return `[${opcodeName}] tokenPath="${setTokenCmd.tokenPath}", value=${formatPropertyValue(setTokenCmd.value)}`;
    
    case 'REGISTER_EVENT_HANDLER':
      return `[${opcodeName}] nodeId=${command.nodeId}, eventType=${command.eventType}, handlerId=${command.handlerId}`;
    
    default:
      return `[${opcodeName}] ${JSON.stringify(command)}`;
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

export type { RenderElement, DOMRendererConfig, Renderer };
export { DOMRenderer as default };
