// Design tokens: SET_DESIGN_TOKEN deltas apply token overrides as CSS custom
// properties (Tailwind v4 `@theme` tokens ARE CSS variables, e.g. `--color-primary`,
// `--space-2`, `--font-body`). The DOM renderer updates the variable on the
// document root (or the element) and the whole Tailwind-styled tree re-themes.

import type { Batch, Opcode } from "./plpl";
import { readString } from "./plpl";
import { VAL_COLOR, VAL_F32, VAL_I32, VAL_U8, VAL_U32 } from "./constants";
import { argbToRgba, f32FromBits } from "./format";

/** Convert a dot-separated token path (`color.primary`) to its CSS variable name (`--color-primary`). */
export function tokenToCssVar(path: string): string {
  return "--" + path.replace(/[^A-Za-z0-9_-]/g, "-");
}

/** Render a token value as a CSS value string per the value type. */
export function tokenCssValue(valueType: number, c: number): string {
  switch (valueType) {
    case VAL_COLOR:
      return argbToRgba(c);
    case VAL_F32:
      return String(f32FromBits(c));
    case VAL_I32:
      return String(c | 0);
    case VAL_U32:
      return String(c >>> 0);
    case VAL_U8:
      return String(c & 0xff);
    default:
      return String(c >>> 0);
  }
}

export interface DesignTokenSink {
  setToken(path: string, valueType: number, c: number): void;
}

/** Applies token overrides to the document root's CSS variables. */
export function createTokenSink(): DesignTokenSink {
  return {
    setToken(path, valueType, c) {
      document.documentElement.style.setProperty(tokenToCssVar(path), tokenCssValue(valueType, c));
    },
  };
}

/**
 * Handle a STYLE `SET_DESIGN_TOKEN` opcode (spec/OPCODE.md design-token system):
 * `A = arenaRef (token path)`, `B = valueType (u8, low byte)`, `C = value`.
 */
export function applyDesignToken(op: Opcode, strings: Uint8Array, sink: DesignTokenSink): void {
  const path = readString(strings, op.a);
  const valueType = op.b & 0xff;
  sink.setToken(path, valueType, op.c);
}

/** Convenience: apply every SET_DESIGN_TOKEN opcode in a batch. */
export function applyDesignTokens(batch: Batch, sink: DesignTokenSink): void {
  for (const op of batch.opcodes) {
    if (op.category === 0x02 /* STYLE */ && op.command === 0x02 /* SET_DESIGN_TOKEN */) {
      applyDesignToken(op, batch.strings, sink);
    }
  }
}