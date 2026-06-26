import { describe, it, expect, beforeEach } from 'vitest';
import { encodeMessage, createCreateNodeCommand, createSetPropertyCommand } from '../src/application/encoder';
import { decodeMessage } from '../src/renderer/decoder';
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
import { BinaryReader } from '../src/protocol/binary';

describe('Encoder', () => {
  describe('encodeMessage', () => {
    it('should encode empty command list with header', () => {
      const commands: any[] = [];
      const encoded = encodeMessage(commands);
      
      // Header: u16 version (1) + u32 instructionCount (0)
      expect(encoded.length).toBe(6);
      
      const reader = new BinaryReader(encoded);
      expect(reader.readU16()).toBe(1); // version
      expect(reader.readU32()).toBe(0); // instructionCount
    });

    it('should encode CREATE_NODE command without properties', () => {
      const commands = [
        createCreateNodeCommand(42, ComponentType.TEXT, {})
      ];
      const encoded = encodeMessage(commands);
      
      // Header (6 bytes) + CREATE_NODE: u8 opcode + u32 nodeId + u16 componentType + u8 propertyCount
      expect(encoded.length).toBe(6 + 1 + 4 + 2 + 1);
      
      const reader = new BinaryReader(encoded);
      reader.readU16(); // version
      reader.readU32(); // instructionCount
      
      const opcode = reader.readU8();
      expect(opcode).toBe(Opcode.CREATE_NODE);
      expect(reader.readU32()).toBe(42);
      expect(reader.readU16()).toBe(ComponentType.TEXT);
      expect(reader.readU8()).toBe(0); // propertyCount
    });

    it('should encode CREATE_NODE with properties', () => {
      const commands = [
        createCreateNodeCommand(42, ComponentType.TEXT, {
          [TextProperty.TEXT]: 'Hello'
        })
      ];
      const encoded = encodeMessage(commands);
      
      // Verify the message can be decoded back
      const decoded = decodeMessage(encoded);
      
      expect(decoded.commands).toHaveLength(1);
      const cmd = decoded.commands[0] as any;
      expect(cmd.opcode).toBe('CREATE_NODE');
      expect(cmd.nodeId).toBe(42);
      expect(cmd.componentType).toBe(ComponentType.TEXT);
      expect(cmd.properties.size).toBe(1);
      
      const prop = cmd.properties.get(TextProperty.TEXT);
      expect(prop?.type).toBe('string');
      expect(prop?.value).toBe('Hello');
    });

    it('should encode SET_PROPERTY command', () => {
      const commands = [
        createSetPropertyCommand(42, TextProperty.TEXT, 'World')
      ];
      const encoded = encodeMessage(commands);
      
      // Verify the message can be decoded back
      const decoded = decodeMessage(encoded);
      
      expect(decoded.commands).toHaveLength(1);
      const cmd = decoded.commands[0] as any;
      expect(cmd.opcode).toBe('SET_PROPERTY');
      expect(cmd.nodeId).toBe(42);
      expect(cmd.propertyId).toBe(TextProperty.TEXT);
      expect(cmd.value.type).toBe('string');
      expect(cmd.value.value).toBe('World');
    });

    it('should encode INSERT_CHILD command', () => {
      const commands = [
        {
          opcode: 'INSERT_CHILD' as const,
          parentId: 1,
          childId: 42,
          index: 0
        }
      ];
      const encoded = encodeMessage(commands);
      
      const reader = new BinaryReader(encoded);
      reader.readU16(); // version
      reader.readU32(); // instructionCount
      
      const opcode = reader.readU8();
      expect(opcode).toBe(Opcode.INSERT_CHILD);
      expect(reader.readU32()).toBe(1);
      expect(reader.readU32()).toBe(42);
      expect(reader.readU32()).toBe(0);
    });

    it('should encode DELETE_NODE command', () => {
      const commands = [
        {
          opcode: 'DELETE_NODE' as const,
          nodeId: 42
        }
      ];
      const encoded = encodeMessage(commands);
      
      const reader = new BinaryReader(encoded);
      reader.readU16(); // version
      reader.readU32(); // instructionCount
      
      const opcode = reader.readU8();
      expect(opcode).toBe(Opcode.DELETE_NODE);
      expect(reader.readU32()).toBe(42);
    });

    it('should encode multiple commands in one message', () => {
      const commands = [
        createCreateNodeCommand(1, ComponentType.VSTACK, {
          [StackProperty.SPACING]: 10
        }),
        createCreateNodeCommand(2, ComponentType.TEXT, {
          [TextProperty.TEXT]: 'Test'
        }),
        {
          opcode: 'INSERT_CHILD' as const,
          parentId: 1,
          childId: 2,
          index: 0
        }
      ];
      const encoded = encodeMessage(commands);
      
      const reader = new BinaryReader(encoded);
      const version = reader.readU16();
      const instructionCount = reader.readU32();
      
      expect(version).toBe(1);
      expect(instructionCount).toBe(3);
    });
  });

  describe('Property Value Encoding', () => {
    it('should encode u8 value', () => {
      const commands = [
        createSetPropertyCommand(1, 0x1234, 42)
      ];
      const encoded = encodeMessage(commands);
      
      const reader = new BinaryReader(encoded);
      reader.readU16(); // version
      reader.readU32(); // instructionCount
      reader.readU8(); // opcode
      reader.readU32(); // nodeId
      reader.readU16(); // propertyId
      
      expect(reader.readU8()).toBe(ValueType.U8);
      expect(reader.readU8()).toBe(42);
    });

    it('should encode u32 value', () => {
      const commands = [
        createSetPropertyCommand(1, 0x1234, 123456)
      ];
      const encoded = encodeMessage(commands);
      
      const reader = new BinaryReader(encoded);
      reader.readU16();
      reader.readU32();
      reader.readU8();
      reader.readU32();
      reader.readU16();
      
      expect(reader.readU8()).toBe(ValueType.U32);
      expect(reader.readU32()).toBe(123456);
    });

    it('should encode f32 value', () => {
      const commands = [
        createSetPropertyCommand(1, StackProperty.SPACING, 12.5)
      ];
      const encoded = encodeMessage(commands);
      
      const reader = new BinaryReader(encoded);
      reader.readU16();
      reader.readU32();
      reader.readU8();
      reader.readU32();
      reader.readU16();
      
      expect(reader.readU8()).toBe(ValueType.F32);
      expect(reader.readF32()).toBeCloseTo(12.5);
    });

    it('should encode enum value', () => {
      const commands = [
        createSetPropertyCommand(1, StackProperty.ALIGNMENT, { type: 'enum', value: 0x01 }) // CENTER
      ];
      const encoded = encodeMessage(commands);
      
      const reader = new BinaryReader(encoded);
      reader.readU16();
      reader.readU32();
      reader.readU8();
      reader.readU32();
      reader.readU16();
      
      expect(reader.readU8()).toBe(ValueType.ENUM);
      expect(reader.readU8()).toBe(0x01);
    });

    it('should encode semantic color value', () => {
      const commands = [
        createSetPropertyCommand(1, StyleProperty.COLOR, {
          kind: 'semantic',
          tokenId: SemanticColorToken.PRIMARY_TEXT
        })
      ];
      const encoded = encodeMessage(commands);
      
      const reader = new BinaryReader(encoded);
      reader.readU16();
      reader.readU32();
      reader.readU8();
      reader.readU32();
      reader.readU16();
      
      expect(reader.readU8()).toBe(ValueType.COLOR);
      expect(reader.readU8()).toBe(0x01); // SEMANTIC_TOKEN
      expect(reader.readU16()).toBe(SemanticColorToken.PRIMARY_TEXT);
    });

    it('should encode literal sRGB color value', () => {
      const red = packRGBA(255, 255, 0, 0);
      const commands = [
        createSetPropertyCommand(1, StyleProperty.BACKGROUND_COLOR, {
          kind: 'literal',
          rgba: red >>> 0 // Convert to unsigned
        })
      ];
      const encoded = encodeMessage(commands);
      
      const reader = new BinaryReader(encoded);
      reader.readU16();
      reader.readU32();
      reader.readU8();
      reader.readU32();
      reader.readU16();
      
      expect(reader.readU8()).toBe(ValueType.COLOR);
      expect(reader.readU8()).toBe(0x02); // LITERAL_SRGB
      expect(reader.readU32()).toBe(red >>> 0);
    });

    it('should encode design token value', () => {
      const commands = [
        createSetPropertyCommand(1, 0x1000, {
          path: 'color.primary'
        })
      ];
      const encoded = encodeMessage(commands);
      
      const reader = new BinaryReader(encoded);
      reader.readU16();
      reader.readU32();
      reader.readU8();
      reader.readU32();
      reader.readU16();
      
      expect(reader.readU8()).toBe(ValueType.DESIGN_TOKEN);
      expect(reader.readString()).toBe('color.primary');
    });

    it('should encode boolean as u8', () => {
      const commands = [
        createSetPropertyCommand(1, StyleProperty.VISIBLE, true)
      ];
      const encoded = encodeMessage(commands);
      
      const reader = new BinaryReader(encoded);
      reader.readU16();
      reader.readU32();
      reader.readU8();
      reader.readU32();
      reader.readU16();
      
      expect(reader.readU8()).toBe(ValueType.U8);
      expect(reader.readU8()).toBe(1);
    });
  });

  describe('Complex Scenarios', () => {
    it('should encode complete VStack with Text children', () => {
      const commands = [
        createCreateNodeCommand(1, ComponentType.VSTACK, {
          [StackProperty.SPACING]: 20,
          [StackProperty.ALIGNMENT]: 0x01 // CENTER
        }),
        createCreateNodeCommand(2, ComponentType.TEXT, {
          [TextProperty.TEXT]: 'Hello',
          [TextProperty.TEXT_ALIGNMENT]: 0x01 // CENTER
        }),
        createCreateNodeCommand(3, ComponentType.TEXT, {
          [TextProperty.TEXT]: 'World',
          [TextProperty.TEXT_ALIGNMENT]: 0x01 // CENTER
        }),
        {
          opcode: 'INSERT_CHILD' as const,
          parentId: 1,
          childId: 2,
          index: 0xFFFFFFFF // append
        },
        {
          opcode: 'INSERT_CHILD' as const,
          parentId: 1,
          childId: 3,
          index: 0xFFFFFFFF // append
        }
      ];
      
      const encoded = encodeMessage(commands);
      expect(encoded.length > 0).toBe(true);
      
      const reader = new BinaryReader(encoded);
      const version = reader.readU16();
      const instructionCount = reader.readU32();
      
      expect(version).toBe(1);
      expect(instructionCount).toBe(5);
    });

    it('should handle up to 255 properties in CREATE_NODE', () => {
      const properties: Record<number, any> = {};
      for (let i = 0; i < 255; i++) {
        properties[i] = i;
      }
      
      const commands = [
        createCreateNodeCommand(1, ComponentType.TEXT, properties)
      ];
      
      const encoded = encodeMessage(commands);
      
      const reader = new BinaryReader(encoded);
      reader.readU16();
      reader.readU32();
      reader.readU8(); // CREATE_NODE
      reader.readU32();
      reader.readU16();
      expect(reader.readU8()).toBe(255); // propertyCount
    });

    it('should throw error for too many properties in CREATE_NODE', () => {
      const properties: Record<number, any> = {};
      for (let i = 0; i < 256; i++) {
        properties[i] = i;
      }
      
      expect(() => {
        encodeMessage([createCreateNodeCommand(1, ComponentType.TEXT, properties)]);
      }).toThrow('Too many properties');
    });
  });
});
