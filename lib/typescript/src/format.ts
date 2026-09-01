// Value formatting helpers. Mirror the Rust/Java renderers' numeric formatting.

export function f32FromBits(bits: number): number {
  return new Float32Array(new Uint32Array([bits >>> 0]).buffer)[0]!;
}

export function bitsFromF32(value: number): number {
  return new Uint32Array(new Float32Array([value]).buffer)[0]!;
}

/** Format `0xAARRGGBB` as a CSS `rgba(...)` string (alpha in `0..1`). */
export function argbToRgba(bits: number): string {
  const a = (bits >>> 24) & 0xff;
  const r = (bits >>> 16) & 0xff;
  const g = (bits >>> 8) & 0xff;
  const b = bits & 0xff;
  return `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`;
}

/** Format `0xAARRGGBB` as `#rrggbb`. */
export function argbToHex(bits: number): string {
  return "#" + ((bits & 0xffffff) | 0x1000000).toString(16).slice(1);
}

/** Days since the Unix epoch → `YYYY-MM-DD` (empty for a cleared value). */
export function daysToIso(days: number): string {
  if (days === 0) {
    return "";
  }
  return new Date(Date.UTC(1970, 0, days)).toISOString().slice(0, 10);
}

/** Format a float Rust-style ({@code 6.0 → "6"}, {@code 0.5 → "0.5"}). */
export function fmtFloat(value: number): string {
  return Number.isInteger(value) && Math.abs(value) < 2 ** 31 ? String(Math.round(value)) : String(value);
}