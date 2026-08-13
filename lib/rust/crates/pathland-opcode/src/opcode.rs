//! The fixed-size 16-byte Pathland opcode.
//!
//! Layout (see `spec/OPCODE.md`):
//!
//! ```text
//! [Category: u8][Command: u8][Flags: u16][A: u32][B: u32][C: u32]
//! ```
//!
//! All multi-byte fields are little-endian on the wire. `size_of::<Opcode>() == 16`,
//! so a 64-byte cache line holds exactly 4 opcodes.

use core::ptr;

/// Size of one opcode in bytes.
pub const OPCODE_SIZE: usize = 16;

/// A fixed-size 16-byte opcode.
///
/// This struct intentionally mirrors the wire layout and is `#[repr(C, packed)]`
/// per the specification. Because it is packed, fields may be unaligned; always
/// read fields through the accessor methods (which use unaligned reads) rather
/// than by value.
#[repr(C, packed)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Opcode {
    /// Opcode category (see `constants::Category`).
    pub category: u8,
    /// Command within the category (see `constants::Command*`).
    pub command: u8,
    /// Category/command-specific flags.
    pub flags: u16,
    /// Primary payload.
    pub a: u32,
    /// Secondary payload.
    pub b: u32,
    /// Tertiary payload.
    pub c: u32,
}

impl Opcode {
    /// Byte size of an opcode (`16`).
    pub const SIZE: usize = OPCODE_SIZE;

    /// Construct an opcode from raw fields.
    #[inline]
    pub const fn new(category: u8, command: u8, flags: u16, a: u32, b: u32, c: u32) -> Self {
        Self {
            category,
            command,
            flags,
            a,
            b,
            c,
        }
    }

    /// The opcode category.
    #[inline]
    pub fn category(&self) -> u8 {
        self.category
    }

    /// The command within the category.
    #[inline]
    pub fn command(&self) -> u8 {
        self.command
    }

    /// The 16-bit flags word.
    #[inline]
    pub fn flags(&self) -> u16 {
        // SAFETY: read_unaligned is well-defined for packed fields.
        unsafe { ptr::addr_of!(self.flags).read_unaligned() }
    }

    /// Primary payload (little-endian u32).
    #[inline]
    pub fn a(&self) -> u32 {
        // SAFETY: read_unaligned is well-defined for packed fields.
        unsafe { ptr::addr_of!(self.a).read_unaligned() }
    }

    /// Secondary payload (little-endian u32).
    #[inline]
    pub fn b(&self) -> u32 {
        // SAFETY: read_unaligned is well-defined for packed fields.
        unsafe { ptr::addr_of!(self.b).read_unaligned() }
    }

    /// Tertiary payload (little-endian u32).
    #[inline]
    pub fn c(&self) -> u32 {
        // SAFETY: read_unaligned is well-defined for packed fields.
        unsafe { ptr::addr_of!(self.c).read_unaligned() }
    }

    /// Interpret `A` as an `f32` (bit-preserving).
    #[inline]
    pub fn a_f32(&self) -> f32 {
        f32::from_bits(self.a())
    }

    /// Interpret `B` as an `f32` (bit-preserving).
    #[inline]
    pub fn b_f32(&self) -> f32 {
        f32::from_bits(self.b())
    }

    /// Interpret `C` as an `f32` (bit-preserving).
    #[inline]
    pub fn c_f32(&self) -> f32 {
        f32::from_bits(self.c())
    }

    /// Serialize to the 16-byte wire representation (little-endian).
    pub fn to_bytes(&self) -> [u8; OPCODE_SIZE] {
        let mut out = [0u8; OPCODE_SIZE];
        out[0] = self.category;
        out[1] = self.command;
        // SAFETY: read_unaligned is well-defined for packed fields.
        let flags = unsafe { ptr::addr_of!(self.flags).read_unaligned() };
        let a = unsafe { ptr::addr_of!(self.a).read_unaligned() };
        let b = unsafe { ptr::addr_of!(self.b).read_unaligned() };
        let c = unsafe { ptr::addr_of!(self.c).read_unaligned() };
        out[2..4].copy_from_slice(&flags.to_le_bytes());
        out[4..8].copy_from_slice(&a.to_le_bytes());
        out[8..12].copy_from_slice(&b.to_le_bytes());
        out[12..16].copy_from_slice(&c.to_le_bytes());
        out
    }

    /// Deserialize from the 16-byte wire representation (little-endian).
    pub fn from_bytes(bytes: &[u8; OPCODE_SIZE]) -> Self {
        let category = bytes[0];
        let command = bytes[1];
        let flags = u16::from_le_bytes([bytes[2], bytes[3]]);
        let a = u32::from_le_bytes(bytes[4..8].try_into().unwrap());
        let b = u32::from_le_bytes(bytes[8..12].try_into().unwrap());
        let c = u32::from_le_bytes(bytes[12..16].try_into().unwrap());
        Self {
            category,
            command,
            flags,
            a,
            b,
            c,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn size_is_16_bytes() {
        assert_eq!(core::mem::size_of::<Opcode>(), 16);
    }

    #[test]
    fn round_trips_through_bytes() {
        let op = Opcode::new(0x01, 0x01, 0x0001, 0x1122_3344, 0x5566_7788, 0x99AA_BBCC);
        let bytes = op.to_bytes();
        let back = Opcode::from_bytes(&bytes);
        assert_eq!(op, back);
    }

    #[test]
    fn known_byte_layout() {
        // TREE / CREATE_NODE, no flags, nodeId=1, componentType=VSTACK(0x0002), c=0
        let op = Opcode::new(0x01, 0x01, 0x0000, 1, 0x0002, 0);
        assert_eq!(
            op.to_bytes(),
            [0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]
        );
    }

    #[test]
    fn float_payloads_round_trip() {
        let op = Opcode::new(0x02, 0x01, 0, 42, 100.0f32.to_bits(), 200.0f32.to_bits());
        let back = Opcode::from_bytes(&op.to_bytes());
        assert_eq!(back.a(), 42);
        assert_eq!(back.b_f32(), 100.0);
        assert_eq!(back.c_f32(), 200.0);
    }
}
