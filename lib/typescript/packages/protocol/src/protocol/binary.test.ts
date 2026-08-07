/**
 * @pathland/protocol - Binary encoding/decoding round-trip tests.
 *
 * Covers every opcode and the forward-compatibility guarantees of the
 * per-instruction length framing ([u8 opcode][u16 payloadLength][payload]).
 */

import { describe, it, expect } from 'vitest';
import { encodeMessage, decodeMessage, BinaryWriter } from './binary';
import { PROTOCOL_VERSION, Opcode, ComponentType, TextProperty, StackProperty, SemanticColorToken, EventType, GestureType, GestureState } from './constants';
import type { Command, PropertyValue } from './types';

function extractInstructions(commands: Command[]): Uint8Array {
  // Header is [version u16][instructionCount u32] = 6 bytes.
  return encodeMessage(commands).slice(6);
}

describe('message header', () => {
  it('encodes a golden byte sequence for a simple message', () => {
    const commands: Command[] = [{ opcode: 'DELETE_NODE', nodeId: 42 }];
    const bytes = encodeMessage(commands);
    // version=1, count=1, then DELETE_NODE(0x02) len=4 nodeId=42
    expect(Array.from(bytes)).toEqual([0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x02, 0x04, 0x00, 0x2A, 0x00, 0x00, 0x00]);
  });

  it('uses the PROTOCOL_VERSION constant', () => {
    const bytes = encodeMessage([{ opcode: 'DELETE_NODE', nodeId: 1 }]);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(view.getUint16(0, true)).toBe(PROTOCOL_VERSION);
  });
});

describe('round-trip: tree mutation opcodes', () => {
  it('CREATE_NODE with mixed property value types', () => {
    const properties = new Map<number, PropertyValue>([
      [TextProperty.TEXT, { type: 'string', value: 'Hello' }],
      [0x1007, { type: 'f32', value: 24 }],
      [0x100A, { type: 'color', kind: 'semantic', tokenId: SemanticColorToken.PRIMARY_TEXT }],
      [0x1001, { type: 'color', kind: 'literal', rgba: 0xFFFF0000 }],
      [0x1009, { type: 'designToken', path: 'font.body' }],
    ]);
    const commands: Command[] = [{ opcode: 'CREATE_NODE', nodeId: 7, componentType: ComponentType.VSTACK, properties }];
    const decoded = decodeMessage(encodeMessage(commands));
    expect(decoded.version).toBe(PROTOCOL_VERSION);
    expect(decoded.commands).toEqual(commands);
  });

  it('DELETE_NODE', () => {
    const commands: Command[] = [{ opcode: 'DELETE_NODE', nodeId: 9 }];
    expect(decodeMessage(encodeMessage(commands)).commands).toEqual(commands);
  });

  it('INSERT_CHILD', () => {
    const commands: Command[] = [{ opcode: 'INSERT_CHILD', parentId: 1, childId: 2, index: 0 }];
    expect(decodeMessage(encodeMessage(commands)).commands).toEqual(commands);
  });

  it('REMOVE_CHILD', () => {
    const commands: Command[] = [{ opcode: 'REMOVE_CHILD', parentId: 1, childId: 2 }];
    expect(decodeMessage(encodeMessage(commands)).commands).toEqual(commands);
  });

  it('MOVE_CHILD', () => {
    const commands: Command[] = [{ opcode: 'MOVE_CHILD', parentId: 1, childId: 2, index: 4 }];
    expect(decodeMessage(encodeMessage(commands)).commands).toEqual(commands);
  });

  it('RESET', () => {
    const commands: Command[] = [{ opcode: 'RESET' }];
    const decoded = decodeMessage(encodeMessage(commands));
    expect(decoded.commands).toEqual(commands);
  });

  it('SET_PROPERTY with each value type', () => {
    const valueCases: Array<[string, PropertyValue]> = [
      ['u8', { type: 'u8', value: 1 }],
      ['u32', { type: 'u32', value: 4294967295 }],
      ['i32', { type: 'i32', value: -42 }],
      ['f32', { type: 'f32', value: 8.5 }],
      ['string', { type: 'string', value: 'text' }],
      ['enum', { type: 'enum', value: 0x03 }],
      ['semantic color', { type: 'color', kind: 'semantic', tokenId: SemanticColorToken.SUCCESS }],
      ['literal color', { type: 'color', kind: 'literal', rgba: 0x80FF00FF }],
      ['designToken', { type: 'designToken', path: 'space.md' }],
    ];
    for (const [, value] of valueCases) {
      const commands: Command[] = [{ opcode: 'SET_PROPERTY', nodeId: 3, propertyId: 0x100A, value }];
      expect(decodeMessage(encodeMessage(commands)).commands).toEqual(commands);
    }
  });

  it('SET_DESIGN_TOKEN uses string token paths without a numeric id', () => {
    const commands: Command[] = [
      { opcode: 'SET_DESIGN_TOKEN', tokenPath: 'color.primary', value: { type: 'color', kind: 'semantic', tokenId: SemanticColorToken.ACCENT } },
      { opcode: 'SET_DESIGN_TOKEN', tokenPath: 'space.2', value: { type: 'f32', value: 8 } },
    ];
    expect(decodeMessage(encodeMessage(commands)).commands).toEqual(commands);
  });
});

describe('round-trip: event opcodes', () => {
  it('REGISTER_EVENT_HANDLER', () => {
    const commands: Command[] = [{ opcode: 'REGISTER_EVENT_HANDLER', nodeId: 42, eventType: 0x01, handlerId: 5 }];
    const decoded = decodeMessage(encodeMessage(commands));
    expect(decoded.commands).toHaveLength(1);
    expect(decoded.commands[0]).toMatchObject({ opcode: 'REGISTER_EVENT_HANDLER', nodeId: 42, eventType: 0x01, handlerId: 5 });
  });

  it('DISPATCH_EVENT', () => {
    const commands: Command[] = [{ opcode: 'DISPATCH_EVENT', targetId: 42, eventType: 0x01 }];
    const decoded = decodeMessage(encodeMessage(commands));
    expect(decoded.commands).toHaveLength(1);
    expect(decoded.commands[0]).toMatchObject({ opcode: 'DISPATCH_EVENT', targetId: 42, eventType: 0x01 });
  });

  it('DISPATCH_EVENT with event data payloads', () => {
    const commands: Command[] = [
      { opcode: 'DISPATCH_EVENT', targetId: 1, eventType: EventType.TAP, timestamp: 0, phase: 0x01, data: { x: 10, y: 20, tapCount: 2 } },
      { opcode: 'DISPATCH_EVENT', targetId: 2, eventType: EventType.HOVER, timestamp: 0, phase: 0x01, data: { isHovering: true, x: 5, y: 6 } },
      { opcode: 'DISPATCH_EVENT', targetId: 3, eventType: EventType.KEY_DOWN, timestamp: 0, phase: 0x01, data: { keyCode: 65, modifiers: 1, repeat: false } },
      { opcode: 'DISPATCH_EVENT', targetId: 4, eventType: EventType.CLICK, timestamp: 0, phase: 0x01, data: { x: 1, y: 2, button: 0, clickCount: 1, modifiers: 0 } },
      { opcode: 'DISPATCH_EVENT', targetId: 5, eventType: EventType.FOCUS, timestamp: 0, phase: 0x01, data: { isFocused: true } },
    ];
    expect(decodeMessage(encodeMessage(commands)).commands).toEqual(commands);
  });

  it('ATTACH_GESTURE', () => {
    const commands: Command[] = [{
      opcode: 'ATTACH_GESTURE',
      nodeId: 10,
      gestureType: GestureType.DRAG,
      gestureRecognizerId: 3,
      handlerPhase: 0x01,
      onBeganHandler: 5,
      onChangedHandler: 6,
      onEndedHandler: 7,
      onCancelledHandler: 0,
    }];
    expect(decodeMessage(encodeMessage(commands)).commands).toEqual(commands);
  });

  it('GESTURE_UPDATE with per-state payloads', () => {
    const commands: Command[] = [
      {
        opcode: 'GESTURE_UPDATE',
        targetId: 1,
        gestureType: GestureType.DRAG,
        gestureState: GestureState.BEGAN,
        timestamp: 0,
        gestureId: 9,
        data: { startX: 1, startY: 2 },
      },
      {
        opcode: 'GESTURE_UPDATE',
        targetId: 1,
        gestureType: GestureType.DRAG,
        gestureState: GestureState.ENDED,
        timestamp: 0,
        gestureId: 9,
        data: { startX: 1, startY: 2, locationX: 30, locationY: 40, translationX: 29, translationY: 38, velocityX: 100, velocityY: 200 },
      },
      {
        opcode: 'GESTURE_UPDATE',
        targetId: 2,
        gestureType: GestureType.LONG_PRESS,
        gestureState: GestureState.ENDED,
        timestamp: 0,
        gestureId: 10,
        data: { startX: 0, startY: 0, locationX: 0, locationY: 0, duration: 500, pressure: 1 },
      },
    ];
    expect(decodeMessage(encodeMessage(commands)).commands).toEqual(commands);
  });
});

describe('round-trip: environment opcodes', () => {
  it('SET_ENVIRONMENT / UPDATE_ENVIRONMENT', () => {
    const fields = new Map<number, PropertyValue>([
      [0x01, { type: 'u32', value: 390 }],
      [0x02, { type: 'u32', value: 844 }],
      [0x05, { type: 'f32', value: 3 }],
      [0x0A, { type: 'u8', value: 0 }],
      [0x13, { type: 'string', value: 'en-US' }],
    ]);
    for (const opcode of ['SET_ENVIRONMENT', 'UPDATE_ENVIRONMENT'] as const) {
      const commands: Command[] = [{ opcode, fields: new Map(fields), requestId: 7 }];
      expect(decodeMessage(encodeMessage(commands)).commands).toEqual(commands);
    }
  });

  it('REQUEST_ENVIRONMENT (all fields and specific fields)', () => {
    const all: Command[] = [{ opcode: 'REQUEST_ENVIRONMENT', requestId: 1, fieldIds: [] }];
    expect(decodeMessage(encodeMessage(all)).commands).toEqual(all);

    const some: Command[] = [{ opcode: 'REQUEST_ENVIRONMENT', requestId: 2, fieldIds: [0x01, 0x02] }];
    expect(decodeMessage(encodeMessage(some)).commands).toEqual(some);
  });
});

describe('forward compatibility', () => {
  it('skips unknown opcodes by their length prefix and continues decoding', () => {
    const cmd1: Command = { opcode: 'CREATE_NODE', nodeId: 1, componentType: ComponentType.HSTACK, properties: new Map() };
    const cmd2: Command = { opcode: 'SET_PROPERTY', nodeId: 1, propertyId: StackProperty.SPACING, value: { type: 'f32', value: 8 } };
    const cmd3: Command = { opcode: 'DELETE_NODE', nodeId: 1 };

    // Unknown instruction: opcode 0x7F with a 4-byte payload.
    const unknown = new Uint8Array([0x7F, 0x04, 0x00, 0xDE, 0xAD, 0xBE, 0xEF]);

    const header = new Uint8Array([PROTOCOL_VERSION & 0xFF, 0x00, 0x04, 0x00, 0x00, 0x00]); // 4 instructions: cmd1, cmd2, unknown, cmd3
    const buffer = new Uint8Array([
      ...header,
      ...extractInstructions([cmd1, cmd2]),
      ...unknown,
      ...extractInstructions([cmd3]),
    ]);

    const decoded = decodeMessage(buffer);
    expect(decoded.version).toBe(PROTOCOL_VERSION);
    expect(decoded.commands).toHaveLength(3);
    expect(decoded.commands[0]).toEqual(cmd1);
    expect(decoded.commands[1]).toEqual(cmd2);
    expect(decoded.commands[2]).toEqual(cmd3);
  });

  it('throws when a known instruction overruns its declared payload length', () => {
    // DELETE_NODE must declare a 4-byte payload; declare 0 bytes instead.
    const malformed = new Uint8Array([0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x2A, 0x00, 0x00, 0x00]);
    expect(() => decodeMessage(malformed)).toThrow(/overran its declared payload length/);
  });
});

describe('encoder guards', () => {
  it('rejects instructions whose payload exceeds 65535 bytes', () => {
    const big = 'x'.repeat(70000);
    const commands: Command[] = [{ opcode: 'SET_PROPERTY', nodeId: 1, propertyId: TextProperty.TEXT, value: { type: 'string', value: big } }];
    expect(() => encodeMessage(commands)).toThrow(/exceeds 65535 bytes/);
  });

  it('round-trips the maximum supported payload length', () => {
    const big = 'x'.repeat(60000);
    const commands: Command[] = [{ opcode: 'SET_PROPERTY', nodeId: 1, propertyId: TextProperty.TEXT, value: { type: 'string', value: big } }];
    const decoded = decodeMessage(encodeMessage(commands));
    expect(decoded.commands[0]).toEqual(commands[0]);
  });
});

describe('writer helpers', () => {
  it('writes length-prefixed strings', () => {
    const w = new BinaryWriter();
    w.writeString('hello');
    expect(Array.from(w.toArray())).toEqual([0x05, 0x00, 0x00, 0x00, 0x68, 0x65, 0x6C, 0x6C, 0x6F]);
  });
});
