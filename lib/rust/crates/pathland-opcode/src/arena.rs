//! Bump arena for variable-length data in linear memory.
//!
//! Every entry is self-describing: `[u32 byteLength][bytes...]`. Opcodes
//! reference entries by their byte offset (`arenaRef`), so the entry length is
//! read directly from the arena and every opcode stays 16 bytes.

use crate::memory::header;

/// Errors produced by the arena.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ArenaError {
    /// Not enough remaining bytes for the allocation.
    OutOfSpace,
    /// The arena offset is out of bounds or points to an invalid entry.
    InvalidOffset,
}

/// Allocate `bytes` into the arena region, returning its byte offset.
///
/// The cursor lives in the header block (`OFF_ARENA_CURSOR`).
#[inline]
pub(crate) fn alloc(data: &mut [u8], header: &mut [u8], bytes: &[u8]) -> Result<u32, ArenaError> {
    let cursor = header::get_u32(header, crate::memory::OFF_ARENA_CURSOR) as usize;
    let len = bytes.len();
    let needed = 4 + len;
    if cursor + needed > data.len() {
        return Err(ArenaError::OutOfSpace);
    }
    data[cursor..cursor + 4].copy_from_slice(&(len as u32).to_le_bytes());
    data[cursor + 4..cursor + needed].copy_from_slice(bytes);
    header::set_u32(header, crate::memory::OFF_ARENA_CURSOR, (cursor + needed) as u32);
    Ok(cursor as u32)
}

/// Allocate a string, returning its arena offset.
#[inline]
pub(crate) fn alloc_str(
    data: &mut [u8],
    header: &mut [u8],
    s: &str,
) -> Result<u32, ArenaError> {
    alloc(data, header, s.as_bytes())
}

/// Read the bytes of the entry at `offset` from an arena region.
#[inline]
pub(crate) fn get(data: &[u8], offset: u32) -> Result<&[u8], ArenaError> {
    let off = offset as usize;
    if off + 4 > data.len() {
        return Err(ArenaError::InvalidOffset);
    }
    let len = u32::from_le_bytes(data[off..off + 4].try_into().unwrap()) as usize;
    if off + 4 + len > data.len() {
        return Err(ArenaError::InvalidOffset);
    }
    Ok(&data[off + 4..off + 4 + len])
}

/// Read the string at `offset` (UTF-8 validated).
#[inline]
pub(crate) fn get_str(data: &[u8], offset: u32) -> Result<&str, ArenaError> {
    let bytes = get(data, offset)?;
    core::str::from_utf8(bytes).map_err(|_| ArenaError::InvalidOffset)
}

#[cfg(test)]
mod tests {
    use alloc::vec;
    use super::*;
    use crate::memory::{header, MemoryLayout};

    #[test]
    fn alloc_and_get_round_trip() {
        let layout = MemoryLayout::default();
        let mut buf = vec![0u8; layout.total_bytes()];
        crate::init_memory(&mut buf, &layout);
        let (head, rest) = buf.split_at_mut(crate::memory::HEADER_SIZE);
        let (_, rest) = rest.split_at_mut(layout.ring_bytes() + layout.event_ring_bytes());
        let arena_data = rest;
        let off = alloc_str(arena_data, head, "Hello").unwrap();
        assert_eq!(get(arena_data, off).unwrap(), b"Hello");
        assert_eq!(get_str(arena_data, off).unwrap(), "Hello");
        assert_eq!(header::get_u32(head, crate::memory::OFF_ARENA_CURSOR), 4 + 5);
    }

    #[test]
    fn multiple_allocs_are_contiguous() {
        let layout = MemoryLayout::default();
        let mut buf = vec![0u8; layout.total_bytes()];
        crate::init_memory(&mut buf, &layout);
        let (head, rest) = buf.split_at_mut(crate::memory::HEADER_SIZE);
        let (_, rest) = rest.split_at_mut(layout.ring_bytes() + layout.event_ring_bytes());
        let arena_data = rest;
        let o1 = alloc_str(arena_data, head, "ab").unwrap();
        let o2 = alloc_str(arena_data, head, "cdef").unwrap();
        assert!(o2 > o1);
        assert_eq!(get(arena_data, o1).unwrap(), b"ab");
        assert_eq!(get(arena_data, o2).unwrap(), b"cdef");
    }

    #[test]
    fn out_of_space_is_reported() {
        let layout = MemoryLayout::default();
        let mut buf = vec![0u8; layout.total_bytes()];
        crate::init_memory(&mut buf, &layout);
        let (head, rest) = buf.split_at_mut(crate::memory::HEADER_SIZE);
        let (_, rest) = rest.split_at_mut(layout.ring_bytes() + layout.event_ring_bytes());
        let arena_data = rest;
        assert_eq!(
            alloc(arena_data, head, &[0u8; 1024 * 1024]).unwrap_err(),
            ArenaError::OutOfSpace
        );
    }
}
