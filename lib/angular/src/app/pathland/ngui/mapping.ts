import { COMPONENT, PROPERTY, SIZE, BORDER_EDGE, ALIGNMENT, FONT_WEIGHT } from '../core/protocol';
import { PathlandNode } from '../core/retained-tree';
import {
  BackgroundOptions, BorderArea, BorderOptions, FlexOptions, FontOptions, FrameOptions,
  NguiAlignment, NguiStackAlignment, NguiTextAlignment, PaddingArea, PaddingOptions, RoundingOptions,
} from './ngui-options';

/**
 * Pathland → ngui mapping. The renderer is a pure function of the opcode stream:
 * this module decodes the retained node's constraint/style properties into the
 * `@apaq/ngui-elements` view + modifier inputs (design-token driven).
 */

export type NodeKind =
  | 'hstack'
  | 'vstack'
  | 'zstack'
  | 'text'
  | 'button'
  | 'image'
  | 'switch'
  | 'textField'
  | 'spacer'
  | 'scrollView'
  | 'list'
  | 'grid'
  | 'comment'
  | 'checkbox'
  | 'slider'
  | 'unknown';

export function kindOf(node: PathlandNode): NodeKind {
  switch (node.component) {
    case COMPONENT.HSTACK: return 'hstack';
    case COMPONENT.VSTACK: return 'vstack';
    case COMPONENT.TEXT: return 'text';
    case COMPONENT.BUTTON: return 'button';
    case COMPONENT.IMAGE: return 'image';
    case COMPONENT.SWITCH: return 'switch';
    case COMPONENT.TEXT_FIELD: return 'textField';
    case COMPONENT.SPACER: return 'spacer';
    case COMPONENT.SCROLLVIEW: return 'scrollView';
    case COMPONENT.LIST: return 'list';
    case COMPONENT.GRID: return 'grid';
    case COMPONENT.COMMENT: return 'comment';
    case COMPONENT.CHECKBOX: return 'checkbox';
    case COMPONENT.SLIDER: return 'slider';
    default: return 'unknown';
  }
}

/** ngui modifier inputs decoded from a node's properties (see `@apaq/ngui-elements/core`). */
export interface NguiMods {
  padding?: PaddingOptions;
  color?: string;
  background?: BackgroundOptions;
  border?: BorderOptions;
  rounding?: RoundingOptions;
  opacity?: number;
  font?: FontOptions;
  frame?: FrameOptions;
  flex?: FlexOptions;
  lineLimit?: number;
}

/** Decode all modifier properties into ngui inputs (reads the node's signals). */
export function buildMods(node: PathlandNode): NguiMods {
  const mods: NguiMods = {};

  const padding = buildPadding(node);
  if (padding) {
    mods.padding = { paddingAreas: padding };
  }
  const color = node.color(PROPERTY.COLOR);
  if (color !== undefined) {
    mods.color = argbToRgba(color);
  }
  const background = node.color(PROPERTY.BACKGROUND_COLOR);
  if (background !== undefined) {
    mods.background = { color: argbToRgba(background) };
  }
  const border = buildBorder(node);
  if (border) {
    mods.border = border;
  }
  const radius = node.f32(PROPERTY.BORDER_RADIUS);
  if (radius !== undefined && radius > 0) {
    mods.rounding = { radius };
  }
  const opacity = node.f32(PROPERTY.OPACITY);
  if (opacity !== undefined) {
    mods.opacity = opacity;
  }
  const font = buildFont(node);
  if (font.size || font.weight || font.family) {
    mods.font = font;
  }
  const frame = buildFrame(node);
  if (frame) {
    mods.frame = frame;
  }
  const flex = buildFlex(node);
  if (flex) {
    mods.flex = flex;
  }
  const lineLimit = node.f32(PROPERTY.LINE_LIMIT);
  if (lineLimit !== undefined) {
    mods.lineLimit = lineLimit;
  }
  return mods;
}

/** Stack spacing → ngui `[gap]` (px). */
export function stackGap(node: PathlandNode): number | undefined {
  return node.f32(PROPERTY.SPACING);
}

/** Stack cross-axis alignment → ngui `[alignment]` (ui-hstack / ui-vstack). */
export function stackAlignment(node: PathlandNode): NguiStackAlignment | undefined {
  const wire = node.f32(PROPERTY.ALIGNMENT);
  return wire === undefined ? undefined : nguiStackAlignment(wire);
}

/** Overlap alignment → ngui `[alignment]` (ui-zstack, broad `Alignment`). */
export function zstackAlignment(node: PathlandNode): NguiAlignment | undefined {
  const wire = node.f32(PROPERTY.ALIGNMENT);
  if (wire === undefined) {
    return undefined;
  }
  switch (Math.round(wire)) {
    case ALIGNMENT.LEADING: return 'leading';
    case ALIGNMENT.TRAILING: return 'trailing';
    default: return 'center';
  }
}

/** Text alignment → ngui `[multilineTextAlignment]`. */
export function textAlignment(node: PathlandNode): NguiTextAlignment | undefined {
  const wire = node.f32(PROPERTY.TEXT_ALIGNMENT);
  return wire === undefined ? undefined : nguiTextAlignment(wire);
}

/** Checked state (SELECTED) for toggles/checkboxes. */
export function checked(node: PathlandNode): boolean {
  const bits = node.props().get(PROPERTY.SELECTED);
  return bits !== undefined && bits !== 0;
}

/** Whether the node should be hidden (`VISIBLE = 0`). */
export function hidden(node: PathlandNode): boolean {
  const visible = node.f32(PROPERTY.VISIBLE);
  return visible !== undefined && visible === 0;
}

/** A slider's numeric range (VALUE/MIN_VALUE/MAX_VALUE, defaults 0/0/1). */
export function slider(node: PathlandNode): { value: number; min: number; max: number } {
  const min = node.f32(PROPERTY.MIN_VALUE) ?? 0;
  const max = node.f32(PROPERTY.MAX_VALUE) ?? 1;
  const value = node.f32(PROPERTY.VALUE) ?? min;
  return { value, min, max };
}

function buildPadding(node: PathlandNode): PaddingArea[] | undefined {
  const uniform = node.f32(PROPERTY.PADDING);
  const top = node.f32(PROPERTY.PADDING_TOP);
  const right = node.f32(PROPERTY.PADDING_RIGHT);
  const bottom = node.f32(PROPERTY.PADDING_BOTTOM);
  const left = node.f32(PROPERTY.PADDING_LEFT);
  if (uniform === undefined && top === undefined && right === undefined
      && bottom === undefined && left === undefined) {
    return undefined;
  }
  const areas: PaddingArea[] = [];
  if (uniform !== undefined && top === undefined && right === undefined
      && bottom === undefined && left === undefined) {
    areas.push({ edge: 'All', gap: uniform });
    return areas;
  }
  const pushEdge = (edge: PaddingArea['edge'], value: number | undefined) => {
    const gap = value ?? uniform;
    if (gap !== undefined) {
      areas.push({ edge, gap });
    }
  };
  pushEdge('Top', top);
  pushEdge('Trailing', right);
  pushEdge('Bottom', bottom);
  pushEdge('Leading', left);
  return areas;
}

function buildBorder(node: PathlandNode): BorderOptions | undefined {
  const width = node.f32(PROPERTY.BORDER_WIDTH);
  if (width === undefined) {
    return undefined;
  }
  const edgesBits = node.props().get(PROPERTY.BORDER_EDGES) ?? BORDER_EDGE.ALL;
  const colorBits = node.color(PROPERTY.BORDER_COLOR);
  const borderAreas: BorderArea[] = [];
  if (edgesBits === BORDER_EDGE.ALL) {
    borderAreas.push({ side: 'All', width });
  } else {
    if (edgesBits & BORDER_EDGE.TOP) borderAreas.push({ side: 'Top', width });
    if (edgesBits & BORDER_EDGE.BOTTOM) borderAreas.push({ side: 'Bottom', width });
    if (edgesBits & BORDER_EDGE.LEADING) borderAreas.push({ side: 'Left', width });
    if (edgesBits & BORDER_EDGE.TRAILING) borderAreas.push({ side: 'Right', width });
  }
  return {
    borderAreas,
    ...(colorBits !== undefined ? { color: argbToRgba(colorBits) } : {}),
  };
}

function buildFont(node: PathlandNode): { size?: string; weight?: string; family?: string } {
  const font: { size?: string; weight?: string; family?: string } = {};
  const size = node.f32(PROPERTY.FONT_SIZE);
  if (size !== undefined) {
    font.size = `${size}px`;
  }
  const weight = node.f32(PROPERTY.FONT_WEIGHT);
  if (weight !== undefined) {
    font.weight = cssFontWeight(weight);
  }
  const family = node.strings().get(PROPERTY.FONT_FAMILY);
  if (family) {
    font.family = family;
  }
  return font;
}

function buildFrame(node: PathlandNode): FrameOptions | undefined {
  const width = node.f32(PROPERTY.WIDTH);
  const height = node.f32(PROPERTY.HEIGHT);
  const frame: { width?: string; height?: string } = {};
  if (width !== undefined && width > 0) {
    frame.width = `${width}px`;
  }
  if (height !== undefined && height > 0) {
    frame.height = `${height}px`;
  }
  return frame.width || frame.height ? frame : undefined;
}

function buildFlex(node: PathlandNode): FlexOptions | undefined {
  const width = node.f32(PROPERTY.WIDTH);
  const height = node.f32(PROPERTY.HEIGHT);
  if (width === SIZE.FILL) {
    return { grow: 1 };
  }
  if (height === SIZE.FILL) {
    return { grow: 1, basis: '100%' };
  }
  return undefined;
}

/** Protocol `Alignment` wire value → ngui stack alignment string. */
function nguiStackAlignment(wire: number): NguiStackAlignment {
  switch (Math.round(wire)) {
    case ALIGNMENT.LEADING: return 'leading';
    case ALIGNMENT.TRAILING: return 'trailing';
    case ALIGNMENT.FILL: return 'stretch';
    default: return 'center';
  }
}

/** Protocol `TextAlignment` wire value → ngui text alignment string. */
function nguiTextAlignment(wire: number): NguiTextAlignment {
  switch (Math.round(wire)) {
    case ALIGNMENT.LEADING: return 'leading';
    case ALIGNMENT.TRAILING: return 'trailing';
    default: return 'center';
  }
}

/** Protocol `FontWeight` wire value → CSS font-weight. */
function cssFontWeight(wire: number): string {
  switch (Math.round(wire)) {
    case FONT_WEIGHT.LIGHT: return '300';
    case FONT_WEIGHT.MEDIUM: return '500';
    case FONT_WEIGHT.SEMIBOLD: return '600';
    case FONT_WEIGHT.BOLD: return 'bold';
    default: return 'normal';
  }
}

/** Format `0xAARRGGBB` as a CSS `rgba(...)` string (alpha in `0..1`). */
export function argbToRgba(argb: number): string {
  const a = (argb >>> 24) & 0xff;
  const r = (argb >>> 16) & 0xff;
  const g = (argb >>> 8) & 0xff;
  const b = argb & 0xff;
  const alpha = (a / 255).toFixed(3);
  return `rgba(${r},${g},${b},${alpha})`;
}