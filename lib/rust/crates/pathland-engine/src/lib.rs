//! # pathland-engine
//!
//! The Pathland **guest engine**. It holds the application's **retained view
//! tree** (built with the SwiftUI-style DSL in `pathland-view`) and emits the
//! **declarative structure** as `TREE`/`STYLE` opcodes into the 16-byte ring
//! buffer — VStack, HStack, Text, spacing, padding, alignment. It does **not**
//! compute rects or layout; native renderers (GTK4 widgets, DOM flexbox) lay
//! out their own native elements from these constraints.
//!
//! ## Reactive emission
//!
//! Emission is **diff-based**: on each `emit` the engine compares the current
//! tree against a snapshot of what it last emitted, and writes only the
//! opcodes for nodes that actually changed. An unchanged tree emits **zero**
//! opcodes. This is what signals in the application drive — a signal marks the
//! tree dirty; `emit` reconciles.
//!
//! Both **property diffs** (`SET_PROPERTY`, `SET_TEXT`) and **structural diffs**
//! (`CREATE_NODE`, `DELETE_NODE`, `INSERT_CHILD`, `REMOVE_CHILD`, `MOVE_CHILD`)
//! are emitted.
//!
//! ## Zero allocation
//!
//! The emit pass performs **zero dynamic heap allocations** in the steady
//! state. The snapshot is a preallocated slab indexed by node id; per-pass
//! bookkeeping uses generation stamps instead of rebuilding maps. Allocations
//! only occur when the tree *grows* (new nodes resize the slab) or a node's
//! property set actually changes.

#![no_std]
#![forbid(unsafe_op_in_unsafe_fn)]

#[cfg(test)]
extern crate std;

extern crate alloc;

use alloc::borrow::ToOwned;
use alloc::collections::BTreeMap;
use alloc::string::String;
use alloc::vec::Vec;

use pathland_opcode::Guest;
use pathland_view::{component_type_id, value_type_for, Node};

pub use pathland_opcode;
pub use pathland_view;

// ---------------------------------------------------------------------------
// Retained view tree (from pathland-view)
// ---------------------------------------------------------------------------

pub use pathland_view::{Component, View, ViewModifier};

// ---------------------------------------------------------------------------
// Snapshot (previous emitted state)
// ---------------------------------------------------------------------------

/// Per-node state the engine remembers from the last emission.
#[derive(Debug, Clone, PartialEq)]
struct SnapshotNode {
    component_type: u16,
    parent: Option<u32>,
    index: usize,
    text: Option<String>,
    properties: BTreeMap<u16, u32>,
    /// Generation stamp set on each emit pass; used to detect deleted nodes.
    gen: u64,
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/// Result of an emission pass.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct EmitResult {
    /// Number of opcodes written to the ring.
    pub opcodes: usize,
}

/// The diff-based reactive emitter.
///
/// `Engine` keeps the snapshot of what was last emitted. Calling `emit` with a
/// (possibly mutated) retained tree writes only the delta opcodes. The steady
/// state of the emit pass allocates nothing.
pub struct Engine {
    /// nodeId → last emitted state (a preallocated slab; node ids are dense).
    snapshot: Vec<Option<SnapshotNode>>,
    /// Monotonic generation stamp for the current pass.
    gen: u64,
}

impl Default for Engine {
    fn default() -> Self {
        Self::new()
    }
}

impl Engine {
    pub fn new() -> Self {
        Self {
            snapshot: Vec::new(),
            gen: 0,
        }
    }

    /// Reconcile `root` against the snapshot, emitting only changed opcodes.
    pub fn emit(
        &mut self,
        root: &Node,
        guest: &mut Guest<'_>,
    ) -> Result<EmitResult, pathland_opcode::RingError> {
        self.gen = self.gen.wrapping_add(1);
        let mut out = 0usize;
        self.reconcile_node(root, None, 0, guest, &mut out)?;

        // Delete any node that existed in the snapshot but was not visited this
        // pass (generation stamp unchanged).
        for (id, slot) in self.snapshot.iter_mut().enumerate() {
            if let Some(s) = slot {
                if s.gen != self.gen {
                    guest.delete_node(id as u32)?;
                    out += 1;
                    *slot = None;
                }
            }
        }
        Ok(EmitResult { opcodes: out })
    }

    /// Number of nodes tracked in the snapshot (diagnostics).
    pub fn tracked_nodes(&self) -> usize {
        self.snapshot.iter().filter(|s| s.is_some()).count()
    }

    fn slot_mut(&mut self, id: u32) -> &mut Option<SnapshotNode> {
        let idx = id as usize;
        if self.snapshot.len() <= idx {
            self.snapshot.resize(idx + 1, None);
        }
        &mut self.snapshot[idx]
    }

    #[allow(clippy::too_many_arguments)]
    fn reconcile_node(
        &mut self,
        node: &Node,
        parent: Option<u32>,
        index: usize,
        guest: &mut Guest<'_>,
        out: &mut usize,
    ) -> Result<(), pathland_opcode::RingError> {
        let component_type = component_type_id(&node.component);

        let text_borrowed = match &node.component {
            Component::Text { text } => Some(text.as_str()),
            Component::Button { label } => Some(label.as_str()),
            _ => None,
        };

        let prev = self.slot_mut(node.id).take();
        let props_changed = match &prev {
            Some(p) => p.properties != node.properties,
            None => !node.properties.is_empty(),
        };
        // Text is owned in the snapshot; compare without cloning.
        let text_changed = match &prev {
            Some(p) => p.text.as_deref() != text_borrowed,
            None => text_borrowed.is_some(),
        };

        match &prev {
            // New node: CREATE_NODE + INSERT_CHILD + all properties/text.
            None => {
                guest.create_node(node.id, component_type)?;
                *out += 1;
                if let Some(p) = parent {
                    guest.insert_child(p, node.id, index as u32)?;
                    *out += 1;
                }
                for (prop, value) in &node.properties {
                    guest.set_property(node.id, *prop, value_type_for(*prop), *value)?;
                    *out += 1;
                }
                if let Some(t) = text_borrowed {
                    guest.set_text(node.id, t)?;
                    *out += 1;
                }
            }
            Some(p) => {
                // Structural changes.
                if p.parent != parent {
                    if let Some(old) = p.parent {
                        guest.remove_child(old, node.id)?;
                        *out += 1;
                    }
                    if let Some(new) = parent {
                        guest.insert_child(new, node.id, index as u32)?;
                        *out += 1;
                    }
                } else if p.index != index {
                    if let Some(par) = parent {
                        guest.move_child(par, node.id, index as u32)?;
                        *out += 1;
                    }
                }
                // Component type changed → recreate.
                if p.component_type != component_type {
                    guest.create_node(node.id, component_type)?;
                    *out += 1;
                }
                // Text diff.
                if text_changed {
                    if let Some(t) = text_borrowed {
                        guest.set_text(node.id, t)?;
                        *out += 1;
                    }
                }
                // Generic property diffs (new or changed values only). This
                // covers stack spacing, styling modifiers (padding, fonts,
                // colors), the `frame` sizing modifier (WIDTH/HEIGHT/ALIGNMENT),
                // and any other modifier applied to the node.
                for (prop, value) in &node.properties {
                    if p.properties.get(prop) != Some(value) {
                        guest.set_property(node.id, *prop, value_type_for(*prop), *value)?;
                        *out += 1;
                    }
                }
            }
        }

        // Store the current state for the next pass. When the property map and
        // text are unchanged, move the previous allocations back so the steady
        // state allocates nothing; otherwise build fresh values.
        let mut prev_props = None;
        let mut prev_text = None;
        if let Some(p) = prev {
            if !props_changed {
                prev_props = Some(p.properties);
            }
            if !text_changed {
                prev_text = p.text;
            }
            // If both moved out, `p` is fully consumed.
            let _ = p;
        }
        let properties = match prev_props {
            Some(props) => props,
            None => node.properties.clone(),
        };
        let text = match prev_text {
            Some(t) => Some(t),
            None => text_borrowed.map(|s| s.to_owned()),
        };
        *self.slot_mut(node.id) = Some(SnapshotNode {
            component_type,
            parent,
            index,
            text,
            properties,
            gen: self.gen,
        });

        for (i, child) in node.children.iter().enumerate() {
            self.reconcile_node(child, Some(node.id), i, guest, out)?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use alloc::vec;
    use pathland_opcode::category;
    use pathland_opcode::{init_memory, style, tree, Host, MemoryLayout, Opcode};
    use pathland_view::{assign_ids, hstack, text, vstack, Text, View, ViewExt};

    fn with_guest() -> (Vec<u8>, MemoryLayout) {
        let layout = MemoryLayout::default();
        let mut mem = vec![0u8; layout.total_bytes()];
        init_memory(&mut mem, &layout);
        (mem, layout)
    }

    fn emit_and_collect(engine: &mut Engine, root: &Node) -> Vec<Opcode> {
        let (mut mem, layout) = with_guest();
        {
            let mut guest = Guest::new(&mut mem, &layout);
            guest.begin_frame();
            engine.emit(root, &mut guest).unwrap();
            guest.end_frame();
        }
        let mut host = Host::new(&mut mem, &layout);
        let frames = host.frames();
        frames
            .first()
            .map(|f| f.opcodes().collect::<Vec<Opcode>>())
            .unwrap_or_default()
    }

    fn built(mut root: Node) -> Node {
        assign_ids(&mut root, &mut 1);
        root
    }

    #[test]
    fn first_emit_produces_full_structure() {
        let mut engine = Engine::new();
        let root = built(
            vstack![text("ab"), text("cd")]
                .spacing(4.0)
                .padding(8.0)
                .build(),
        );

        let ops = emit_and_collect(&mut engine, &root);
        // root: create + spacing + padding; each text: create + insert + text
        assert_eq!(ops.len(), 9);
        assert!(ops.iter().any(|o| {
            o.category() == category::TREE
                && o.command() == tree::CREATE_NODE
                && o.a() == 1
                && o.b() as u16 == pathland_view::component_type_id(&Component::VStack)
        }));
        assert!(ops.iter().any(|o| {
            o.category() == category::STYLE && o.command() == style::SET_TEXT
        }));
        assert!(engine.tracked_nodes() == 3);
    }

    #[test]
    fn property_change_emits_only_delta() {
        let mut engine = Engine::new();
        let mut a = built(
            vstack![text("ab")]
                .spacing(4.0)
                .padding(8.0)
                .build(),
        );
        emit_and_collect(&mut engine, &a);

        // Signal changed spacing 4 -> 12; ids stay stable.
        a.properties
            .insert(pathland_opcode::property_id::SPACING, 12.0f32.to_bits());
        let ops = emit_and_collect(&mut engine, &a);

        assert_eq!(ops.len(), 1, "only the spacing delta should emit");
        assert_eq!(ops[0].category(), category::STYLE);
        assert_eq!(ops[0].command(), style::SET_PROPERTY);
        assert_eq!(ops[0].a(), 1);
        assert_eq!(ops[0].b() as u16, pathland_opcode::property_id::SPACING);
        assert_eq!(ops[0].c_f32(), 12.0);
    }

    #[test]
    fn color_property_emits_color_value_type() {
        let mut engine = Engine::new();
        let root = built(
            Text::new("hi")
                .color(0xFF_0000FF)
                .background(0xFF_EEEEEE)
                .build(),
        );
        let ops = emit_and_collect(&mut engine, &root);
        // create + insert(append) + color + background = 4
        assert_eq!(ops.len(), 4);
        let color_op = ops
            .iter()
            .find(|o| o.b() as u16 == pathland_opcode::property_id::COLOR)
            .unwrap();
        // B = (valueType << 16) | propertyId ; COLOR valueType = 0x07
        assert_eq!(color_op.b() >> 16, pathland_opcode::value_type::COLOR as u32);
        assert_eq!(color_op.c(), 0xFF_0000FF);
    }

    #[test]
    fn text_change_emits_single_set_text() {
        let mut engine = Engine::new();
        let mut root = built(
            vstack![text("ab")]
                .build(),
        );
        emit_and_collect(&mut engine, &root);

        root.children[0].component = Component::Text { text: "xy".into() };
        let ops = emit_and_collect(&mut engine, &root);
        assert_eq!(ops.len(), 1);
        assert_eq!(ops[0].command(), style::SET_TEXT);
        assert_eq!(ops[0].a(), 2);
    }

    #[test]
    fn node_added_emits_create_and_insert() {
        let mut engine = Engine::new();
        let mut root = built(
            vstack![text("ab")]
                .build(),
        );
        emit_and_collect(&mut engine, &root);

        root.children.push(Text::new("cd").build());
        assign_ids(&mut root, &mut 1);
        let ops = emit_and_collect(&mut engine, &root);
        // create node 3 + insert + text = 3
        assert_eq!(ops.len(), 3);
        assert!(ops.iter().any(|o| o.command() == tree::CREATE_NODE && o.a() == 3));
        assert!(ops.iter().any(|o| o.command() == tree::INSERT_CHILD && o.b() == 3));
    }

    #[test]
    fn node_removed_emits_delete() {
        let mut engine = Engine::new();
        let mut root = built(
            vstack![text("ab"), text("cd")]
                .build(),
        );
        emit_and_collect(&mut engine, &root);

        root.children.pop();
        let ops = emit_and_collect(&mut engine, &root);
        assert_eq!(ops.len(), 1);
        assert_eq!(ops[0].command(), tree::DELETE_NODE);
        assert_eq!(ops[0].a(), 3);
    }

    #[test]
    fn child_reordered_emits_move() {
        let mut engine = Engine::new();
        let mut root = built(
            hstack![text("a"), text("b")]
                .build(),
        );
        emit_and_collect(&mut engine, &root);

        root.children.swap(0, 1); // ids stay stable, order changes
        let ops = emit_and_collect(&mut engine, &root);
        // Both children change index; each emits one MOVE_CHILD.
        assert_eq!(ops.len(), 2);
        assert!(ops.iter().all(|o| o.command() == tree::MOVE_CHILD));
        assert!(ops.iter().any(|o| o.b() == 3 && o.c() == 0)); // child 3 -> index 0
        assert!(ops.iter().any(|o| o.b() == 2 && o.c() == 1)); // child 2 -> index 1
    }

    #[test]
    fn frame_emits_width_height_alignment_as_ordinary_properties() {
        use pathland_opcode::size;
        use pathland_view::Align;
        let mut engine = Engine::new();
        let root = built(
            text("x")
                .frame(Some(size::FILL), Some(24.0), Some(Align::Center))
                .build(),
        );
        let ops = emit_and_collect(&mut engine, &root);
        // Root text node (no parent): create + WIDTH + HEIGHT + ALIGNMENT + text = 5
        assert_eq!(ops.len(), 5);
        let width = ops
            .iter()
            .find(|o| o.b() as u16 == pathland_opcode::property_id::WIDTH)
            .unwrap();
        assert_eq!(width.c_f32(), size::FILL);
        let height = ops
            .iter()
            .find(|o| o.b() as u16 == pathland_opcode::property_id::HEIGHT)
            .unwrap();
        assert_eq!(height.c_f32(), 24.0);
        let align = ops
            .iter()
            .find(|o| o.b() as u16 == pathland_opcode::property_id::ALIGNMENT)
            .unwrap();
        assert_eq!(align.c_f32(), Align::Center.value() as f32);
    }

    #[test]
    fn frame_change_emits_only_size_delta() {
        use pathland_view::Align;
        let mut engine = Engine::new();
        let mut root = built(
            text("x")
                .frame(Some(100.0), Some(24.0), Some(Align::Leading))
                .build(),
        );
        emit_and_collect(&mut engine, &root);

        // Change only the width.
        root.properties
            .insert(pathland_opcode::property_id::WIDTH, 120.0f32.to_bits());
        let ops = emit_and_collect(&mut engine, &root);
        assert_eq!(ops.len(), 1, "only the width delta should emit");
        assert_eq!(ops[0].command(), style::SET_PROPERTY);
        assert_eq!(ops[0].b() as u16, pathland_opcode::property_id::WIDTH);
        assert_eq!(ops[0].c_f32(), 120.0);
    }

    #[test]
    fn steady_state_emits_zero() {
        let mut engine = Engine::new();
        let root = built(
            vstack![text("ab"), text("cd")]
                .build(),
        );
        emit_and_collect(&mut engine, &root);

        let ops = emit_and_collect(&mut engine, &root);
        assert!(ops.is_empty(), "unchanged tree must emit zero opcodes");
    }

    #[test]
    fn emit_is_zero_alloc_in_steady_state() {
        use std::alloc::{GlobalAlloc, Layout as AllocLayout};
        use std::cell::Cell;
        use std::thread_local;

        thread_local! {
            static COUNT: Cell<usize> = const { Cell::new(0) };
        }
        struct Counting;
        unsafe impl GlobalAlloc for Counting {
            unsafe fn alloc(&self, l: AllocLayout) -> *mut u8 {
                COUNT.with(|c| c.set(c.get() + 1));
                // SAFETY: forward to the system allocator.
                unsafe { std::alloc::System.alloc(l) }
            }
            unsafe fn dealloc(&self, p: *mut u8, l: AllocLayout) {
                // SAFETY: forward to the system allocator.
                unsafe { std::alloc::System.dealloc(p, l) }
            }
        }
        #[global_allocator]
        static A: Counting = Counting;

        // Build the tree (allocations allowed here) before counting.
        let (mut mem, layout) = with_guest();
        let root = built(
            vstack![text("one"), text("two")]
                .spacing(4.0)
                .padding(8.0)
                .build(),
        );

        let mut engine = Engine::new();
        let mut guest = Guest::new(&mut mem, &layout);

        // Warm up: the first emit grows the snapshot slab.
        guest.begin_frame();
        engine.emit(&root, &mut guest).unwrap();
        guest.end_frame();

        // Steady-state emit must allocate nothing.
        COUNT.with(|c| c.set(0));
        guest.begin_frame();
        engine.emit(&root, &mut guest).unwrap();
        guest.end_frame();
        COUNT.with(|c| {
            assert_eq!(c.get(), 0, "steady-state emit must not allocate");
        });
    }
}
