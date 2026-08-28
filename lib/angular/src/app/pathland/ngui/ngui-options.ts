/**
 * Structural types for the `@apaq/ngui-elements` modifier inputs. The published
 * package does not export its option interfaces, so these mirror them exactly
 * (structural typing makes them assignable to the directive `InputSignal`s).
 */
export type NguiEdge = 'Top' | 'Bottom' | 'All' | 'Leading' | 'Trailing' | 'Horizontal' | 'Vertical';
export type NguiSide = 'Top' | 'Bottom' | 'All' | 'Left' | 'Right' | 'Horizontal' | 'Vertical';
export type NguiAlignment =
  | 'topLeading' | 'top' | 'topTrailing'
  | 'leading' | 'center' | 'trailing'
  | 'bottomLeading' | 'bottom' | 'bottomTrailing'
  | 'leadingLastTextBaseline' | 'trailingFirstTextBaseline';

/** The stack `[alignment]` input union (ui-hstack / ui-vstack). */
export type NguiStackAlignment = 'leading' | 'center' | 'trailing' | 'baseline' | 'stretch';

/** The `ui-text` `[multilineTextAlignment]` input union. */
export type NguiTextAlignment = 'leading' | 'center' | 'trailing' | 'justify';

export interface PaddingArea {
  edge: NguiEdge;
  gap: number | string;
}

export interface PaddingOptions {
  paddingAreas: PaddingArea[];
}

export interface BackgroundOptions {
  color?: string;
  filter?: string;
}

export interface BorderArea {
  side: NguiSide;
  width?: number | string;
}

export interface BorderOptions {
  borderAreas: BorderArea[];
  color?: string;
}

export interface RoundingOptions {
  radius?: number | string;
}

export interface OpacityOptions {
  opacity?: number;
}

export interface FontOptions {
  family?: string;
  size?: string;
  weight?: string;
  style?: string;
  lineHeight?: string;
}

export interface FrameOptions {
  width?: string;
  height?: string;
  minWidth?: string;
  minHeight?: string;
  maxWidth?: string;
  maxHeight?: string;
  alignment?: NguiAlignment;
}

export interface FlexOptions {
  grow?: string | number;
  shrink?: string | number;
  basis?: string | number;
}

export interface LineLimitOptions {
  lineLimit?: number;
}