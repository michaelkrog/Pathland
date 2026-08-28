//! Typed raw-input events (host → guest).
//!
//! Events are the **raw inputs** the renderer reports: pointer down/move/up and
//! key down/up, each carrying a host-resolved `targetId`. High-level
//! interpretations (tap, drag, long-press) are built by the guest/app from
//! these raw inputs and are NOT part of the protocol.
//!
//! Encode a raw input with `Event::encode`, decode a ring opcode with
//! `Event::try_from`.

use alloc::string::String;
use alloc::string::ToString;
use crate::category;
use crate::flag;
use crate::Opcode;

/// A raw-input event (host → guest).
///
/// `Event` is **not** `Copy`: [`Event::TextChanged`] owns the new field text.
/// Simple events round-trip through `encode`/`try_from` as pure 16-byte
/// opcodes; `TextChanged` is encoded/decoded at the batch level (its text
/// lives in the batch's string section, referenced by a relative offset).
#[derive(Debug, Clone, PartialEq)]
pub enum Event {
    /// Pointer button pressed at a viewport-relative point.
    PointerDown {
        target: u32,
        x: f32,
        y: f32,
        secondary: bool,
    },
    /// Pointer moved; optionally entered/left the node (hover).
    PointerMove {
        target: u32,
        x: f32,
        y: f32,
        hovering: bool,
        leaving: bool,
    },
    /// Pointer button released at a viewport-relative point.
    PointerUp {
        target: u32,
        x: f32,
        y: f32,
        secondary: bool,
    },
    /// Key pressed (possibly an auto-repeat).
    KeyDown {
        target: u32,
        key_code: u16,
        modifiers: u8,
        repeat: bool,
    },
    /// Key released.
    KeyUp {
        target: u32,
        key_code: u16,
        modifiers: u8,
    },
    /// A control's value changed (host → guest). The renderer resolves the
    /// semantic value (e.g. a slider thumb dragged along its track) and reports
    /// it here; the guest/app writes it into its bound state.
    ValueChanged {
        target: u32,
        value: f32,
    },
    /// A text field's value changed (host → guest). The new text is resolved
    /// from the batch's string section (see the doc comment on this enum).
    TextChanged {
        target: u32,
        value: String,
    },
}

impl Event {
    /// Encode this event as a 16-byte opcode.
    ///
    /// `TextChanged` cannot be fully encoded here — its text lives in the
    /// batch's string section — so this emits the opcode with a zero `B`
    /// offset; the batch-aware `encode_events`/`decode_events` pair in
    /// `pathland-core-transport` writes the text and its real offset.
    pub fn encode(&self) -> Opcode {
        match self {
            Event::PointerDown {
                target,
                x,
                y,
                secondary,
            } => Opcode::new(
                category::EVENT,
                crate::event::POINTER_DOWN,
                flag_for(*secondary, false, false),
                *target,
                x.to_bits(),
                y.to_bits(),
            ),
            Event::PointerMove {
                target,
                x,
                y,
                hovering,
                leaving,
            } => Opcode::new(
                category::EVENT,
                crate::event::POINTER_MOVE,
                flag_for(false, *hovering, *leaving),
                *target,
                x.to_bits(),
                y.to_bits(),
            ),
            Event::PointerUp {
                target,
                x,
                y,
                secondary,
            } => Opcode::new(
                category::EVENT,
                crate::event::POINTER_UP,
                flag_for(*secondary, false, false),
                *target,
                x.to_bits(),
                y.to_bits(),
            ),
            Event::KeyDown {
                target,
                key_code,
                modifiers,
                repeat,
            } => Opcode::new(
                category::EVENT,
                crate::event::KEY_DOWN,
                if *repeat { flag::KEY_REPEAT } else { 0 },
                *target,
                *key_code as u32,
                *modifiers as u32,
            ),
            Event::KeyUp {
                target,
                key_code,
                modifiers,
            } => Opcode::new(
                category::EVENT,
                crate::event::KEY_UP,
                0,
                *target,
                *key_code as u32,
                *modifiers as u32,
            ),
            Event::ValueChanged { target, value } => Opcode::new(
                category::EVENT,
                crate::event::VALUE_CHANGED,
                0,
                *target,
                value.to_bits(),
                0,
            ),
            Event::TextChanged { target, .. } => Opcode::new(
                category::EVENT,
                crate::event::TEXT_CHANGED,
                0,
                *target,
                0,
                0,
            ),
        }
    }
}

/// Build a pointer-opcode flags word from the pointer/hover bits.
#[inline]
fn flag_for(secondary: bool, hovering: bool, leaving: bool) -> u16 {
    let mut flags = 0u16;
    if secondary {
        flags |= flag::POINTER_SECONDARY;
    }
    if hovering {
        flags |= flag::HOVER_ENTER;
    }
    if leaving {
        flags |= flag::HOVER_LEAVE;
    }
    flags
}

/// Error decoding a raw-input event from an opcode.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EventError {
    /// The opcode is not an `EVENT` category opcode.
    NotAnEvent,
    /// The opcode is an EVENT category opcode but an unknown command.
    UnknownCommand,
    /// The opcode is `TEXT_CHANGED`, which needs the batch's string section to
    /// resolve its text; decode it with `pathland-core-transport::decode_events`
    /// instead of a bare opcode.
    NeedsStringSection,
}

impl TryFrom<Opcode> for Event {
    type Error = EventError;

    fn try_from(op: Opcode) -> Result<Self, Self::Error> {
        if op.category() != category::EVENT {
            return Err(EventError::NotAnEvent);
        }
        let flags = op.flags();
        match op.command() {
            crate::event::POINTER_DOWN => Ok(Event::PointerDown {
                target: op.a(),
                x: op.b_f32(),
                y: op.c_f32(),
                secondary: flags & flag::POINTER_SECONDARY != 0,
            }),
            crate::event::POINTER_MOVE => Ok(Event::PointerMove {
                target: op.a(),
                x: op.b_f32(),
                y: op.c_f32(),
                hovering: flags & flag::HOVER_ENTER != 0,
                leaving: flags & flag::HOVER_LEAVE != 0,
            }),
            crate::event::POINTER_UP => Ok(Event::PointerUp {
                target: op.a(),
                x: op.b_f32(),
                y: op.c_f32(),
                secondary: flags & flag::POINTER_SECONDARY != 0,
            }),
            crate::event::KEY_DOWN => Ok(Event::KeyDown {
                target: op.a(),
                key_code: op.b() as u16,
                modifiers: op.c() as u8,
                repeat: flags & flag::KEY_REPEAT != 0,
            }),
            crate::event::KEY_UP => Ok(Event::KeyUp {
                target: op.a(),
                key_code: op.b() as u16,
                modifiers: op.c() as u8,
            }),
            crate::event::VALUE_CHANGED => Ok(Event::ValueChanged {
                target: op.a(),
                value: op.b_f32(),
            }),
            crate::event::TEXT_CHANGED => Err(EventError::NeedsStringSection),
            _ => Err(EventError::UnknownCommand),
        }
    }
}

/// Decode an event opcode for the **shared-memory path**, resolving
/// `TEXT_CHANGED` text from the host → guest event arena (`B` is an absolute
/// offset into that region). Non-text events decode as usual.
///
/// Returns `None` for non-event opcodes, unknown commands, or text events whose
/// offset cannot be resolved (invalid or out of range).
pub fn decode_event(op: &Opcode, event_arena: &[u8]) -> Option<Event> {
    if op.category() != category::EVENT {
        return None;
    }
    if op.command() == crate::event::TEXT_CHANGED {
        let text = crate::arena::get_str(event_arena, op.b()).ok()?;
        return Some(Event::TextChanged {
            target: op.a(),
            value: text.to_string(),
        });
    }
    Event::try_from(*op).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn round_trip(e: Event) -> Event {
        Event::try_from(Opcode::from_bytes(&e.encode().to_bytes())).unwrap()
    }

    #[test]
    fn pointer_down_round_trips() {
        let e = Event::PointerDown {
            target: 5,
            x: 10.0,
            y: 20.0,
            secondary: true,
        };
        assert_eq!(round_trip(e.clone()), e);
    }

    #[test]
    fn pointer_move_round_trips_with_hover_flags() {
        let e = Event::PointerMove {
            target: 5,
            x: 10.0,
            y: 20.0,
            hovering: true,
            leaving: false,
        };
        assert_eq!(round_trip(e.clone()), e);

        let leaving = Event::PointerMove {
            target: 5,
            x: 10.0,
            y: 20.0,
            hovering: false,
            leaving: true,
        };
        assert_eq!(round_trip(leaving.clone()), leaving);
    }

    #[test]
    fn pointer_up_round_trips() {
        let e = Event::PointerUp {
            target: 5,
            x: 10.0,
            y: 20.0,
            secondary: false,
        };
        assert_eq!(round_trip(e.clone()), e);
    }

    #[test]
    fn key_down_round_trips_with_repeat() {
        let e = Event::KeyDown {
            target: 5,
            key_code: 0x41,
            modifiers: 0x01,
            repeat: true,
        };
        assert_eq!(round_trip(e.clone()), e);
    }

    #[test]
    fn key_up_round_trips() {
        let e = Event::KeyUp {
            target: 5,
            key_code: 0x41,
            modifiers: 0x01,
        };
        assert_eq!(round_trip(e.clone()), e);
    }

    #[test]
    fn value_changed_round_trips() {
        let e = Event::ValueChanged {
            target: 7,
            value: 0.625,
        };
        assert_eq!(round_trip(e.clone()), e);
    }

    #[test]
    fn non_event_opcode_is_rejected() {
        let op = Opcode::new(crate::category::TREE, 0x01, 0, 1, 0, 0);
        assert_eq!(Event::try_from(op), Err(EventError::NotAnEvent));
    }

    #[test]
    fn unknown_event_command_is_rejected() {
        // EVENT category with a command that does not exist in the protocol.
        let op = Opcode::new(crate::category::EVENT, 0xFF, 0, 1, 0, 0);
        assert_eq!(Event::try_from(op), Err(EventError::UnknownCommand));
    }

    #[test]
    fn text_changed_needs_string_section() {
        // `TextChanged` is only decodable from a batch (its text lives in the
        // string section); a bare opcode cannot resolve it.
        let op = Opcode::new(crate::category::EVENT, crate::event::TEXT_CHANGED, 0, 7, 0, 0);
        assert_eq!(Event::try_from(op), Err(EventError::NeedsStringSection));
    }

    #[test]
    fn pointer_move_round_trips_with_combined_hover_flags() {
        // Both hovering and leaving set simultaneously must survive the round trip.
        let e = Event::PointerMove {
            target: 5,
            x: 10.0,
            y: 20.0,
            hovering: true,
            leaving: true,
        };
        assert_eq!(round_trip(e.clone()), e);
        // The flags word carries both bits.
        assert_eq!(e.encode().flags(), flag::HOVER_ENTER | flag::HOVER_LEAVE);
    }

    #[test]
    fn matches_conformance_vector_bytes() {
        // EVENT:POINTER_DOWN (target=5, x=10.0, y=20.0)
        let down = Event::PointerDown {
            target: 5,
            x: 10.0,
            y: 20.0,
            secondary: false,
        };
        assert_eq!(
            down.encode().to_bytes(),
            [
                0x03, 0x01, 0x00, 0x00, 0x05, 0x00, 0x00, 0x00, 0x00, 0x00, 0x20, 0x41, 0x00,
                0x00, 0xA0, 0x41,
            ]
        );
    }
}
