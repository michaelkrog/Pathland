//! Producer-side ring helpers operating on the ring region and header cursors.
//!
//! The ring is a power-of-two slot array. The guest writes at `writeCursor` and
//! the host reads from `readCursor`. Both cursors live in the header block.

use crate::opcode::Opcode;
use crate::{constants, memory, memory::header};

/// Errors produced by the ring producer.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RingError {
    /// The ring is full (consumer has not caught up). The producer SHOULD
    /// publish a frame before emitting further opcodes.
    Full,
}

/// Append `op` to the ring at `writeCursor` and advance the cursor.
///
/// `slots` is the full ring region; `mask` wraps the cursor. Fails with
/// `RingError::Full` when the next slot equals `readCursor`.
#[inline]
pub(crate) fn push(slots: &mut [u8], header: &mut [u8], mask: usize, op: &Opcode) -> Result<(), RingError> {
    let write = cursor(header, memory::OFF_WRITE_CURSOR, mask);
    let next = (write + 1) & mask;
    if next == cursor(header, memory::OFF_READ_CURSOR, mask) {
        return Err(RingError::Full);
    }
    let bytes = op.to_bytes();
    let off = write * Opcode::SIZE;
    slots[off..off + Opcode::SIZE].copy_from_slice(&bytes);
    header::set_u32(header, memory::OFF_WRITE_CURSOR, next as u32);
    Ok(())
}

/// Read the current cursor value for a header offset, masked.
#[inline]
pub(crate) fn cursor(header: &[u8], off: usize, mask: usize) -> usize {
    header::get_u32(header, off) as usize & mask
}

/// Emit a CREATE_NODE opcode.
pub(crate) fn push_create_node(
    slots: &mut [u8],
    header: &mut [u8],
    mask: usize,
    node_id: u32,
    component_type: u16,
) -> Result<(), RingError> {
    push(
        slots,
        header,
        mask,
        &Opcode::new(
            constants::category::TREE,
            constants::tree::CREATE_NODE,
            0,
            node_id,
            component_type as u32,
            0,
        ),
    )
}

pub(crate) fn push_delete_node(
    slots: &mut [u8],
    header: &mut [u8],
    mask: usize,
    node_id: u32,
) -> Result<(), RingError> {
    push(
        slots,
        header,
        mask,
        &Opcode::new(constants::category::TREE, constants::tree::DELETE_NODE, 0, node_id, 0, 0),
    )
}

pub(crate) fn push_insert_child(
    slots: &mut [u8],
    header: &mut [u8],
    mask: usize,
    parent: u32,
    child: u32,
    index: u32,
) -> Result<(), RingError> {
    push(
        slots,
        header,
        mask,
        &Opcode::new(
            constants::category::TREE,
            constants::tree::INSERT_CHILD,
            0,
            parent,
            child,
            index,
        ),
    )
}

pub(crate) fn push_remove_child(
    slots: &mut [u8],
    header: &mut [u8],
    mask: usize,
    parent: u32,
    child: u32,
) -> Result<(), RingError> {
    push(
        slots,
        header,
        mask,
        &Opcode::new(
            constants::category::TREE,
            constants::tree::REMOVE_CHILD,
            0,
            parent,
            child,
            0,
        ),
    )
}

pub(crate) fn push_set_origin(
    slots: &mut [u8],
    header: &mut [u8],
    mask: usize,
    node_id: u32,
    x: f32,
    y: f32,
) -> Result<(), RingError> {
    push(
        slots,
        header,
        mask,
        &Opcode::new(
            constants::category::LAYOUT,
            constants::layout::SET_ORIGIN,
            0,
            node_id,
            x.to_bits(),
            y.to_bits(),
        ),
    )
}

pub(crate) fn push_set_size(
    slots: &mut [u8],
    header: &mut [u8],
    mask: usize,
    node_id: u32,
    w: f32,
    h: f32,
) -> Result<(), RingError> {
    push(
        slots,
        header,
        mask,
        &Opcode::new(
            constants::category::LAYOUT,
            constants::layout::SET_SIZE,
            0,
            node_id,
            w.to_bits(),
            h.to_bits(),
        ),
    )
}

pub(crate) fn push_set_property(
    slots: &mut [u8],
    header: &mut [u8],
    mask: usize,
    node_id: u32,
    property_id: u16,
    value_type: u8,
    value: u32,
) -> Result<(), RingError> {
    push(
        slots,
        header,
        mask,
        &Opcode::new(
            constants::category::STYLE,
            constants::style::SET_PROPERTY,
            0,
            node_id,
            ((value_type as u32) << 16) | property_id as u32,
            value,
        ),
    )
}

pub(crate) fn push_set_text(
    slots: &mut [u8],
    header: &mut [u8],
    mask: usize,
    node_id: u32,
    arena_ref: u32,
) -> Result<(), RingError> {
    push(
        slots,
        header,
        mask,
        &Opcode::new(
            constants::category::STYLE,
            constants::style::SET_TEXT,
            0,
            node_id,
            arena_ref,
            0,
        ),
    )
}

pub(crate) fn push_reset(
    slots: &mut [u8],
    header: &mut [u8],
    mask: usize,
) -> Result<(), RingError> {
    push(
        slots,
        header,
        mask,
        &Opcode::new(constants::category::META, constants::meta::RESET, 0, 0, 0, 0),
    )
}
