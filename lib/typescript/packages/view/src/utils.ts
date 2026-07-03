/**
 * @pathland/view - Utilities
 * 
 * Shared utility functions for the view package.
 */

import type { PropertyValue } from '../../protocol/src/protocol/types';

// ============================================
// PROPERTY MAPPING
// ============================================

/**
 * Map property names to Pathland property IDs.
 */
export function propertyNameToId(name: string): number | undefined {
  const mapping: Record<string, number> = {
    // Text properties
    'text': 0x000A,
    'textAlignment': 0x000C,
    
    // Stack properties
    'spacing': 0x0001,
    'alignment': 0x0002,
    'justification': 0x0003,
    'padding': 0x0004,
    
    // Style properties
    'color': 0x100A,
    'backgroundColor': 0x1001,
    'fontSize': 0x1007,
    'fontWeight': 0x1008,
    'width': 0x100B,
    'height': 0x100C,
    'opacity': 0x100D,
    'visible': 0x100E,
    'zIndex': 0x100F,
    'borderRadius': 0x1005,
    
    // Custom
    'margin': 0x1011,
    'gap': 0x0005,
  };
  return mapping[name];
}

/**
 * Compile a property value to Pathland PropertyValue format.
 */
export function compilePropertyValue(_propertyId: number, value: any): PropertyValue {
  if (value === undefined || value === null) {
    return { type: 'u8', value: 0 };
  }
  
  switch (typeof value) {
    case 'string':
      return { type: 'string', value };
    case 'number':
      return Number.isInteger(value)
        ? { type: 'u32', value }
        : { type: 'f32', value };
    case 'boolean':
      return { type: 'u8', value: value ? 1 : 0 };
    default:
      return { type: 'string', value: String(value) };
  }
}
