import { describe, it, expect } from 'vitest';
import { decodeMessage, propertyValueToJS } from '../src/renderer/decoder';
import { 
  Opcode, 
  ComponentType, 
  ValueType,
  StackProperty,
  TextProperty,
  StyleProperty,
  SemanticColorToken,
  packRGBA
} from '../src/protocol/constants';
import { BinaryWriter } from '../src/protocol/binary';

describe('Decoder', () => {
  describe('decodeMessage', () => {
    it('should decode empty message with header', () => {
      const writer = new BinaryWriter();
      writer.writeU16(1); // version
      writer.writeU32(0); // instructionCount
      
      const buffer = writer.toArray();
      const decoded = decodeMessage(buffer);
      
      expect(decoded.version).toBe(1);
      expect(decoded.commands).toHaveLength(0);
    });

    it('should decode CREATE_NODE command without properties', () => {
      const writer = new BinaryWriter();
      writer.writeU16(1); // version
      writer.writeU32(1); // instructionCount
      writer.writeU8(Opcode.CREATE_NODE);
      writer.writeU32(42);
      writer.writeU16(ComponentType.TEXT);
      writer.writeU8(0); // propertyCount
      
      const buffer = writer.toArray();
      const decoded = decodeMessage(buffer);
      
      expect(decoded.commands).toHaveLength(1);
      const cmd = decoded.commands[0] as any;
      expect(cmd.opcode).toBe('CREATE_NODE');
      expect(cmd.nodeId).toBe(42);
      expect(cmd.componentType).toBe(ComponentType.TEXT);
      expect(cmd.properties.size).toBe(0);
    });

    it('should decode CREATE_NODE with properties', () => {
      const writer = new BinaryWriter();
      writer.writeU16(1);
      writer.writeU32(1);
      writer.writeU8(Opcode.CREATE_NODE);
      writer.writeU32(42);
      writer.writeU16(ComponentType.TEXT);
      writer.writeU8(1); // propertyCount
      writer.writeU16(TextProperty.TEXT);
      writer.writeU8(ValueType.STRING);
      writer.writeString('Hello');
      
      const buffer = writer.toArray();
      const decoded = decodeMessage(buffer);
      
      expect(decoded.commands).toHaveLength(1);
      const cmd = decoded.commands[0] as any;
      expect(cmd.opcode).toBe('CREATE_NODE');
      expect(cmd.nodeId).toBe(42);
      expect(cmd.componentType).toBe(ComponentType.TEXT);
      expect(cmd.properties.size).toBe(1);
      
      const prop = cmd.properties.get(TextProperty.TEXT);
      expect(prop.type).toBe('string');
      expect(prop.value).toBe('Hello');
    });

    it('should decode SET_PROPERTY command', () => {
      const writer = new BinaryWriter();
      writer.writeU16(1);
      writer.writeU32(1);
      writer.writeU8(Opcode.SET_PROPERTY);
      writer.writeU32(42);
      writer.writeU16(TextProperty.TEXT);
      writer.writeU8(ValueType.STRING);
      writer.writeString('World');
      
      const buffer = writer.toArray();
      const decoded = decodeMessage(buffer);
      
      expect(decoded.commands).toHaveLength(1);
      const cmd = decoded.commands[0] as any;
      expect(cmd.opcode).toBe('SET_PROPERTY');
      expect(cmd.nodeId).toBe(42);
      expect(cmd.propertyId).toBe(TextProperty.TEXT);
      expect(cmd.value.type).toBe('string');
      expect(cmd.value.value).toBe('World');
    });

    it('should decode INSERT_CHILD command', () => {
      const writer = new BinaryWriter();
      writer.writeU16(1);
      writer.writeU32(1);
      writer.writeU8(Opcode.INSERT_CHILD);
      writer.writeU32(1);
      writer.writeU32(42);
      writer.writeU32(0);
      
      const buffer = writer.toArray();
      const decoded = decodeMessage(buffer);
      
      expect(decoded.commands).toHaveLength(1);
      const cmd = decoded.commands[0] as any;
      expect(cmd.opcode).toBe('INSERT_CHILD');
      expect(cmd.parentId).toBe(1);
      expect(cmd.childId).toBe(42);
      expect(cmd.index).toBe(0);
    });

    it('should decode DELETE_NODE command', () => {
      const writer = new BinaryWriter();
      writer.writeU16(1);
      writer.writeU32(1);
      writer.writeU8(Opcode.DELETE_NODE);
      writer.writeU32(42);
      
      const buffer = writer.toArray();
      const decoded = decodeMessage(buffer);
      
      expect(decoded.commands).toHaveLength(1);
      const cmd = decoded.commands[0] as any;
      expect(cmd.opcode).toBe('DELETE_NODE');
      expect(cmd.nodeId).toBe(42);
    });

    it('should decode multiple commands in one message', () => {
      const writer = new BinaryWriter();
      writer.writeU16(1);
      writer.writeU32(3);
      
      // CREATE_NODE
      writer.writeU8(Opcode.CREATE_NODE);
      writer.writeU32(1);
      writer.writeU16(ComponentType.VSTACK);
      writer.writeU8(0);
      
      // CREATE_NODE
      writer.writeU8(Opcode.CREATE_NODE);
      writer.writeU32(2);
      writer.writeU16(ComponentType.TEXT);
      writer.writeU8(0);
      
      // INSERT_CHILD
      writer.writeU8(Opcode.INSERT_CHILD);
      writer.writeU32(1);
      writer.writeU32(2);
      writer.writeU32(0);
      
      const buffer = writer.toArray();
      const decoded = decodeMessage(buffer);
      
      expect(decoded.commands).toHaveLength(3);
    });
  });

  describe('Property Value Decoding', () => {
    it('should decode u8 value', () => {
      const writer = new BinaryWriter();
      writer.writeU16(1);
      writer.writeU32(1);
      writer.writeU8(Opcode.SET_PROPERTY);
      writer.writeU32(1);
      writer.writeU16(0x1234);
      writer.writeU8(ValueType.U8);
      writer.writeU8(42);
      
      const buffer = writer.toArray();
      const decoded = decodeMessage(buffer);
      const cmd = decoded.commands[0] as any;
      
      expect(cmd.value.type).toBe('u8');
      expect(cmd.value.value).toBe(42);
    });

    it('should decode u32 value', () => {
      const writer = new BinaryWriter();
      writer.writeU16(1);
      writer.writeU32(1);
      writer.writeU8(Opcode.SET_PROPERTY);
      writer.writeU32(1);
      writer.writeU16(0x1234);
      writer.writeU8(ValueType.U32);
      writer.writeU32(123456);
      
      const buffer = writer.toArray();
      const decoded = decodeMessage(buffer);
      const cmd = decoded.commands[0] as any;
      
      expect(cmd.value.type).toBe('u32');
      expect(cmd.value.value).toBe(123456);
    });

    it('should decode f32 value', () => {
      const writer = new BinaryWriter();
      writer.writeU16(1);
      writer.writeU32(1);
      writer.writeU8(Opcode.SET_PROPERTY);
      writer.writeU32(1);
      writer.writeU16(StackProperty.SPACING);
      writer.writeU8(ValueType.F32);
      writer.writeF32(12.5);
      
      const buffer = writer.toArray();
      const decoded = decodeMessage(buffer);
      const cmd = decoded.commands[0] as any;
      
      expect(cmd.value.type).toBe('f32');
      expect(cmd.value.value).toBeCloseTo(12.5);
    });

    it('should decode enum value', () => {
      const writer = new BinaryWriter();
      writer.writeU16(1);
      writer.writeU32(1);
      writer.writeU8(Opcode.SET_PROPERTY);
      writer.writeU32(1);
      writer.writeU16(StackProperty.ALIGNMENT);
      writer.writeU8(ValueType.ENUM);
      writer.writeU8(0x01); // CENTER
      
      const buffer = writer.toArray();
      const decoded = decodeMessage(buffer);
      const cmd = decoded.commands[0] as any;
      
      expect(cmd.value.type).toBe('enum');
      expect(cmd.value.value).toBe(0x01);
    });

    it('should decode string value', () => {
      const writer = new BinaryWriter();
      writer.writeU16(1);
      writer.writeU32(1);
      writer.writeU8(Opcode.SET_PROPERTY);
      writer.writeU32(1);
      writer.writeU16(TextProperty.TEXT);
      writer.writeU8(ValueType.STRING);
      writer.writeString('Test String');
      
      const buffer = writer.toArray();
      const decoded = decodeMessage(buffer);
      const cmd = decoded.commands[0] as any;
      
      expect(cmd.value.type).toBe('string');
      expect(cmd.value.value).toBe('Test String');
    });

    it('should decode semantic color value', () => {
      const writer = new BinaryWriter();
      writer.writeU16(1);
      writer.writeU32(1);
      writer.writeU8(Opcode.SET_PROPERTY);
      writer.writeU32(1);
      writer.writeU16(StyleProperty.COLOR);
      writer.writeU8(ValueType.COLOR);
      writer.writeU8(0x01); // SEMANTIC_TOKEN
      writer.writeU16(SemanticColorToken.PRIMARY_TEXT);
      
      const buffer = writer.toArray();
      const decoded = decodeMessage(buffer);
      const cmd = decoded.commands[0] as any;
      
      expect(cmd.value.type).toBe('color');
      expect(cmd.value.kind).toBe('semantic');
      expect(cmd.value.tokenId).toBe(SemanticColorToken.PRIMARY_TEXT);
    });

    it('should decode literal sRGB color value', () => {
      const red = packRGBA(255, 255, 0, 0);
      const writer = new BinaryWriter();
      writer.writeU16(1);
      writer.writeU32(1);
      writer.writeU8(Opcode.SET_PROPERTY);
      writer.writeU32(1);
      writer.writeU16(StyleProperty.BACKGROUND_COLOR);
      writer.writeU8(ValueType.COLOR);
      writer.writeU8(0x02); // LITERAL_SRGB
      writer.writeU32(red >>> 0); // Convert to unsigned
      
      const buffer = writer.toArray();
      const decoded = decodeMessage(buffer);
      const cmd = decoded.commands[0] as any;
      
      expect(cmd.value.type).toBe('color');
      expect(cmd.value.kind).toBe('literal');
      expect(cmd.value.rgba).toBe(red >>> 0);
    });

    it('should decode design token value', () => {
      const writer = new BinaryWriter();
      writer.writeU16(1);
      writer.writeU32(1);
      writer.writeU8(Opcode.SET_PROPERTY);
      writer.writeU32(1);
      writer.writeU16(0x1000);
      writer.writeU8(ValueType.DESIGN_TOKEN);
      writer.writeString('color.primary');
      
      const buffer = writer.toArray();
      const decoded = decodeMessage(buffer);
      const cmd = decoded.commands[0] as any;
      
      expect(cmd.value.type).toBe('designToken');
      expect(cmd.value.path).toBe('color.primary');
    });
  });

  describe('propertyValueToJS', () => {
    it('should convert u8 to number', () => {
      const value = { type: 'u8' as const, value: 42 };
      expect(propertyValueToJS(value)).toBe(42);
    });

    it('should convert u32 to number', () => {
      const value = { type: 'u32' as const, value: 123456 };
      expect(propertyValueToJS(value)).toBe(123456);
    });

    it('should convert f32 to number', () => {
      const value = { type: 'f32' as const, value: 12.5 };
      expect(propertyValueToJS(value)).toBe(12.5);
    });

    it('should convert string to string', () => {
      const value = { type: 'string' as const, value: 'test' };
      expect(propertyValueToJS(value)).toBe('test');
    });

    it('should convert enum to number', () => {
      const value = { type: 'enum' as const, value: 0x01 };
      expect(propertyValueToJS(value)).toBe(0x01);
    });

    it('should convert semantic color to object', () => {
      const value = { type: 'color' as const, kind: 'semantic' as const, tokenId: 0x0001 };
      const result = propertyValueToJS(value);
      expect(result).toEqual({ type: 'color', tokenId: 0x0001 });
    });

    it('should convert literal color to object', () => {
      const value = { type: 'color' as const, kind: 'literal' as const, rgba: 0xFFFF0000 };
      const result = propertyValueToJS(value);
      expect(result).toEqual({ type: 'color', rgba: 0xFFFF0000 });
    });

    it('should convert design token to object', () => {
      const value = { type: 'designToken' as const, path: 'color.primary' };
      const result = propertyValueToJS(value);
      expect(result).toEqual({ type: 'designToken', path: 'color.primary' });
    });
  });

  describe('Forward Compatibility', () => {
    it('should skip unknown opcodes', () => {
      const writer = new BinaryWriter();
      writer.writeU16(1);
      writer.writeU32(2);
      
      // Known opcode
      writer.writeU8(Opcode.CREATE_NODE);
      writer.writeU32(1);
      writer.writeU16(ComponentType.TEXT);
      writer.writeU8(0);
      
      // Unknown opcode (0x99)
      writer.writeU8(0x99);
      writer.writeU32(42);
      
      const buffer = writer.toArray();
      const decoded = decodeMessage(buffer);
      
      // Should decode the known command and skip the unknown one
      expect(decoded.commands).toHaveLength(1);
      expect(decoded.commands[0].opcode).toBe('CREATE_NODE');
    });

    it('should handle version field', () => {
      const writer = new BinaryWriter();
      writer.writeU16(2); // future version
      writer.writeU32(0);
      
      const buffer = writer.toArray();
      const decoded = decodeMessage(buffer);
      
      expect(decoded.version).toBe(2);
      expect(decoded.commands).toHaveLength(0);
    });
  });

  describe('Complex Scenarios', () => {
    it('should decode complete UI tree', () => {
      const writer = new BinaryWriter();
      writer.writeU16(1);
      writer.writeU32(5);
      
      // CREATE_NODE VStack
      writer.writeU8(Opcode.CREATE_NODE);
      writer.writeU32(1);
      writer.writeU16(ComponentType.VSTACK);
      writer.writeU8(1);
      writer.writeU16(StackProperty.SPACING);
      writer.writeU8(ValueType.F32);
      writer.writeF32(20);
      
      // CREATE_NODE Text1
      writer.writeU8(Opcode.CREATE_NODE);
      writer.writeU32(2);
      writer.writeU16(ComponentType.TEXT);
      writer.writeU8(1);
      writer.writeU16(TextProperty.TEXT);
      writer.writeU8(ValueType.STRING);
      writer.writeString('Hello');
      
      // CREATE_NODE Text2
      writer.writeU8(Opcode.CREATE_NODE);
      writer.writeU32(3);
      writer.writeU16(ComponentType.TEXT);
      writer.writeU8(1);
      writer.writeU16(TextProperty.TEXT);
      writer.writeU8(ValueType.STRING);
      writer.writeString('World');
      
      // INSERT_CHILD
      writer.writeU8(Opcode.INSERT_CHILD);
      writer.writeU32(1);
      writer.writeU32(2);
      writer.writeU32(0xFFFFFFFF);
      
      // INSERT_CHILD
      writer.writeU8(Opcode.INSERT_CHILD);
      writer.writeU32(1);
      writer.writeU32(3);
      writer.writeU32(0xFFFFFFFF);
      
      const buffer = writer.toArray();
      const decoded = decodeMessage(buffer);
      
      expect(decoded.commands).toHaveLength(5);
      expect(decoded.commands[0].opcode).toBe('CREATE_NODE');
      expect(decoded.commands[1].opcode).toBe('CREATE_NODE');
      expect(decoded.commands[2].opcode).toBe('CREATE_NODE');
      expect(decoded.commands[3].opcode).toBe('INSERT_CHILD');
      expect(decoded.commands[4].opcode).toBe('INSERT_CHILD');
    });
  });
});
