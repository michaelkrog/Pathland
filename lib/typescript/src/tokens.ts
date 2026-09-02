// Design tokens: SET_DESIGN_TOKEN deltas apply token overrides as CSS custom
// properties (spec/TOKENS.md). Base (light) tokens are emitted as `:root`
// rules; `dark.*` overrides are emitted inside
// `@media (prefers-color-scheme: dark)` so the browser resolves the scheme
// natively. A managed <style> element is used instead of inline
// `documentElement.style` — an inline dark override would beat the media query
// and break light mode.

import type { Batch, Opcode } from "./plpl";
import { readString } from "./plpl";
import { VAL_COLOR, VAL_F32, VAL_I32, VAL_U8, VAL_U32 } from "./constants";
import { argbToRgba, f32FromBits } from "./format";

const DARK_PREFIX = "dark.";

/** The canonical CSS custom property for a token path (spec/TOKENS.md): `--pl-`
 *  prefix, `.` → `-`. The `dark.` scheme prefix is stripped — the dark variant
 *  overrides the same variable inside a media query. */
export function tokenToCssVar(path: string): string {
  const bare = path.startsWith(DARK_PREFIX) ? path.slice(DARK_PREFIX.length) : path;
  return "--pl-" + bare.replace(/[^A-Za-z0-9_-]/g, "-");
}

/** Whether a token path selects the dark variant. */
export function isDarkToken(path: string): boolean {
  return path.startsWith(DARK_PREFIX);
}

/** Token paths whose F32 values are CSS lengths (emitted with `px`). */
function isLengthToken(path: string): boolean {
  if (
    path.startsWith("space.") ||
    path.startsWith("radius.") ||
    path.startsWith("border.width.") ||
    path.startsWith("size.control.") ||
    path.startsWith("control.padding.") ||
    path.startsWith("control.height.")
  ) {
    return true;
  }
  if (path.startsWith("control.font.") && path.endsWith(".size")) {
    return true;
  }
  if (path === "font.body.size" || path === "font.caption.size") {
    return true;
  }
  if (/^font\.heading\.\d+\.size$/.test(path)) {
    return true;
  }
  return /^elevation\.(low|high)\.(radius|x|y|blur)$/.test(path);
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

/** Render a token override value as CSS, appending `px` to F32 length tokens. */
function tokenCssOverride(path: string, valueType: number, c: number): string {
  const value = tokenCssValue(valueType, c);
  return isLengthToken(path) && valueType === VAL_F32 ? value + "px" : value;
}

const SPACE_FAMILY = /^space\.(\d+(?:\.\d+)?)$/;

/** Resolve a token *reference* (in a property) to a CSS expression. The
 *  generative `space.<N>` family resolves to `calc(var(--pl-space-base) * N)`;
 *  every other token resolves to `var(--pl-<path>)`. */
export function resolveTokenCssRef(path: string): string {
  const m = SPACE_FAMILY.exec(path);
  if (m) {
    return `calc(var(--pl-space-base) * ${m[1]})`;
  }
  return `var(${tokenToCssVar(path)})`;
}

export interface DesignTokenSink {
  setToken(path: string, valueType: number, c: number): void;
}

/**
 * Applies token overrides to a managed `<style data-pathland-tokens>` element:
 * base tokens as `:root` rules, `dark.*` tokens inside
 * `@media (prefers-color-scheme: dark)`. The element is appended to `<head>`
 * after the SSR built-in style block, so equal-specificity rules win in order.
 */
export function createTokenSink(): DesignTokenSink {
  const base = new Map<string, string>();
  const dark = new Map<string, string>();
  let styleEl: HTMLStyleElement | null = null;

  function render(): void {
    const rules: string[] = [];
    for (const [name, value] of base) {
      rules.push(`:root{${name}:${value};}`);
    }
    if (dark.size > 0) {
      const darkRules: string[] = [];
      for (const [name, value] of dark) {
        darkRules.push(`:root{${name}:${value};}`);
      }
      rules.push(`@media (prefers-color-scheme: dark){${darkRules.join("")}}`);
    }
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.setAttribute("data-pathland-tokens", "");
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = rules.join("");
  }

  return {
    setToken(path, valueType, c) {
      const name = tokenToCssVar(path);
      const value = tokenCssOverride(path, valueType, c);
      (isDarkToken(path) ? dark : base).set(name, value);
      render();
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