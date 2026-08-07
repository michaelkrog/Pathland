/**
 * @pathland/renderer-canvas - Layout
 *
 * A minimal retained layout engine for the Pathland component model:
 * HSTACK / VSTACK (spacing, alignment, justification, padding), SPACER
 * (fills leftover main-axis space), TEXT (measured via an injected text
 * measurer), explicit sizes including FILL (-1) and HUG_CONTENT (-2).
 *
 * The layout is recomputed over the whole tree after each command batch.
 */

import {
  ComponentType,
  StackProperty,
  StyleProperty,
  TextProperty,
  Alignment,
  Justification,
  FILL,
  HUG_CONTENT,
} from '@pathland/protocol';
import type { PropertyValue } from '@pathland/protocol';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface LayoutNode {
  id: number;
  componentType: number;
  properties: Map<number, PropertyValue>;
  children: LayoutNode[];
  layout: Rect;
  parent?: LayoutNode;
}

/** Measures a line of text in logical points. */
export type TextMeasurer = (
  text: string,
  fontSize: number,
  fontWeight: number,
  fontFamily: string
) => Size;

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

interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

function getPadding(node: LayoutNode): Padding {
  const top = numProp(node, StyleProperty.PADDING_TOP) ?? 0;
  const right = numProp(node, StyleProperty.PADDING_RIGHT) ?? 0;
  const bottom = numProp(node, StyleProperty.PADDING_BOTTOM) ?? 0;
  const left = numProp(node, StyleProperty.PADDING_LEFT) ?? 0;
  if (top || right || bottom || left) return { top, right, bottom, left };
  const uniform = numProp(node, StackProperty.PADDING) ?? numProp(node, StyleProperty.PADDING) ?? 0;
  return { top: uniform, right: uniform, bottom: uniform, left: uniform };
}

function resolveSize(intrinsic: number, explicit: number | undefined, available: number): number {
  if (explicit === undefined) return intrinsic;
  if (explicit === FILL) return available;
  if (explicit === HUG_CONTENT) return intrinsic;
  return explicit;
}

function isSpacer(node: LayoutNode): boolean {
  return node.componentType === ComponentType.SPACER;
}

/** Compute a node's intrinsic (hug-content) size, caching on the node. */
export function computeIntrinsic(node: LayoutNode, measureText: TextMeasurer): Size {
  const cached = (node as any).__intrinsic as Size | undefined;
  if (cached) return cached;

  let size: Size;
  switch (node.componentType) {
    case ComponentType.TEXT: {
      const text = strProp(node, TextProperty.TEXT) ?? '';
      const fontSize = numProp(node, StyleProperty.FONT_SIZE) ?? 14;
      const fontWeight = numProp(node, StyleProperty.FONT_WEIGHT) ?? 400;
      const fontFamily = strProp(node, StyleProperty.FONT_FAMILY) ?? 'sans-serif';
      size = measureText(text, fontSize, fontWeight, fontFamily);
      break;
    }
    case ComponentType.HSTACK:
    case ComponentType.VSTACK:
    case ComponentType.BUTTON: {
      const isRow = node.componentType === ComponentType.HSTACK;
      const padding = getPadding(node);
      const spacing = numProp(node, StackProperty.SPACING) ?? 0;
      let main = 0;
      let cross = 0;
      for (const child of node.children) {
        const s = computeIntrinsic(child, measureText);
        if (isRow) {
          const fills = numProp(child, StyleProperty.WIDTH) === FILL;
          main += fills ? 0 : s.width;
          cross = Math.max(cross, s.height);
        } else {
          const fills = numProp(child, StyleProperty.HEIGHT) === FILL;
          main += fills ? 0 : s.height;
          cross = Math.max(cross, s.width);
        }
      }
      const count = Math.max(node.children.length - 1, 0);
      main += spacing * count;
      const padMain = isRow ? padding.left + padding.right : padding.top + padding.bottom;
      const padCross = isRow ? padding.top + padding.bottom : padding.left + padding.right;
      size = {
        width: (isRow ? main : cross) + padMain,
        height: (isRow ? cross : main) + padCross,
      };
      break;
    }
    default:
      size = { width: 0, height: 0 };
  }

  (node as any).__intrinsic = size;
  return size;
}

function arrangeStack(
  node: LayoutNode,
  x: number,
  y: number,
  width: number,
  height: number,
  measureText: TextMeasurer
): void {
  const isRow = node.componentType === ComponentType.HSTACK;
  const padding = getPadding(node);
  const spacing = numProp(node, StackProperty.SPACING) ?? 0;
  const alignment = numProp(node, StackProperty.ALIGNMENT) ?? Alignment.START;
  const justification = numProp(node, StackProperty.JUSTIFICATION) ?? Justification.START;

  const innerX = x + padding.left;
  const innerY = y + padding.top;
  const innerW = Math.max(0, width - padding.left - padding.right);
  const innerH = Math.max(0, height - padding.top - padding.bottom);

  const children = node.children;
  const hasSpacer = children.some(isSpacer);

  let childrenMain = 0;
  for (const child of children) {
    const s = computeIntrinsic(child, measureText);
    const main = isRow ? s.width : s.height;
    const fills = isRow
      ? numProp(child, StyleProperty.WIDTH) === FILL
      : numProp(child, StyleProperty.HEIGHT) === FILL;
    childrenMain += fills ? 0 : main;
  }
  childrenMain += spacing * Math.max(children.length - 1, 0);

  const availableMain = isRow ? innerW : innerH;
  const extra = Math.max(0, availableMain - childrenMain);
  const count = Math.max(children.length, 1);

  let gap = spacing;
  let offset = isRow ? innerX : innerY;
  if (!hasSpacer && extra > 0) {
    switch (justification) {
      case Justification.CENTER:
        offset += extra / 2;
        break;
      case Justification.END:
        offset += extra;
        break;
      case Justification.SPACE_BETWEEN:
        gap = children.length > 1 ? spacing + extra / (children.length - 1) : spacing;
        break;
      case Justification.SPACE_AROUND:
        gap = spacing + extra / count;
        offset += extra / (2 * count);
        break;
      case Justification.SPACE_EVENLY:
        gap = spacing + extra / (count + 1);
        offset += extra / (count + 1);
        break;
      default:
        break;
    }
  }

  let spacerShare = 0;
  if (hasSpacer) {
    const spacers = children.filter(isSpacer).length;
    spacerShare = spacers > 0 ? extra / spacers : 0;
  }

  for (const child of children) {
    const s = computeIntrinsic(child, measureText);
    const childMainExplicit = isRow ? numProp(child, StyleProperty.WIDTH) : numProp(child, StyleProperty.HEIGHT);
    const childCrossExplicit = isRow ? numProp(child, StyleProperty.HEIGHT) : numProp(child, StyleProperty.WIDTH);

    let childMain: number;
    if (isSpacer(child)) {
      childMain = spacerShare;
    } else {
      const intrinsicMain = isRow ? s.width : s.height;
      childMain = resolveSize(intrinsicMain, childMainExplicit, availableMain);
    }

    const availableCross = isRow ? innerH : innerW;
    const intrinsicCross = isRow ? s.height : s.width;
    let childCross: number;
    if (alignment === Alignment.STRETCH) {
      childCross = availableCross;
    } else {
      childCross = resolveSize(intrinsicCross, childCrossExplicit, availableCross);
    }

    let crossPos = isRow ? innerY : innerX;
    const crossExtra = availableCross - childCross;
    if (alignment === Alignment.CENTER) crossPos += crossExtra / 2;
    else if (alignment === Alignment.END) crossPos += crossExtra;

    const rect: Rect = isRow
      ? { x: offset, y: crossPos, width: childMain, height: childCross }
      : { x: crossPos, y: offset, width: childCross, height: childMain };
    child.layout = rect;

    arrangeNode(child, rect.x, rect.y, rect.width, rect.height, measureText);
    offset += childMain + gap;
  }
}

function arrangeNode(node: LayoutNode, x: number, y: number, width: number, height: number, measureText: TextMeasurer): void {
  switch (node.componentType) {
    case 0: // root container: arrange children as a vertical stack
    case ComponentType.HSTACK:
    case ComponentType.VSTACK:
    case ComponentType.BUTTON:
      arrangeStack(node, x, y, width, height, measureText);
      break;
    default:
      // Leaf nodes (TEXT, SPACER, placeholders) need no further arrangement.
      break;
  }
}

/**
 * Lay out the whole tree, computing a `layout` rect for every node.
 * The root node occupies the full viewport.
 */
export function layoutTree(root: LayoutNode, measureText: TextMeasurer, viewport: Size): void {
  (root as any).__intrinsic = undefined;
  clearCache(root);

  // The root container always occupies the full viewport.
  root.layout = { x: 0, y: 0, width: viewport.width, height: viewport.height };
  arrangeNode(root, 0, 0, viewport.width, viewport.height, measureText);
}

function clearCache(node: LayoutNode): void {
  delete (node as any).__intrinsic;
  for (const child of node.children) clearCache(child);
}

/** Find the deepest node whose layout rect contains the point (top-down). */
export function hitTest(node: LayoutNode, x: number, y: number): LayoutNode | null {
  if (node.layout === undefined) return null;
  const r = node.layout;
  if (x < r.x || x > r.x + r.width || y < r.y || y > r.y + r.height) return null;

  for (let i = node.children.length - 1; i >= 0; i--) {
    const hit = hitTest(node.children[i], x, y);
    if (hit) return hit;
  }
  return node;
}
