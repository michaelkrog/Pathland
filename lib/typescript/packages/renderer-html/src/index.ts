/**
 * @pathland/renderer-html
 * 
 * HTML string renderer for Pathland protocol.
 * Executes Pathland commands and outputs HTML markup.
 * Useful for server-side rendering (SSR).
 */

import type { Command, PropertyValue, DecodedMessage } from '@pathland/protocol';
import { decodeMessage, ComponentType, StyleProperty, TextProperty, StackProperty, FILL, HUG_CONTENT } from '@pathland/protocol';

// ============================================
// HTML RENDERER
// ============================================

/**
 * Maps Pathland component types to HTML tag names.
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
 * Represents an HTML element being built.
 */
interface HTMLNode {
  tag: string;
  id: number;
  componentType: number;
  attributes: Record<string, string>;
  styles: Record<string, string>;
  textContent: string | null;
  children: HTMLNode[];
}

/**
 * HTML Renderer for Pathland protocol.
 * Builds HTML markup from Pathland commands.
 * Stateless - only processes commands and outputs HTML.
 */
export class HTMLRenderer {
  private root: HTMLNode;
  private nodes: Map<number, HTMLNode> = new Map();

  constructor() {
    this.root = {
      tag: 'div',
      id: 0,
      componentType: 0,
      attributes: {},
      styles: {},
      textContent: null,
      children: [],
    };
    this.nodes.set(0, this.root);
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
    if (this.nodes.has(command.nodeId)) {
      return;
    }

    const tag = COMPONENT_TO_TAG[command.componentType] || 'div';
    const node: HTMLNode = {
      tag,
      id: command.nodeId,
      componentType: command.componentType,
      attributes: {},
      styles: {},
      textContent: null,
      children: [],
    };

    // Apply initial properties
    for (const [propertyId, value] of command.properties) {
      this.applyProperty(node, propertyId, value);
    }

    this.nodes.set(command.nodeId, node);
  }

  private deleteNode(command: Extract<Command, { opcode: 'DELETE_NODE' }>): void {
    this.nodes.delete(command.nodeId);
  }

  private insertChild(command: Extract<Command, { opcode: 'INSERT_CHILD' }>): void {
    const parent = this.nodes.get(command.parentId);
    const child = this.nodes.get(command.childId);

    if (!parent || !child) return;

    parent.children.splice(command.index, 0, child);
  }

  private removeChild(command: Extract<Command, { opcode: 'REMOVE_CHILD' }>): void {
    const parent = this.nodes.get(command.parentId);
    const child = this.nodes.get(command.childId);

    if (!parent || !child) return;

    const index = parent.children.indexOf(child);
    if (index !== -1) {
      parent.children.splice(index, 1);
    }
  }

  private setProperty(command: Extract<Command, { opcode: 'SET_PROPERTY' }>): void {
    const node = this.nodes.get(command.nodeId);
    if (!node) return;
    this.applyProperty(node, command.propertyId, command.value);
  }

  private applyProperty(node: HTMLNode, propertyId: number, value: PropertyValue): void {
    switch (propertyId) {
      case TextProperty.TEXT:
        if (value.type === 'string') {
          node.textContent = value.value;
        }
        break;

      case StyleProperty.BACKGROUND_COLOR:
        if (value.type === 'u32' || (value.type === 'color' && value.kind === 'literal')) {
          const rgba = value.type === 'u32' ? value.value : value.rgba;
          node.styles.backgroundColor = rgbaToCss(rgba);
        }
        break;

      case StyleProperty.COLOR:
        if (value.type === 'u32' || (value.type === 'color' && value.kind === 'literal')) {
          const rgba = value.type === 'u32' ? value.value : value.rgba;
          node.styles.color = rgbaToCss(rgba);
        }
        break;

      case StyleProperty.FONT_SIZE:
        if (value.type === 'f32') {
          node.styles.fontSize = `${value.value}px`;
        }
        break;

      case StyleProperty.FONT_WEIGHT:
        if (value.type === 'u8' || value.type === 'u32') {
          node.styles.fontWeight = String(value.value);
        }
        break;

      case StyleProperty.WIDTH:
        if (value.type === 'f32') {
          if (value.value === FILL) {
            node.styles.width = '100%';
          } else if (value.value === HUG_CONTENT) {
            node.styles.width = 'fit-content';
          } else {
            node.styles.width = `${value.value}px`;
          }
        }
        break;

      case StyleProperty.HEIGHT:
        if (value.type === 'f32') {
          if (value.value === FILL) {
            node.styles.height = '100%';
          } else if (value.value === HUG_CONTENT) {
            node.styles.height = 'fit-content';
          } else {
            node.styles.height = `${value.value}px`;
          }
        }
        break;

      case StyleProperty.OPACITY:
        if (value.type === 'f32') {
          node.styles.opacity = String(value.value);
        }
        break;

      case StyleProperty.VISIBLE:
        if (value.type === 'u8') {
          node.styles.display = value.value ? '' : 'none';
        }
        break;

      case StyleProperty.PADDING:
        if (value.type === 'f32') {
          node.styles.padding = `${value.value}px`;
        }
        break;

      case StackProperty.SPACING:
        if (value.type === 'f32') {
          node.styles.gap = `${value.value}px`;
        }
        break;

      case StackProperty.ALIGNMENT:
        if (value.type === 'enum') {
          node.styles.alignItems = enumToAlignItems(value.value);
        }
        break;

      case StackProperty.JUSTIFICATION:
        if (value.type === 'enum') {
          node.styles.justifyContent = enumToJustifyContent(value.value);
        }
        break;

      case StyleProperty.BORDER_RADIUS:
        if (value.type === 'f32') {
          node.styles.borderRadius = `${value.value}px`;
        }
        break;
    }
  }

  /**
   * Render the current state to HTML string.
   */
  render(): string {
    return this.renderNode(this.root.id);
  }

  /**
   * Render a specific node to HTML string.
   */
  renderNode(nodeId: number): string {
    const node = this.nodes.get(nodeId);
    if (!node) return '';
    return this.renderNodeInternal(node);
  }

  private renderNodeInternal(node: HTMLNode): string {
    const childrenHtml = node.children.map(c => this.renderNodeInternal(c)).join('');
    const textContent = node.textContent || '';
    const content = childrenHtml || textContent;

    const styleString = Object.entries(node.styles)
      .map(([key, value]) => `${kebabCase(key)}:${value}`)
      .join(';');

    const styleAttr = styleString ? ` style="${styleString}"` : '';
    const idAttr = node.id ? ` data-pathland-id="${node.id}"` : '';
    const componentAttr = ` data-pathland-component="${node.componentType}"`;

    // Self-closing tags
    if (['img', 'input'].includes(node.tag)) {
      return `<${node.tag}${styleAttr}${idAttr}${componentAttr}>`;
    }

    // Void elements
    if (content) {
      return `<${node.tag}${styleAttr}${idAttr}${componentAttr}>${content}</${node.tag}>`;
    }

    return `<${node.tag}${styleAttr}${idAttr}${componentAttr}></${node.tag}>`;
  }

  /**
   * Render only the children of a node.
   */
  renderChildren(nodeId: number): string {
    const node = this.nodes.get(nodeId);
    if (!node) return '';
    return node.children.map(c => this.renderNodeInternal(c)).join('');
  }

  /**
   * Get the HTML for the root node.
   */
  getHTML(): string {
    return this.render();
  }

  /**
   * Clear all nodes except root.
   */
  clear(): void {
    this.nodes.clear();
    this.root = {
      tag: 'div',
      id: 0,
      componentType: 0,
      attributes: {},
      styles: {},
      textContent: null,
      children: [],
    };
    this.nodes.set(0, this.root);
  }

  /**
   * Get the node count.
   */
  getNodeCount(): number {
    return this.nodes.size;
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

function kebabCase(str: string): string {
  return str.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
}

export { HTMLRenderer as default };
