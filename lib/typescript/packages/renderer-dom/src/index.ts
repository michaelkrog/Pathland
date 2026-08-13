/**
 * @pathland/renderer-dom
 * 
 * Unified DOM-based renderer for Pathland protocol.
 * Works with both browser DOM and JSDOM (Node.js).
 * Executes Pathland commands to create and manage DOM elements.
 */

import type { Command, PropertyValue, EventData } from '@pathland/protocol';
import { ComponentType, StyleProperty, TextProperty, StackProperty, FILL, HUG_CONTENT, SemanticColorToken, EventType, decodeMessage } from '@pathland/protocol';
import type { Renderer, PointerInput } from '@pathland/renderer';
import { PointerInteraction } from '@pathland/renderer';
import { createComponentElement, definePathlandElements, type PathlandHostElement } from './components';
import { resolveNodeId } from './events';

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
  /** 
   * Container element to render into.
   * If not provided, will look for <app-root> or use document.body.
   * For JSDOM: can be a JSDOM Element or Document.
   */
  container?: DOMNode | DOMDocument;
  /** 
   * Document to use for rendering.
   * Required when using JSDOM with a container element.
   * When not provided, uses the global document (browser) or derived from container.
   */
  document?: DOMDocument;
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
      // Custom element host with a shadow root (hard CSS encapsulation).
      this.element = createComponentElement(document, componentType);
      setDataAttribute(this.element, 'node-id', nodeId.toString());
      setDataAttribute(this.element, 'component-type', componentType.toString());

      // Make the element focusable so focus/blur/keyboard events can route to it.
      (this.element as HTMLElement).tabIndex = -1;
    }

    if (container) {
      container.appendChild(this.element);
    }
  }

  /**
   * Shadow-internal target element for leaf components (text span, button,
   * image, inputs). Returns null for containers, spacer and comment nodes.
   */
  getInternalElement(): HTMLElement | null {
    const host = this.element as PathlandHostElement;
    return host && typeof host.inner !== 'undefined' ? host.inner : null;
  }

  setProperty(propertyId: number, value: PropertyValue): void {
    this.applyProperty(propertyId, value);
  }

  private applyProperty(propertyId: number, value: PropertyValue): void {
    const host = this.element as HTMLElement;
    switch (propertyId) {
      // Text
      case TextProperty.TEXT:
        if (value.type === 'string') {
          const inner = this.getInternalElement();
          if (inner) inner.textContent = value.value;
        }
        break;

      // Style properties — set as per-element inline CSS custom properties,
      // consumed by the shared :host rule set in the component shadow root.
      case StyleProperty.COLOR:
        setVar(host, '--pl-color', colorToCss(value));
        break;

      case StyleProperty.BACKGROUND_COLOR:
        setVar(host, '--pl-bg', colorToCss(value));
        break;

      case StyleProperty.FONT_SIZE:
        if (value.type === 'f32') {
          setVar(host, '--pl-font-size', `${value.value}px`);
        }
        break;

      case StyleProperty.FONT_WEIGHT:
        if (value.type === 'u8' || value.type === 'u32') {
          setVar(host, '--pl-font-weight', String(value.value));
        }
        break;

      case StyleProperty.FONT_FAMILY:
        if (value.type === 'string') {
          setVar(host, '--pl-font-family', value.value);
        }
        break;

      case StyleProperty.WIDTH:
        if (value.type === 'f32') {
          setVar(host, '--pl-width', cssSize(value.value));
        }
        break;

      case StyleProperty.HEIGHT:
        if (value.type === 'f32') {
          setVar(host, '--pl-height', cssSize(value.value));
        }
        break;

      case StyleProperty.OPACITY:
        if (value.type === 'f32') {
          setVar(host, '--pl-opacity', String(value.value));
        }
        break;

      case StyleProperty.VISIBLE:
        if (value.type === 'u8') {
          if (value.value) {
            host.style.removeProperty('--pl-display');
          } else {
            setVar(host, '--pl-display', 'none');
          }
        }
        break;

      case StyleProperty.PADDING:
        if (value.type === 'f32') {
          setVar(host, '--pl-padding', `${value.value}px`);
        }
        break;

      case StyleProperty.BORDER_WIDTH:
        if (value.type === 'f32') {
          setVar(host, '--pl-border-width', `${value.value}px`);
        }
        break;

      case StyleProperty.BORDER_COLOR:
        setVar(host, '--pl-border-color', colorToCss(value));
        break;

      case StyleProperty.BORDER_RADIUS:
        if (value.type === 'f32') {
          setVar(host, '--pl-border-radius', `${value.value}px`);
        }
        break;

      // Per-edge padding (EdgeInsets)
      case StyleProperty.PADDING_TOP:
        if (value.type === 'f32') {
          setVar(host, '--pl-padding-top', `${value.value}px`);
        }
        break;

      case StyleProperty.PADDING_RIGHT:
        if (value.type === 'f32') {
          setVar(host, '--pl-padding-right', `${value.value}px`);
        }
        break;

      case StyleProperty.PADDING_BOTTOM:
        if (value.type === 'f32') {
          setVar(host, '--pl-padding-bottom', `${value.value}px`);
        }
        break;

      case StyleProperty.PADDING_LEFT:
        if (value.type === 'f32') {
          setVar(host, '--pl-padding-left', `${value.value}px`);
        }
        break;

      // Stack properties
      case StackProperty.SPACING:
        if (value.type === 'f32') {
          setVar(host, '--pl-spacing', `${value.value}px`);
        }
        break;

      case StackProperty.ALIGNMENT:
        if (value.type === 'enum') {
          setVar(host, '--pl-align', enumToAlignItems(value.value));
        }
        break;

      case StackProperty.JUSTIFICATION:
        if (value.type === 'enum') {
          setVar(host, '--pl-justify', enumToJustifyContent(value.value));
        }
        break;

      case StackProperty.PADDING:
        if (value.type === 'f32') {
          setVar(host, '--pl-padding', `${value.value}px`);
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
  private dispatchEvent: (nodeId: number, eventType: number, data?: EventData) => void = () => {};
  private dispatchGesture: (nodeId: number, gestureType: number, gestureState: number, data?: EventData) => void = () => {};
  private attachedGestures: Map<number, Set<number>> = new Map();

  /**
   * Create a new DOMRenderer.
   * @param config Configuration options including container and document
   */
  constructor(config: DOMRendererConfig = {}) {
    this.config = config;
    this.logger = config.logger || console.log;
    
    // Determine document and container from config
    if (config.container !== undefined) {
      if (isDocument(config.container)) {
        // Container is a document (JSDOM case)
        this.document = config.container;
        this.container = this.document.body as DOMNode;
      } else if (isDOMNode(config.container)) {
        // Container is a DOM node (element or comment)
        this.container = config.container;
        this.document = config.document || (typeof document !== 'undefined' ? document : undefined) as DOMDocument;
      } else {
        throw new Error('Invalid container provided.');
      }
    } else {
      // No container provided - use default logic
      if (typeof document !== 'undefined') {
        this.document = document;
        // Look for <app-root> first, then fall back to document.body
        const appRoot = document.querySelector('app-root');
        this.container = (appRoot || document.body) as DOMNode;
      } else if (config.document) {
        // JSDOM case with document provided but no container
        this.document = config.document;
        this.container = this.document.body as DOMNode;
      } else {
        throw new Error('No container or document provided. For JSDOM, pass the document in config or import { createJSDOMRenderer } from "@pathland/renderer-dom/jsdom".');
      }
    }
    
    if (!this.document) {
      throw new Error('No document provided and no global document available. For JSDOM, pass the document parameter or import { createJSDOMRenderer } from "@pathland/renderer-dom/jsdom".');
    }
    
    if (!this.container) {
      throw new Error('No container node available.');
    }
    
    // Create root container
    this.root = new RenderElement(0, 0, this.document, this.container);
    this.elements.set(0, this.root);

    // Define the Pathland custom elements on this document and seed the
    // default design-token variables so semantic colors cascade into every
    // component shadow root.
    definePathlandElements(this.document);
    applyDefaultTokens(this.root.element as HTMLElement);
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
   * @param dispatchEvent Callback: (nodeId, eventType, data?) => void
   */
  setupEvents(dispatchEvent: (nodeId: number, eventType: number, data?: EventData) => void): void {
    this.dispatchEvent = dispatchEvent;

    if (!isElement(this.container)) return;
    const container = this.container as HTMLElement;

    // Modifier bit flags (matches the protocol's Modifier Keys).
    const modifiersOf = (event: MouseEvent | KeyboardEvent): number =>
      (event.shiftKey ? 0x01 : 0) |
      (event.ctrlKey ? 0x02 : 0) |
      (event.altKey ? 0x04 : 0) |
      (event.metaKey ? 0x08 : 0);

    // ---- Click ----
    container.addEventListener('click', (event: Event) => {
      const nodeId = resolveNodeId(event.target);
      if (nodeId !== null) {
        const me = event as MouseEvent;
        this.dispatchEvent(nodeId, EventType.CLICK, { x: me.clientX, y: me.clientY });
      }
    });

    // ---- Long press (mousedown + timer, cancelled on move/up/leave) ----
    const LONG_PRESS_DELAY = 500;
    const LONG_PRESS_MOVE_TOLERANCE = 10;
    let pressNodeId: number | null = null;
    let pressTimer: ReturnType<typeof setTimeout> | null = null;
    let pressStartX = 0;
    let pressStartY = 0;

    const cancelLongPress = (): void => {
      if (pressTimer !== null) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
      pressNodeId = null;
    };

    container.addEventListener('mousedown', (event: MouseEvent) => {
      cancelLongPress();
      const nodeId = resolveNodeId(event.target);
      if (nodeId === null) return;
      pressNodeId = nodeId;
      pressStartX = event.clientX;
      pressStartY = event.clientY;
      pressTimer = setTimeout(() => {
        if (pressNodeId !== null) {
          this.dispatchEvent(pressNodeId, EventType.LONG_PRESS, {
            x: pressStartX,
            y: pressStartY,
            duration: LONG_PRESS_DELAY / 1000,
            pressure: 1,
          });
          pressNodeId = null;
          pressTimer = null;
        }
      }, LONG_PRESS_DELAY);
    });
    container.addEventListener('mouseup', cancelLongPress);
    container.addEventListener('mouseleave', cancelLongPress);
    container.addEventListener('mousemove', (event: MouseEvent) => {
      if (pressNodeId === null) return;
      const moved =
        Math.abs(event.clientX - pressStartX) + Math.abs(event.clientY - pressStartY);
      if (moved > LONG_PRESS_MOVE_TOLERANCE) cancelLongPress();
    });

    // ---- Hover (dispatch HOVER with the isHovering flag) ----
    let hoveredNodeId: number | null = null;
    container.addEventListener('mouseover', (event: Event) => {
      const nodeId = resolveNodeId(event.target);
      if (nodeId !== null && nodeId !== hoveredNodeId) {
        hoveredNodeId = nodeId;
        const me = event as MouseEvent;
        this.dispatchEvent(nodeId, EventType.HOVER, { isHovering: true, x: me.clientX, y: me.clientY });
      }
    });
    container.addEventListener('mouseout', (event: MouseEvent) => {
      if (hoveredNodeId === null) return;
      const next = resolveNodeId(event.relatedTarget as EventTarget | null);
      if (next !== hoveredNodeId) {
        this.dispatchEvent(hoveredNodeId, EventType.HOVER, {
          isHovering: false,
          x: event.clientX,
          y: event.clientY,
        });
        hoveredNodeId = null;
      }
    });
    container.addEventListener('mouseleave', () => {
      if (hoveredNodeId !== null) {
        this.dispatchEvent(hoveredNodeId, EventType.HOVER, { isHovering: false });
        hoveredNodeId = null;
      }
    });

    // ---- Focus / blur (focusin/focusout bubble) ----
    container.addEventListener('focusin', (event: FocusEvent) => {
      const nodeId = resolveNodeId(event.target);
      if (nodeId !== null) this.dispatchEvent(nodeId, EventType.FOCUS, { isFocused: true });
    });
    container.addEventListener('focusout', (event: FocusEvent) => {
      const nodeId = resolveNodeId(event.target);
      if (nodeId !== null) this.dispatchEvent(nodeId, EventType.BLUR, { isFocused: false });
    });

    // ---- Keyboard (bubbles from the focused node) ----
    container.addEventListener('keydown', (event: KeyboardEvent) => {
      const nodeId = resolveNodeId(event.target);
      if (nodeId !== null) {
        this.dispatchEvent(nodeId, EventType.KEY_DOWN, {
          keyCode: event.keyCode || event.which || 0,
          modifiers: modifiersOf(event),
          repeat: event.repeat,
        });
      }
    });
    container.addEventListener('keyup', (event: KeyboardEvent) => {
      const nodeId = resolveNodeId(event.target);
      if (nodeId !== null) {
        this.dispatchEvent(nodeId, EventType.KEY_UP, {
          keyCode: event.keyCode || event.which || 0,
          modifiers: modifiersOf(event),
        });
      }
    });
  }

  /**
   * Set up gesture handling for this renderer.
   * Feeds DOM pointer events into the shared PointerInteraction recognizer,
   * dispatching GESTURE_UPDATE callbacks for attached gestures.
   * 
   * @param dispatchGesture Callback: (nodeId, gestureType, gestureState, data?) => void
   */
  setupGestures(
    dispatchGesture: (nodeId: number, gestureType: number, gestureState: number, data?: EventData) => void
  ): void {
    this.dispatchGesture = dispatchGesture;

    if (!isElement(this.container)) return;
    const container = this.container as HTMLElement;

    const interaction = new PointerInteraction({
      hitTest: (input: PointerInput) => resolveNodeId(input.target as EventTarget | null),
      attachedGestures: (nodeId: number) => this.attachedGestures.get(nodeId),
      onGesture: (nodeId, gestureType, gestureState, data) =>
        this.dispatchGesture(nodeId, gestureType, gestureState, data),
    });

    const toInput = (type: PointerInput['type'], event: MouseEvent): PointerInput => ({
      type,
      x: event.clientX,
      y: event.clientY,
      timestamp: event.timeStamp,
      target: event.target,
    });

    container.addEventListener('mousedown', (event: MouseEvent) => interaction.handle(toInput('down', event)));
    container.addEventListener('mousemove', (event: MouseEvent) => interaction.handle(toInput('move', event)));
    container.addEventListener('mouseup', (event: MouseEvent) => interaction.handle(toInput('up', event)));
    container.addEventListener('mouseleave', () => interaction.cancel());
  }

  private attachGesture(command: Extract<Command, { opcode: 'ATTACH_GESTURE' }>): void {
    let set = this.attachedGestures.get(command.nodeId);
    if (!set) {
      set = new Set<number>();
      this.attachedGestures.set(command.nodeId, set);
    }
    set.add(command.gestureType);
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
      case 'MOVE_CHILD':
        this.moveChild(command);
        break;
      case 'RESET':
        this.clear();
        break;
      case 'ATTACH_GESTURE':
        this.attachGesture(command);
        break;
      case 'SET_PROPERTY':
        this.setProperty(command);
        break;
      case 'SET_DESIGN_TOKEN':
        this.setDesignToken(command);
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

  private moveChild(command: Extract<Command, { opcode: 'MOVE_CHILD' }>): void {
    const parent = this.elements.get(command.parentId);
    const child = this.elements.get(command.childId);

    if (!parent) {
      console.warn(`Cannot move child: parent ${command.parentId} not found`);
      return;
    }
    if (!child) {
      console.warn(`Cannot move child: child ${command.childId} not found`);
      return;
    }
    if (child.parent !== parent) {
      console.warn(`Cannot move child: child ${command.childId} is not a child of ${command.parentId}`);
      return;
    }

    // Remove, then re-insert at the target index (index is relative to the
    // list after removal).
    parent.removeChild(child);
    parent.insertChild(child, command.index);
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
   * Apply a design token as a CSS custom property on the root container.
   * The variable name derives from the dot-separated token path
   * (e.g. `color.primary` -> `--pl-color-primary`); because custom properties
   * cascade into every component shadow root, a single write re-themes the
   * whole surface.
   */
  private setDesignToken(command: Extract<Command, { opcode: 'SET_DESIGN_TOKEN' }>): void {
    const host = this.root.element as HTMLElement;
    const css = tokenValueToCss(command.value);
    if (css !== null) {
      setVar(host, tokenPathToVar(command.tokenPath), css);
    }
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
    // Remove the root's direct children (their subtrees are detached with
    // them). Iterating the whole map and removing each element would double-
    // remove descendants already detached by their ancestors.
    for (const child of [...this.root.children]) {
      this.root.removeChild(child);
    }
    this.elements.clear();
    this.root = new RenderElement(0, 0, this.document, this.container);
    this.elements.set(0, this.root);
    applyDefaultTokens(this.root.element as HTMLElement);
  }

  /**
   * Get the DOM node for a node.
   */
  getDOMElement(nodeId: number): DOMNode | undefined {
    return this.elements.get(nodeId)?.element;
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
  const a = (rgba >>> 24) & 0xFF;
  const r = (rgba >>> 16) & 0xFF;
  const g = (rgba >>> 8) & 0xFF;
  const b = rgba & 0xFF;
  return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
}

// ============================================
// DEFAULT THEME
// ============================================

/**
 * Default resolution of semantic color tokens to concrete sRGB values.
 * The renderer owns the default theme; applications may override tokens
 * via SET_DESIGN_TOKEN (which the renderer can apply on top of these).
 */
const DEFAULT_SEMANTIC_COLORS: Record<number, number> = {
  [SemanticColorToken.PRIMARY_TEXT]: 0xFF1C1C1E,
  [SemanticColorToken.SECONDARY_TEXT]: 0xFF6E6E73,
  [SemanticColorToken.TERTIARY_TEXT]: 0xFF8E8E93,
  [SemanticColorToken.BACKGROUND]: 0xFFFFFFFF,
  [SemanticColorToken.SURFACE]: 0xFFF2F2F7,
  [SemanticColorToken.ACCENT]: 0xFF007AFF,
  [SemanticColorToken.ERROR]: 0xFFFF3B30,
  [SemanticColorToken.SUCCESS]: 0xFF34C759,
  [SemanticColorToken.WARNING]: 0xFFFF9500,
  [SemanticColorToken.INFO]: 0xFF0A84FF,
  [SemanticColorToken.BORDER]: 0xFFC7C7CC,
  [SemanticColorToken.SEPARATOR]: 0xFFD1D1D6,
};

/**
 * Semantic color token ids -> canonical design-token paths (per spec:
 * BINARY_PROTOCOL.md "Design Token System"). Token vars derive from these
 * paths so `SET_DESIGN_TOKEN` and semantic color references resolve to the
 * same CSS custom property (e.g. PRIMARY_TEXT -> `--pl-color-text-primary`).
 */
const SEMANTIC_TOKEN_PATHS: Record<number, string> = {
  [SemanticColorToken.PRIMARY_TEXT]: 'color.text.primary',
  [SemanticColorToken.SECONDARY_TEXT]: 'color.text.secondary',
  [SemanticColorToken.TERTIARY_TEXT]: 'color.text.tertiary',
  [SemanticColorToken.BACKGROUND]: 'color.background',
  [SemanticColorToken.SURFACE]: 'color.surface',
  [SemanticColorToken.ACCENT]: 'color.accent',
  [SemanticColorToken.ERROR]: 'color.danger',
  [SemanticColorToken.SUCCESS]: 'color.success',
  [SemanticColorToken.WARNING]: 'color.warning',
  [SemanticColorToken.INFO]: 'color.info',
  [SemanticColorToken.BORDER]: 'color.border',
  [SemanticColorToken.SEPARATOR]: 'color.separator',
};

/** Set an inline CSS custom property (returns early on unresolvable values). */
function setVar(host: HTMLElement, name: string, css: string | null): void {
  if (css !== null) {
    host.style.setProperty(name, css);
  }
}

/**
 * Convert a color PropertyValue to a CSS value: literal/u32 colors become
 * concrete rgba() strings; semantic tokens become var() references to the
 * design-token custom properties defined on the root container.
 */
function colorToCss(value: PropertyValue): string | null {
  if (value.type === 'color') {
    if (value.kind === 'literal') {
      return rgbaToCss(value.rgba);
    }
    if (value.kind === 'semantic') {
      const path = SEMANTIC_TOKEN_PATHS[value.tokenId];
      return path ? `var(${tokenPathToVar(path)})` : null;
    }
  }
  if (value.type === 'u32') {
    return rgbaToCss(value.value);
  }
  return null;
}

/** Convert a WIDTH/HEIGHT value to a CSS size string. */
function cssSize(value: number): string {
  if (value === FILL) return '100%';
  if (value === HUG_CONTENT) return 'fit-content';
  return `${value}px`;
}

/** Convert a design-token path to a CSS custom-property name. */
function tokenPathToVar(path: string): string {
  return `--pl-${path.replace(/\./g, '-')}`;
}

/** Convert a design-token value to a CSS value for the custom property. */
function tokenValueToCss(value: PropertyValue): string | null {
  if (value.type === 'color' || value.type === 'u32') {
    return colorToCss(value);
  }
  if (value.type === 'string') return value.value;
  if (value.type === 'f32') return String(value.value);
  if (value.type === 'u8' || value.type === 'i32') return String(value.value);
  return null;
}

/** Define the default semantic color token variables on the root container. */
function applyDefaultTokens(host: HTMLElement): void {
  for (const [tokenId, rgba] of Object.entries(DEFAULT_SEMANTIC_COLORS)) {
    const path = SEMANTIC_TOKEN_PATHS[Number(tokenId)];
    if (path) {
      host.style.setProperty(tokenPathToVar(path), rgbaToCss(rgba));
    }
  }
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
