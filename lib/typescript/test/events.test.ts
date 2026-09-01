import { describe, expect, it } from "vitest";
import {
  encodeDateChanged,
  encodePointerUp,
  encodeTextChanged,
  encodeValueBits,
  encodeValueChanged,
} from "../src/events";
import {
  CAT_EVENT,
  CMD_DATE_CHANGED,
  CMD_POINTER_UP,
  CMD_TEXT_CHANGED,
  CMD_VALUE_CHANGED,
  HEADER_SIZE,
  MAGIC,
  VERSION,
} from "../src/constants";
import { parseBatch, readString } from "../src/plpl";

describe("event encoders", () => {
  it("encodePointerUp: header + single EVENT opcode, guest->host", () => {
    const bytes = encodePointerUp(42);
    expect(bytes.length).toBe(HEADER_SIZE + 16 + 4);
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(0, true)).toBe(MAGIC);
    expect(view.getUint16(4, true)).toBe(VERSION);
    expect(view.getUint16(6, true)).toBe(0); // guest -> host
    expect(view.getUint32(8, true)).toBe(0); // frameCount
    expect(view.getUint32(12, true)).toBe(1); // opcodeCount
    expect(view.getUint8(HEADER_SIZE)).toBe(CAT_EVENT);
    expect(view.getUint8(HEADER_SIZE + 1)).toBe(CMD_POINTER_UP);
    expect(view.getUint32(HEADER_SIZE + 4, true)).toBe(42);
  });

  it("encodeValueChanged packs the f32 value into B", () => {
    const view = new DataView(encodeValueChanged(7, 0.5).buffer);
    expect(view.getUint8(HEADER_SIZE + 1)).toBe(CMD_VALUE_CHANGED);
    const bits = view.getUint32(HEADER_SIZE + 8, true);
    expect(new Float32Array(new Uint32Array([bits]).buffer)[0]).toBe(0.5);
  });

  it("encodeValueBits passes raw bits through B", () => {
    const view = new DataView(encodeValueBits(3, 0xff000000 | 0xabcdef).buffer);
    expect(view.getUint32(HEADER_SIZE + 8, true)).toBe(0xffabcdef);
  });

  it("encodeDateChanged packs days + millis into B/C", () => {
    const view = new DataView(encodeDateChanged(9, 20000, 3600000).buffer);
    expect(view.getUint8(HEADER_SIZE + 1)).toBe(CMD_DATE_CHANGED);
    expect(view.getUint32(HEADER_SIZE + 8, true)).toBe(20000);
    expect(view.getUint32(HEADER_SIZE + 12, true)).toBe(3600000);
  });

  it("encodeTextChanged rides text in the string section (round-trips)", () => {
    const batch = parseBatch(encodeTextChanged(11, "hello"));
    expect(batch.opcodes[0]?.category).toBe(CAT_EVENT);
    expect(batch.opcodes[0]?.command).toBe(CMD_TEXT_CHANGED);
    expect(batch.opcodes[0]?.a).toBe(11);
    expect(readString(batch.strings, batch.opcodes[0]!.b)).toBe("hello");
  });
});