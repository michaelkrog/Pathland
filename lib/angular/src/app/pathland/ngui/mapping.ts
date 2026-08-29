import { COMPONENT, PROPERTY, SIZE, BORDER_EDGE, ALIGNMENT, FONT_WEIGHT, TOGGLE_STYLE, SHAPE_KIND } from '../core/protocol';
import { PathlandNode } from '../core/retained-tree';
import {
  BackgroundOptions, BorderArea, BorderOptions, FlexOptions, FontOptions, FrameOptions,
  NguiAlignment, NguiStackAlignment, NguiTextAlignment, PaddingArea, PaddingOptions, RoundingOptions,
  ShadowOptions,
} from './ngui-options';

/**
 * Pathland → ngui mapping. The renderer is a pure function of the opcode stream:
 * this module decodes the retained node's constraint/style properties into the
 * `@apaq/ngui-elements` view + modifier inputs (design-token driven).
 */

export type NodeKind =
  | 'hstack'
  | 'vstack'
  | 'lazyVStack'
  | 'lazyHStack'
  | 'zstack'
  | 'grid'
  | 'lazyVGrid'
  | 'lazyHGrid'
  | 'scrollView'
  | 'text'
  | 'button'
  | 'image'
  | 'color'
  | 'shape'
  | 'divider'
  | 'spacer'
  | 'textField'
  | 'textEditor'
  | 'toggle'
  | 'slider'
  | 'stepper'
  | 'picker'
  | 'menu'
  | 'colorPicker'
  | 'datePicker'
  | 'progressView'
  | 'gauge'
  | 'comment'
  | 'unknown';

export function kindOf(node: PathlandNode): NodeKind {
  switch (node.component) {
    case COMPONENT.VSTACK: return 'vstack';
    case COMPONENT.HSTACK: return 'hstack';
    case COMPONENT.LAZY_VSTACK: return 'lazyVStack';
    case COMPONENT.LAZY_HSTACK: return 'lazyHStack';
    case COMPONENT.ZSTACK: return 'zstack';
    case COMPONENT.GRID: return 'grid';
    case COMPONENT.LAZY_VGRID: return 'lazyVGrid';
    case COMPONENT.LAZY_HGRID: return 'lazyHGrid';
    case COMPONENT.SCROLLVIEW: return 'scrollView';
    case COMPONENT.TEXT: return 'text';
    case COMPONENT.BUTTON: return 'button';
    case COMPONENT.IMAGE: return 'image';
    case COMPONENT.COLOR: return 'color';
    case COMPONENT.SHAPE: return 'shape';
    case COMPONENT.DIVIDER: return 'divider';
    case COMPONENT.SPACER: return 'spacer';
    case COMPONENT.TEXT_FIELD: return 'textField';
    case COMPONENT.TEXT_EDITOR: return 'textEditor';
    case COMPONENT.TOGGLE: return 'toggle';
    case COMPONENT.SLIDER: return 'slider';
    case COMPONENT.STEPPER: return 'stepper';
    case COMPONENT.PICKER: return 'picker';
    case COMPONENT.MENU: return 'menu';
    case COMPONENT.COLOR_PICKER: return 'colorPicker';
    case COMPONENT.DATE_PICKER: return 'datePicker';
    case COMPONENT.PROGRESS_VIEW: return 'progressView';
    case COMPONENT.GAUGE: return 'gauge';
    case COMPONENT.COMMENT: return 'comment';
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
  shadow?: ShadowOptions;
  rotation?: number;
  underline?: boolean;
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
  if (font.size || font.weight || font.family || font.style || font.lineHeight) {
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
  const lineLimit = node.props().get(PROPERTY.LINE_LIMIT);
  if (lineLimit !== undefined) {
    mods.lineLimit = lineLimit;
  }
  const shadow = buildShadow(node);
  if (shadow) {
    mods.shadow = shadow;
  }
  const rotation = node.f32(PROPERTY.ROTATION_DEGREES);
  if (rotation !== undefined && rotation !== 0) {
    mods.rotation = rotation;
  }
  const underline = node.props().get(PROPERTY.UNDERLINE);
  if (underline !== undefined) {
    mods.underline = underline !== 0;
  }
  const filter = buildFilter(node);
  if (filter) {
    mods.background = { ...(mods.background ?? {}), filter };
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
  const bits = node.props().get(PROPERTY.VISIBLE);
  return bits !== undefined && bits === 0;
}

/** A toggle's visual variant (`TOGGLE_STYLE`): switch (default) / checkbox / button. */
export function toggleStyle(node: PathlandNode): 'switch' | 'checkbox' | 'button' {
  const wire = node.f32(PROPERTY.TOGGLE_STYLE);
  switch (wire === undefined ? TOGGLE_STYLE.SWITCH : Math.round(wire)) {
    case TOGGLE_STYLE.CHECKBOX: return 'checkbox';
    case TOGGLE_STYLE.BUTTON: return 'button';
    default: return 'switch';
  }
}

/** A slider's numeric range (VALUE/MIN_VALUE/MAX_VALUE) + optional STEP_VALUE. */
export function slider(node: PathlandNode): { value: number; min: number; max: number; step?: number } {
  const min = node.f32(PROPERTY.MIN_VALUE) ?? 0;
  const max = node.f32(PROPERTY.MAX_VALUE) ?? 1;
  const value = node.f32(PROPERTY.VALUE) ?? min;
  const step = node.f32(PROPERTY.STEP_VALUE);
  return step === undefined ? { value, min, max } : { value, min, max, step };
}

/** A stepper's numeric range + step (VALUE/MIN_VALUE/MAX_VALUE/STEP_VALUE). */
export function stepper(node: PathlandNode): { value: number; min: number; max: number; step: number } {
  const min = node.f32(PROPERTY.MIN_VALUE) ?? 0;
  const max = node.f32(PROPERTY.MAX_VALUE) ?? 10;
  const step = node.f32(PROPERTY.STEP_VALUE) ?? 1;
  const value = node.f32(PROPERTY.VALUE) ?? min;
  return { value, min, max, step };
}

/** A progress view's state (PROGRESS 0..1, or IS_INDETERMINATE). */
export function progress(node: PathlandNode): { indeterminate: boolean; value: number } {
  const indeterminate = (node.props().get(PROPERTY.IS_INDETERMINATE) ?? 0) !== 0;
  return { indeterminate, value: node.f32(PROPERTY.PROGRESS) ?? 0 };
}

/** A gauge's fill percentage (0..100) from VALUE/MIN_VALUE/MAX_VALUE. */
export function gaugePercent(node: PathlandNode): number {
  const min = node.f32(PROPERTY.MIN_VALUE) ?? 0;
  const max = node.f32(PROPERTY.MAX_VALUE) ?? 1;
  const value = node.f32(PROPERTY.VALUE) ?? min;
  const span = max - min;
  return span <= 0 ? 0 : ((value - min) / span) * 100;
}

/** The selected option index (SELECTION) of a picker. */
export function selection(node: PathlandNode): number | undefined {
  return node.props().get(PROPERTY.SELECTION);
}

/** The selected option index as a string (for `ui-select`/`ui-radio-group` values). */
export function selectionString(node: PathlandNode): string | undefined {
  const value = selection(node);
  return value === undefined ? undefined : String(value);
}

/** A `COLOR` node's fill (the COLOR property) as a CSS `rgba(...)` string. */
export function colorFill(node: PathlandNode): string {
  return argbToRgba(node.color(PROPERTY.COLOR) ?? 0xff000000);
}

/** A `SHAPE` node's kind (`SHAPE_KIND`, defaults to `Rectangle`). */
export function shapeKind(node: PathlandNode): number {
  return Math.round(node.f32(PROPERTY.SHAPE_KIND) ?? SHAPE_KIND.RECTANGLE);
}

/** A `SHAPE` node's CSS border-radius from `SHAPE_KIND` (+ BORDER_RADIUS for rounded rects). */
export function shapeRadius(node: PathlandNode): string {
  const kind = shapeKind(node);
  if (kind === SHAPE_KIND.CIRCLE || kind === SHAPE_KIND.ELLIPSE) {
    return '50%';
  }
  if (kind === SHAPE_KIND.CAPSULE) {
    return '999px';
  }
  if (kind === SHAPE_KIND.ROUNDED_RECTANGLE) {
    const radius = node.f32(PROPERTY.BORDER_RADIUS);
    return radius !== undefined ? `${radius}px` : '0';
  }
  return '0';
}

/** A color picker's `#rrggbb` value from `COLOR_VALUE` (0xAARRGGBB). */
export function colorHex(node: PathlandNode): string {
  const argb = node.color(PROPERTY.COLOR_VALUE) ?? 0xff000000;
  return '#' + ((argb & 0xffffff) | 0x1000000).toString(16).slice(1);
}

/** A date picker's `YYYY-MM-DD` value from the applied `SET_DATE` (days since epoch). */
export function dateValue(node: PathlandNode): string {
  const date = node.date();
  if (date === null || date.days === 0) {
    return '';
  }
  return new Date(Date.UTC(1970, 0, date.days)).toISOString().slice(0, 10);
}

/** An image's source (the `IMAGE_SOURCE` STRING property). */
export function imageSource(node: PathlandNode): string {
  return node.strings().get(PROPERTY.IMAGE_SOURCE) ?? node.text() ?? '';
}

/** Whether a `TEXT_FIELD` masks its input (`IS_SECURE` → `SecureField`). */
export function secure(node: PathlandNode): boolean {
  return (node.props().get(PROPERTY.IS_SECURE) ?? 0) !== 0;
}

/** A picker's visual style (`PICKER_STYLE`): menu / segmented / wheel / radioGroup. */
export function pickerStyle(node: PathlandNode): 'menu' | 'segmented' | 'wheel' | 'radioGroup' {
  const wire = node.f32(PROPERTY.PICKER_STYLE);
  switch (wire === undefined ? 0 : Math.round(wire)) {
    case 1: return 'segmented';
    case 2: return 'wheel';
    case 3: return 'radioGroup';
    default: return 'menu';
  }
}

/** A date picker's mode (`DATE_PICKER_MODE`): date / time / dateAndTime. */
export function datePickerMode(node: PathlandNode): 'date' | 'time' | 'dateAndTime' {
  const wire = node.f32(PROPERTY.DATE_PICKER_MODE);
  switch (wire === undefined ? 0 : Math.round(wire)) {
    case 1: return 'time';
    case 2: return 'dateAndTime';
    default: return 'date';
  }
}

/** A date picker's time-of-day (`HH:MM`) from the applied `SET_DATE` millis of day. */
export function timeValue(node: PathlandNode): string {
  const date = node.date();
  if (date === null || date.millis === 0) {
    return '';
  }
  const total = Math.floor(date.millis / 60000);
  const h = String(Math.floor(total / 60)).padStart(2, '0');
  const m = String(total % 60).padStart(2, '0');
  return `${h}:${m}`;
}

function buildShadow(node: PathlandNode): ShadowOptions | undefined {
  const radius = node.f32(PROPERTY.SHADOW_RADIUS);
  if (radius === undefined && node.color(PROPERTY.SHADOW_COLOR) === undefined) {
    return undefined;
  }
  const x = node.f32(PROPERTY.SHADOW_X) ?? 0;
  const y = node.f32(PROPERTY.SHADOW_Y) ?? 0;
  const color = argbToRgba(node.color(PROPERTY.SHADOW_COLOR) ?? 0x33000000);
  return { shadow: `${x}px ${y}px ${radius ?? 0}px ${color}` };
}

/** CSS filter string from the effect properties (blur/saturation/contrast/…). */
function buildFilter(node: PathlandNode): string | undefined {
  const parts: string[] = [];
  const blur = node.f32(PROPERTY.BLUR_RADIUS);
  if (blur !== undefined && blur > 0) {
    parts.push(`blur(${blur}px)`);
  }
  const saturation = node.f32(PROPERTY.SATURATION);
  if (saturation !== undefined) {
    parts.push(`saturate(${saturation})`);
  }
  const contrast = node.f32(PROPERTY.CONTRAST);
  if (contrast !== undefined) {
    parts.push(`contrast(${contrast})`);
  }
  const brightness = node.f32(PROPERTY.BRIGHTNESS);
  if (brightness !== undefined) {
    parts.push(`brightness(${brightness})`);
  }
  const grayscale = node.f32(PROPERTY.GRAYSCALE);
  if (grayscale !== undefined && grayscale > 0) {
    parts.push(`grayscale(${grayscale})`);
  }
  const hue = node.f32(PROPERTY.HUE_ROTATION);
  if (hue !== undefined && hue !== 0) {
    parts.push(`hue-rotate(${hue}deg)`);
  }
  if ((node.props().get(PROPERTY.COLOR_INVERT) ?? 0) !== 0) {
    parts.push('invert(1)');
  }
  return parts.length > 0 ? parts.join(' ') : undefined;
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

function buildFont(node: PathlandNode): { size?: string; weight?: string; family?: string; style?: string; lineHeight?: string } {
  const font: { size?: string; weight?: string; family?: string; style?: string; lineHeight?: string } = {};
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
  const style = node.f32(PROPERTY.FONT_STYLE);
  if (style !== undefined && Math.round(style) === 1) {
    font.style = 'italic';
  }
  const lineSpacing = node.f32(PROPERTY.LINE_SPACING);
  if (lineSpacing !== undefined && lineSpacing !== 0) {
    font.lineHeight = `${lineSpacing}px`;
  }
  return font;
}

function buildFrame(node: PathlandNode): FrameOptions | undefined {
  const width = node.f32(PROPERTY.WIDTH);
  const height = node.f32(PROPERTY.HEIGHT);
  const minWidth = node.f32(PROPERTY.MIN_WIDTH);
  const maxWidth = node.f32(PROPERTY.MAX_WIDTH);
  const minHeight = node.f32(PROPERTY.MIN_HEIGHT);
  const maxHeight = node.f32(PROPERTY.MAX_HEIGHT);
  const frame: { width?: string; height?: string; minWidth?: string; maxWidth?: string; minHeight?: string; maxHeight?: string; alignment?: NguiAlignment } = {};
  if (width !== undefined && width > 0) {
    frame.width = `${width}px`;
  }
  if (height !== undefined && height > 0) {
    frame.height = `${height}px`;
  }
  if (minWidth !== undefined && minWidth > 0) {
    frame.minWidth = `${minWidth}px`;
  }
  if (maxWidth !== undefined && maxWidth > 0) {
    frame.maxWidth = `${maxWidth}px`;
  }
  if (minHeight !== undefined && minHeight > 0) {
    frame.minHeight = `${minHeight}px`;
  }
  if (maxHeight !== undefined && maxHeight > 0) {
    frame.maxHeight = `${maxHeight}px`;
  }
  // Frame alignment (SwiftUI frame(width:height:alignment:)) only matters once sized.
  if ((frame.width || frame.height) && node.f32(PROPERTY.ALIGNMENT) !== undefined) {
    frame.alignment = nguiAlignment(node.f32(PROPERTY.ALIGNMENT)!);
  }
  return Object.keys(frame).length > 0 ? frame : undefined;
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

/** Protocol `Alignment` wire value → ngui frame alignment string. */
function nguiAlignment(wire: number): NguiAlignment {
  switch (Math.round(wire)) {
    case ALIGNMENT.LEADING: return 'leading';
    case ALIGNMENT.TRAILING: return 'trailing';
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

/** Protocol `FontWeight` wire value (100–900 scale) → CSS font-weight. */
function cssFontWeight(wire: number): string {
  switch (Math.round(wire)) {
    case FONT_WEIGHT.REGULAR: return 'normal';
    case FONT_WEIGHT.BOLD: return 'bold';
    default: return String(Math.round(wire));
  }
}

/** Format an alpha channel 0..1 so ngui's `COLOR_RGBA` macro parses it (it
 * accepts `1`, `.5`/`0.5`, `0%` — not `1.000`). */
function cssAlpha(value: number): string {
  const s = value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  return s === '0' ? '0.0' : s;
}

/** Format `0xAARRGGBB` as a CSS `rgba(...)` string (alpha in `0..1`). */
export function argbToRgba(argb: number): string {
  const a = (argb >>> 24) & 0xff;
  const r = (argb >>> 16) & 0xff;
  const g = (argb >>> 8) & 0xff;
  const b = argb & 0xff;
  return `rgba(${r},${g},${b},${cssAlpha(a / 255)})`;
}