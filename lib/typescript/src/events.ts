// Host → guest event encoders. Each call produces a self-contained PLPL batch
// with a single EVENT opcode (guest → host direction, flags = 0x0000).

import {
  CAT_EVENT,
  CMD_DATE_CHANGED,
  CMD_POINTER_UP,
  CMD_TEXT_CHANGED,
  CMD_VALUE_CHANGED,
  HEADER_SIZE,
  MAGIC,
  OPCODE_SIZE,
  VERSION,
} from "./constants";
import { bitsFromF32 } from "./format";

function eventBatch(command: number, a: number, b: number, c: number): Uint8Array {
  const out = new Uint8Array(HEADER_SIZE + OPCODE_SIZE + 4);
  const view = new DataView(out.buffer);
  view.setUint32(0, MAGIC, true);
  view.setUint16(4, VERSION, true);
  view.setUint16(6, 0, true); // flags = guest -> host
  view.setUint32(8, 0, true); // frameCount
  view.setUint32(12, 1, true); // opcodeCount
  const pos = HEADER_SIZE;
  view.setUint8(pos, CAT_EVENT);
  view.setUint8(pos + 1, command);
  view.setUint32(pos + 4, a, true);
  view.setUint32(pos + 8, b, true);
  view.setUint32(pos + 12, c, true);
  return out;
}

/** A button tap: POINTER_UP on the target node. */
export function encodePointerUp(target: number): Uint8Array {
  return eventBatch(CMD_POINTER_UP, target, 0, 0);
}

/** A VALUE_CHANGED EVENT with the value as f32 bits (toggle 0/1, slider, select index, stepper). */
export function encodeValueChanged(target: number, value: number): Uint8Array {
  return eventBatch(CMD_VALUE_CHANGED, target, bitsFromF32(value), 0);
}

/** A VALUE_CHANGED EVENT with a raw 32-bit payload (e.g. a packed ARGB color). */
export function encodeValueBits(target: number, bits: number): Uint8Array {
  return eventBatch(CMD_VALUE_CHANGED, target, bits >>> 0, 0);
}

/** A DATE_CHANGED EVENT (A=target, B=days, C=millis of day). */
export function encodeDateChanged(target: number, days: number, millis: number): Uint8Array {
  return eventBatch(CMD_DATE_CHANGED, target, days >>> 0, millis >>> 0);
}

/** A TEXT_CHANGED EVENT; the text rides in the batch's string section (B = relative offset). */
export function encodeTextChanged(target: number, text: string): Uint8Array {
  const bytes = new TextEncoder().encode(text);
  const out = new Uint8Array(HEADER_SIZE + OPCODE_SIZE + 4 + 4 + bytes.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, MAGIC, true);
  view.setUint16(4, VERSION, true);
  view.setUint16(6, 0, true);
  view.setUint32(8, 0, true);
  view.setUint32(12, 1, true);
  const pos = HEADER_SIZE;
  view.setUint8(pos, CAT_EVENT);
  view.setUint8(pos + 1, CMD_TEXT_CHANGED);
  view.setUint32(pos + 4, target, true);
  view.setUint32(pos + 8, 0, true); // b = relative string offset (first entry)
  view.setUint32(pos + 12, 0, true);
  // string section: [stringsLen u32][entryLen u32][utf8…]
  const stringsAt = HEADER_SIZE + OPCODE_SIZE;
  view.setUint32(stringsAt, 4 + bytes.length, true);
  view.setUint32(stringsAt + 4, bytes.length, true);
  out.set(bytes, stringsAt + 8);
  return out;
}