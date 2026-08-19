//! Linear-memory layout and the 64-byte header block.
//!
//! The guest engine and host share a single linear memory with fixed regions:
//! header block → ring buffer → arena. See `spec/OPCODE.md`.

use crate::opcode::OPCODE_SIZE;

/// Magic value written at header offset 0 (`"PLPL"`).
pub const MAGIC: u32 = 0x504C_504C;
/// Wire protocol version.
pub const PROTOCOL_VERSION: u16 = 1;

/// Default ring capacity in slots (power of two).
pub const DEFAULT_SLOT_COUNT: usize = 4096;
/// Default arena capacity in bytes.
pub const DEFAULT_ARENA_BYTES: usize = 1 << 20; // 1 MiB

// --- Header field offsets (64-byte header) ---
/// Byte offset of `magic: u32`.
pub const OFF_MAGIC: usize = 0x00;
/// Byte offset of `version: u16`.
pub const OFF_VERSION: usize = 0x04;
/// Byte offset of `ringOffset: u32`.
pub const OFF_RING_OFFSET: usize = 0x06;
/// Byte offset of `ringBytes: u32`.
pub const OFF_RING_BYTES: usize = 0x0A;
/// Byte offset of `slotCount: u32`.
pub const OFF_SLOT_COUNT: usize = 0x0E;
/// Byte offset of `arenaOffset: u32`.
pub const OFF_ARENA_OFFSET: usize = 0x12;
/// Byte offset of `arenaBytes: u32`.
pub const OFF_ARENA_BYTES: usize = 0x16;
/// Byte offset of `arenaCursor: u32` (guest-owned).
pub const OFF_ARENA_CURSOR: usize = 0x1A;
/// Byte offset of `readCursor: u32` (host-owned).
pub const OFF_READ_CURSOR: usize = 0x1E;
/// Byte offset of `writeCursor: u32` (guest-owned).
pub const OFF_WRITE_CURSOR: usize = 0x22;
/// Byte offset of `frameCount: u32` (guest-owned).
pub const OFF_FRAME_COUNT: usize = 0x26;
/// Total header size in bytes.
pub const HEADER_SIZE: usize = 0x40;

/// The fixed layout of the shared linear memory.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct MemoryLayout {
    /// Ring capacity in slots (must be a power of two).
    pub slot_count: usize,
    /// Arena capacity in bytes.
    pub arena_bytes: usize,
}

impl Default for MemoryLayout {
    fn default() -> Self {
        Self {
            slot_count: DEFAULT_SLOT_COUNT,
            arena_bytes: DEFAULT_ARENA_BYTES,
        }
    }
}

impl MemoryLayout {
    /// Ring region byte length.
    #[inline]
    pub fn ring_bytes(&self) -> usize {
        self.slot_count * OPCODE_SIZE
    }

    /// Total linear memory size: header + ring + arena.
    pub fn total_bytes(&self) -> usize {
        HEADER_SIZE + self.ring_bytes() + self.arena_bytes
    }

    /// Byte offset of the ring region (directly after the header).
    #[inline]
    pub fn ring_offset(&self) -> usize {
        HEADER_SIZE
    }

    /// Byte offset of the arena region (directly after the ring).
    #[inline]
    pub fn arena_offset(&self) -> usize {
        self.ring_offset() + self.ring_bytes()
    }

    /// Ring mask for wrapping a cursor (slot count is a power of two).
    #[inline]
    pub fn ring_mask(&self) -> usize {
        debug_assert!(self.slot_count.is_power_of_two());
        self.slot_count - 1
    }
}

/// Low-level accessors for the header block.
///
/// All accesses use explicit little-endian byte reads so the header can sit at
/// an arbitrary alignment within the linear memory.
pub(crate) mod header {
    use super::*;

    #[inline]
    pub(crate) fn get_u32(buf: &[u8], off: usize) -> u32 {
        u32::from_le_bytes(buf[off..off + 4].try_into().unwrap())
    }

    #[inline]
    pub(crate) fn set_u32(buf: &mut [u8], off: usize, value: u32) {
        buf[off..off + 4].copy_from_slice(&value.to_le_bytes());
    }

    #[inline]
    pub(crate) fn get_u16(buf: &[u8], off: usize) -> u16 {
        u16::from_le_bytes(buf[off..off + 2].try_into().unwrap())
    }

    /// Initialize a zeroed header for the given layout.
    pub(crate) fn init(buf: &mut [u8], layout: &MemoryLayout) {
        buf[..HEADER_SIZE].fill(0);
        set_u32(buf, OFF_MAGIC, MAGIC);
        buf[OFF_VERSION..OFF_VERSION + 2].copy_from_slice(&PROTOCOL_VERSION.to_le_bytes());
        set_u32(buf, OFF_RING_OFFSET, layout.ring_offset() as u32);
        set_u32(buf, OFF_RING_BYTES, layout.ring_bytes() as u32);
        set_u32(buf, OFF_SLOT_COUNT, layout.slot_count as u32);
        set_u32(buf, OFF_ARENA_OFFSET, layout.arena_offset() as u32);
        set_u32(buf, OFF_ARENA_BYTES, layout.arena_bytes as u32);
        set_u32(buf, OFF_ARENA_CURSOR, 0);
        set_u32(buf, OFF_READ_CURSOR, 0);
        set_u32(buf, OFF_WRITE_CURSOR, 0);
        set_u32(buf, OFF_FRAME_COUNT, 0);
    }

    /// Validate a header against a layout; returns false if the memory is not a
    /// valid Pathland linear memory.
    #[allow(dead_code)]
    pub(crate) fn validate(buf: &[u8], layout: &MemoryLayout) -> bool {
        if buf.len() < HEADER_SIZE {
            return false;
        }
        let magic = get_u32(buf, OFF_MAGIC);
        if magic != MAGIC {
            return false;
        }
        let version = get_u16(buf, OFF_VERSION);
        if version != PROTOCOL_VERSION {
            return false;
        }
        get_u32(buf, OFF_SLOT_COUNT) as usize == layout.slot_count
            && get_u32(buf, OFF_ARENA_BYTES) as usize == layout.arena_bytes
    }
}

#[cfg(test)]
mod tests {
    use alloc::vec;
    use super::*;

    #[test]
    fn header_size_is_64() {
        assert_eq!(HEADER_SIZE, 64);
    }

    #[test]
    fn default_layout_is_contiguous() {
        let layout = MemoryLayout::default();
        assert_eq!(layout.ring_offset(), HEADER_SIZE);
        assert_eq!(layout.arena_offset(), HEADER_SIZE + layout.ring_bytes());
        assert_eq!(
            layout.total_bytes(),
            HEADER_SIZE + layout.ring_bytes() + layout.arena_bytes
        );
        assert!(layout.slot_count.is_power_of_two());
    }

    #[test]
    fn header_round_trips() {
        let layout = MemoryLayout::default();
        let mut buf = vec![0u8; layout.total_bytes()];
        header::init(&mut buf, &layout);
        assert!(header::validate(&buf, &layout));
        assert_eq!(header::get_u32(&buf, OFF_SLOT_COUNT), layout.slot_count as u32);
        assert_eq!(header::get_u32(&buf, OFF_ARENA_BYTES), layout.arena_bytes as u32);
        assert_eq!(header::get_u32(&buf, OFF_ARENA_CURSOR), 0);
        assert_eq!(header::get_u32(&buf, OFF_READ_CURSOR), 0);
        assert_eq!(header::get_u32(&buf, OFF_WRITE_CURSOR), 0);
        assert_eq!(header::get_u32(&buf, OFF_FRAME_COUNT), 0);
    }
}
