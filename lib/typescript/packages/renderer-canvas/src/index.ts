/**
 * @pathland/renderer-canvas
 *
 * Canvas 2D renderer for the Pathland protocol.
 *
 * Implements the same Renderer contract as @pathland/renderer-dom but draws to
 * a <canvas> 2D context, proving the protocol is surface-agnostic. Layout is
 * computed by an internal engine (renderer-dom delegates to CSS flexbox; the
 * canvas renderer must measure and arrange itself).
 */

import {
  ComponentType,
  StyleProperty,
  TextProperty,
  StackProperty,
  EventType,
  SemanticColorToken,
  FILL,
  HUG_CONTENT,
} from '@pathland/protocol';
import type { Command, PropertyValue, EventData } from '@pathland/protocol';
import type { Renderer, PointerInput } from '@pathland/renderer';
import { PointerInteraction } from '@pathland/renderer';
import { layoutTree, hitTest } from './layout';
import type { LayoutNode, Rect } from './layout';

export interface CanvasRendererConfig {
  /** The canvas element to render into and attach input listeners to. */
  canvas?: HTMLCanvasElement;
  /** A 2D context (injected for testing/embedding; else canvas.getContext('2d')). */
  context?: CanvasRenderingContext2D;
  /** Viewport size in logical points. Defaults to canvas size or 300x150. */
  width?: number;
  height?: number;
}

// Default resolution of semantic color tokens (renderer-owned theme).
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

function resolveColor(value: PropertyValue | undefined): number | null {
  if (!value) return null;
  if (value.type === 'color' && value.kind === 'literal') return value.rgba;
  if (value.type === 'color' && value.kind === 'semantic') {
    return DEFAULT_SEMANTIC_COLORS[value.tokenId] ?? null;
  }
  if (value.type === 'u32') return value.value;
  return null;
}

function rgbaToStyle(rgba: number): string {
  const r = (rgba >>> 24) & 0xFF;
  const g = (rgba >>> 16) & 0xFF;
  const b = (rgba >>> 8) & 0xFF;
  const a = (rgba & 0xFF) / 255;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function numProp(node: LayoutNode, id: number): number | undefined {
  const v = node.properties.get(id);
  if (!v) return undefined;
  switch (v.type) {
    case 'f32':
    case 'u8':
    case 'u32':
    case 'i32':
    case 'enum':
      return v.value;
    default:
      return undefined;
  }
}

function strProp(node: LayoutNode, id: number): string | undefined {
  const v = node.properties.get(id);
  return v?.type === 'string' ? v.value : undefined;
}

function modifiersOf(event: { shiftKey?: boolean; ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean }): number {
  return (
    (event.shiftKey ? 0x01 : 0) |
    (event.ctrlKey ? 0x02 : 0) |
    (event.altKey ? 0x04 : 0) |
    (event.metaKey ? 0x08 : 0)
  );
}

function roundRectPath(ctx: CanvasRenderingContext2D, r: Rect, radius: number): void {
  const x = r.x;
  const y = r.y;
  const w = r.width;
  const h = r.height;
  const rad = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

/**
 * A Canvas 2D renderer. Maintains only the rendered-output tree (id -> node
 * with computed layout) for drawing and input routing.
 */
export class CanvasRenderer implements Renderer {
  private root: LayoutNode;
  private elements: Map<number, LayoutNode> = new Map();
  private context: CanvasRenderingContext2D;
  private canvas?: HTMLCanvasElement;
  private width: number;
  private height: number;
  private dpr: number = 1;
  private attachedGestures: Map<number, Set<number>> = new Map();
  private dispatchEvent: (nodeId: number, eventType: number, data?: EventData) => void = () => {};
  private dispatchGesture: (nodeId: number, gestureType: number, gestureState: number, data?: EventData) => void = () => {};
  private interaction: PointerInteraction | null = null;
  private focusedNodeId: number | null = null;

  constructor(config: CanvasRendererConfig = {}) {
    this.canvas = config.canvas;
    this.context = config.context ?? (config.canvas ? config.canvas.getContext('2d')! : (undefined as unknown as CanvasRenderingContext2D));
    this.width = config.width ?? (config.canvas ? config.canvas.clientWidth : 300);
    this.height = config.height ?? (config.canvas ? config.canvas.clientHeight : 150);
    this.dpr = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1;

    this.root = {
      id: 0,
      componentType: 0,
      properties: new Map(),
      children: [],
      layout: { x: 0, y: 0, width: this.width, height: this.height },
    };
    this.elements.set(0, this.root);

    if (this.canvas) {
      this.canvas.width = Math.round(this.width * this.dpr);
      this.canvas.height = Math.round(this.height * this.dpr);
      this.canvas.tabIndex = 0;
    }
  }

  executeCommands(commands: Command[]): void {
    let mutated = false;
    for (const command of commands) {
      switch (command.opcode) {
        case 'CREATE_NODE': this.createNode(command); mutated = true; break;
        case 'DELETE_NODE': this.deleteNode(command); mutated = true; break;
        case 'INSERT_CHILD': this.insertChild(command); mutated = true; break;
        case 'REMOVE_CHILD': this.removeChild(command); mutated = true; break;
        case 'MOVE_CHILD': this.moveChild(command); mutated = true; break;
        case 'SET_PROPERTY': this.setProperty(command); mutated = true; break;
        case 'RESET': this.reset(); mutated = true; break;
        case 'ATTACH_GESTURE': this.attachGesture(command); break;
        default: break;
      }
    }
    if (mutated) this.relayoutAndDraw();
  }

  setupEvents(dispatchEvent: (nodeId: number, eventType: number, data?: EventData) => void): void {
    this.dispatchEvent = dispatchEvent;
    this.wireInteraction();
  }

  setupGestures(dispatchGesture: (nodeId: number, gestureType: number, gestureState: number, data?: EventData) => void): void {
    this.dispatchGesture = dispatchGesture;
    this.wireInteraction();
  }

  /** Feed a normalized pointer input (used by tests and the canvas adapters). */
  handlePointerInput(input: PointerInput): void {
    this.interaction?.handle(input);
  }

  /** Hit-test a point in logical points. */
  hitTest(x: number, y: number): LayoutNode | null {
    return hitTest(this.root, x, y);
  }

  /** Get the computed layout of a node (testing/debugging). */
  getLayout(nodeId: number): Rect | undefined {
    return this.elements.get(nodeId)?.layout;
  }

  getNode(nodeId: number): LayoutNode | undefined {
    return this.elements.get(nodeId);
  }

  // ---- command execution ----

  private createNode(command: Extract<Command, { opcode: 'CREATE_NODE' }>): void {
    if (this.elements.has(command.nodeId)) return;
    const node: LayoutNode = {
      id: command.nodeId,
      componentType: command.componentType,
      properties: new Map(command.properties),
      children: [],
      layout: { x: 0, y: 0, width: 0, height: 0 },
    };
    this.elements.set(command.nodeId, node);
  }

  private deleteNode(command: Extract<Command, { opcode: 'DELETE_NODE' }>): void {
    const node = this.elements.get(command.nodeId);
    if (!node) return;
    this.removeFromParent(node);
    this.elements.delete(command.nodeId);
  }

  private removeFromParent(node: LayoutNode): void {
    const parent = node.parent;
    if (parent) {
      const idx = parent.children.indexOf(node);
      if (idx !== -1) parent.children.splice(idx, 1);
      node.parent = undefined;
    }
  }

  private insertChild(command: Extract<Command, { opcode: 'INSERT_CHILD' }>): void {
    const parent = this.elements.get(command.parentId);
    const child = this.elements.get(command.childId);
    if (!parent || !child) return;
    this.removeFromParent(child);
    const index = command.index === 0xffffffff ? parent.children.length : Math.min(command.index, parent.children.length);
    parent.children.splice(index, 0, child);
    child.parent = parent;
  }

  private removeChild(command: Extract<Command, { opcode: 'REMOVE_CHILD' }>): void {
    const parent = this.elements.get(command.parentId);
    const child = this.elements.get(command.childId);
    if (!parent || !child) return;
    this.removeFromParent(child);
  }

  private moveChild(command: Extract<Command, { opcode: 'MOVE_CHILD' }>): void {
    const parent = this.elements.get(command.parentId);
    const child = this.elements.get(command.childId);
    if (!parent || !child || child.parent !== parent) return;
    this.removeFromParent(child);
    const index = command.index === 0xffffffff ? parent.children.length : Math.min(command.index, parent.children.length);
    parent.children.splice(index, 0, child);
    child.parent = parent;
  }

  private setProperty(command: Extract<Command, { opcode: 'SET_PROPERTY' }>): void {
    const node = this.elements.get(command.nodeId);
    if (!node) return;
    node.properties.set(command.propertyId, command.value);
  }

  private reset(): void {
    for (const [id] of this.elements) {
      if (id !== 0) this.elements.delete(id);
    }
    this.root.children = [];
    this.elements.set(0, this.root);
    this.attachedGestures.clear();
  }

  private attachGesture(command: Extract<Command, { opcode: 'ATTACH_GESTURE' }>): void {
    let set = this.attachedGestures.get(command.nodeId);
    if (!set) {
      set = new Set<number>();
      this.attachedGestures.set(command.nodeId, set);
    }
    set.add(command.gestureType);
  }

  // ---- layout + draw ----

  private relayoutAndDraw(): void {
    layoutTree(this.root, this.measureText, { width: this.width, height: this.height });
    this.draw();
  }

  private measureText: (text: string, fontSize: number, fontWeight: number, fontFamily: string) => { width: number; height: number } = (
    text,
    fontSize,
    fontWeight,
    fontFamily
  ) => {
    const ctx = this.context;
    ctx.save();
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    const width = ctx.measureText(text).width;
    ctx.restore();
    return { width, height: Math.ceil(fontSize * 1.2) };
  };

  private draw(): void {
    const ctx = this.context;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    ctx.clearRect(0, 0, this.width, this.height);
    this.drawNode(this.root);
    ctx.restore();
  }

  private drawNode(node: LayoutNode): void {
    if (numProp(node, StyleProperty.VISIBLE) === 0) return;

    const ctx = this.context;
    const r = node.layout;
    const opacity = numProp(node, StyleProperty.OPACITY) ?? 1;

    ctx.save();
    if (opacity < 1) ctx.globalAlpha = opacity;

    const radius = numProp(node, StyleProperty.BORDER_RADIUS) ?? 0;

    // Background
    const bg = resolveColor(node.properties.get(StyleProperty.BACKGROUND_COLOR));
    if (bg !== null) {
      ctx.fillStyle = rgbaToStyle(bg);
      if (radius > 0) {
        roundRectPath(ctx, r, radius);
        ctx.fill();
      } else {
        ctx.fillRect(r.x, r.y, r.width, r.height);
      }
    }

    // Border
    const borderWidth = numProp(node, StyleProperty.BORDER_WIDTH) ?? 0;
    if (borderWidth > 0) {
      const borderColor = resolveColor(node.properties.get(StyleProperty.BORDER_COLOR)) ?? 0xFF000000;
      ctx.strokeStyle = rgbaToStyle(borderColor);
      ctx.lineWidth = borderWidth;
      roundRectPath(ctx, r, radius);
      ctx.stroke();
    }

    // Text
    if (node.componentType === ComponentType.TEXT) {
      const text = strProp(node, TextProperty.TEXT) ?? '';
      if (text.length > 0) {
        const fontSize = numProp(node, StyleProperty.FONT_SIZE) ?? 14;
        const fontWeight = numProp(node, StyleProperty.FONT_WEIGHT) ?? 400;
        const fontFamily = strProp(node, StyleProperty.FONT_FAMILY) ?? 'sans-serif';
        const color = resolveColor(node.properties.get(StyleProperty.COLOR)) ?? DEFAULT_SEMANTIC_COLORS[SemanticColorToken.PRIMARY_TEXT];
        const alignment = numProp(node, TextProperty.TEXT_ALIGNMENT) ?? 0;

        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        ctx.fillStyle = rgbaToStyle(color);
        ctx.textBaseline = 'top';
        ctx.textAlign = alignment === 1 ? 'center' : alignment === 2 ? 'right' : 'left';
        const tx = alignment === 1 ? r.x + r.width / 2 : alignment === 2 ? r.x + r.width : r.x;
        ctx.fillText(text, tx, r.y);
      }
    }

    // Children (drawn in z-index order)
    const children = [...node.children].sort(
      (a, b) => (numProp(b, StyleProperty.Z_INDEX) ?? 0) - (numProp(a, StyleProperty.Z_INDEX) ?? 0)
    );
    for (const child of children) {
      this.drawNode(child);
    }

    ctx.restore();
  }

  // ---- interaction ----

  private wireInteraction(): void {
    if (this.interaction) return;

    this.interaction = new PointerInteraction({
      hitTest: (input) => hitTest(this.root, input.x, input.y)?.id ?? null,
      attachedGestures: (nodeId) => this.attachedGestures.get(nodeId),
      onGesture: (nodeId, gestureType, gestureState, data) =>
        this.dispatchGesture(nodeId, gestureType, gestureState, data),
      onClick: (nodeId, data) => this.dispatchEvent(nodeId, EventType.CLICK, data),
      onHover: (nodeId, isHovering, data) =>
        this.dispatchEvent(nodeId, EventType.HOVER, { ...data, isHovering }),
    });

    if (!this.canvas) return;
    const canvas = this.canvas;
    const toInput = (type: PointerInput['type'], e: MouseEvent): PointerInput => ({
      type,
      x: e.offsetX,
      y: e.offsetY,
      timestamp: e.timeStamp,
    });

    canvas.addEventListener('mousedown', (e: MouseEvent) => {
      this.focusedNodeId = hitTest(this.root, e.offsetX, e.offsetY)?.id ?? null;
      this.handlePointerInput(toInput('down', e));
    });
    canvas.addEventListener('mousemove', (e: MouseEvent) => this.handlePointerInput(toInput('move', e)));
    canvas.addEventListener('mouseup', (e: MouseEvent) => this.handlePointerInput(toInput('up', e)));
    canvas.addEventListener('mouseleave', () => this.handlePointerInput({ type: 'cancel', x: 0, y: 0, timestamp: 0 }));
    canvas.addEventListener('focus', () => {
      if (this.focusedNodeId !== null) this.dispatchEvent(this.focusedNodeId, EventType.FOCUS, { isFocused: true });
    });
    canvas.addEventListener('blur', () => {
      if (this.focusedNodeId !== null) this.dispatchEvent(this.focusedNodeId, EventType.BLUR, { isFocused: false });
    });
    canvas.addEventListener('keydown', (e: KeyboardEvent) => {
      if (this.focusedNodeId !== null) {
        this.dispatchEvent(this.focusedNodeId, EventType.KEY_DOWN, {
          keyCode: e.keyCode || 0,
          modifiers: modifiersOf(e),
          repeat: e.repeat,
        });
      }
    });
    canvas.addEventListener('keyup', (e: KeyboardEvent) => {
      if (this.focusedNodeId !== null) {
        this.dispatchEvent(this.focusedNodeId, EventType.KEY_UP, {
          keyCode: e.keyCode || 0,
          modifiers: modifiersOf(e),
        });
      }
    });
  }
}

export { FILL, HUG_CONTENT };
export default CanvasRenderer;
