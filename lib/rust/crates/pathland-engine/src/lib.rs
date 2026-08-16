//! # pathland-engine
//!
//! The Pathland **guest engine**. It holds the application's **retained view
//! tree** and emits the **declarative structure** as `TREE`/`STYLE` opcodes into
//! the 16-byte ring buffer — VStack, HStack, Text, spacing, padding, alignment.
//! It does **not** compute rects or layout; native renderers (GTK4 widgets,
//! DOM flexbox) lay out their own native elements from these constraints.
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

use pathland_opcode::component_type;
use pathland_opcode::{value_type, Guest};

pub use pathland_opcode;

// ---------------------------------------------------------------------------
// Retained view tree
// ---------------------------------------------------------------------------

/// A node in the retained view tree (the guest's canonical UI tree).
#[derive(Clone, PartialEq)]
pub struct Node {
    /// Stable node id (the root may be 0 until `assign_ids`).
    pub id: u32,
    pub component: Component,
    pub children: Vec<Node>,
    /// Fixed width or `None` (native renderer sizes naturally).
    pub width: Option<f32>,
    /// Fixed height or `None` (native renderer sizes naturally).
    pub height: Option<f32>,
    /// Style properties applied as `STYLE:SET_PROPERTY` (propertyId → value).
    pub properties: BTreeMap<u16, u32>,
}

impl core::fmt::Debug for Node {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.debug_struct("Node")
            .field("id", &self.id)
            .field("component", &self.component)
            .field("children", &self.children)
            .field("width", &self.width)
            .field("height", &self.height)
            .field("properties", &self.properties)
            .finish()
    }
}

/// Core component types. These describe **structure and constraints only** —
/// no layout math lives here.
#[derive(Clone, PartialEq)]
pub enum Component {
    /// Vertical stack (maps to a native vertical container, e.g. GtkBox/column).
    VStack { spacing: f32, padding: f32 },
    /// Horizontal stack (maps to a native horizontal container, e.g. GtkBox/row).
    HStack { spacing: f32, padding: f32 },
    /// Text leaf.
    Text { text: String },
    /// Flexible spacer.
    Spacer,
}

impl core::fmt::Debug for Component {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            Component::VStack { spacing, padding } => f
                .debug_struct("VStack")
                .field("spacing", spacing)
                .field("padding", padding)
                .finish(),
            Component::HStack { spacing, padding } => f
                .debug_struct("HStack")
                .field("spacing", spacing)
                .field("padding", padding)
                .finish(),
            Component::Text { text } => f.debug_tuple("Text").field(text).finish(),
            Component::Spacer => f.write_str("Spacer"),
        }
    }
}

/// Map a component to its protocol component type id.
pub fn component_type_id(component: &Component) -> u16 {
    match component {
        Component::VStack { .. } => component_type::VSTACK,
        Component::HStack { .. } => component_type::HSTACK,
        Component::Text { .. } => component_type::TEXT,
        Component::Spacer => component_type::SPACER,
    }
}

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
    spacing: Option<f32>,
    padding: Option<f32>,
    width: Option<f32>,
    height: Option<f32>,
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

        let (text_borrowed, spacing, padding) = match &node.component {
            Component::Text { text } => (Some(text.as_str()), None, None),
            Component::VStack { spacing, padding } | Component::HStack { spacing, padding } => {
                (None, Some(*spacing), Some(*padding))
            }
            Component::Spacer => (None, None, None),
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
                self.emit_size_props(node, guest, out)?;
                if let Some(v) = spacing {
                    guest.set_property(
                        node.id,
                        pathland_opcode::property_id::SPACING,
                        value_type::F32,
                        v.to_bits(),
                    )?;
                    *out += 1;
                }
                if let Some(v) = padding {
                    guest.set_property(
                        node.id,
                        pathland_opcode::property_id::PADDING,
                        value_type::F32,
                        v.to_bits(),
                    )?;
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
                // Stack constraint diffs.
                if p.spacing != spacing {
                    if let Some(v) = spacing {
                        guest.set_property(
                            node.id,
                            pathland_opcode::property_id::SPACING,
                            value_type::F32,
                            v.to_bits(),
                        )?;
                        *out += 1;
                    }
                }
                if p.padding != padding {
                    if let Some(v) = padding {
                        guest.set_property(
                            node.id,
                            pathland_opcode::property_id::PADDING,
                            value_type::F32,
                            v.to_bits(),
                        )?;
                        *out += 1;
                    }
                }
                // Size modifier diffs (WIDTH/HEIGHT).
                if p.width != node.width {
                    if let Some(w) = node.width {
                        guest.set_property(
                            node.id,
                            pathland_opcode::property_id::WIDTH,
                            value_type::F32,
                            w.to_bits(),
                        )?;
                        *out += 1;
                    }
                }
                if p.height != node.height {
                    if let Some(h) = node.height {
                        guest.set_property(
                            node.id,
                            pathland_opcode::property_id::HEIGHT,
                            value_type::F32,
                            h.to_bits(),
                        )?;
                        *out += 1;
                    }
                }
                // Generic property diffs (new or changed values only).
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
            spacing,
            padding,
            width: node.width,
            height: node.height,
            properties,
            gen: self.gen,
        });

        for (i, child) in node.children.iter().enumerate() {
            self.reconcile_node(child, Some(node.id), i, guest, out)?;
        }
        Ok(())
    }

    /// Emit WIDTH/HEIGHT size-modifier properties for a brand-new node.
    fn emit_size_props(
        &mut self,
        node: &Node,
        guest: &mut Guest<'_>,
        out: &mut usize,
    ) -> Result<(), pathland_opcode::RingError> {
        if let Some(w) = node.width {
            guest.set_property(
                node.id,
                pathland_opcode::property_id::WIDTH,
                value_type::F32,
                w.to_bits(),
            )?;
            *out += 1;
        }
        if let Some(h) = node.height {
            guest.set_property(
                node.id,
                pathland_opcode::property_id::HEIGHT,
                value_type::F32,
                h.to_bits(),
            )?;
            *out += 1;
        }
        Ok(())
    }
}

/// Value type for a property id. The POC models constraint properties (spacing,
/// padding, sizes) as `F32`; richer types arrive with Goal 2's full DSL.
fn value_type_for(_prop: u16) -> u8 {
    value_type::F32
}

// ---------------------------------------------------------------------------
// SwiftUI-style tree builders
// ---------------------------------------------------------------------------

/// SwiftUI-style tree builders (foundation; full DSL lands in Goal 2).
pub mod view {
    use super::*;

    pub fn vstack(spacing: f32, padding: f32, children: Vec<Node>) -> Node {
        Node {
            id: 0,
            component: Component::VStack { spacing, padding },
            children,
            width: None,
            height: None,
            properties: BTreeMap::new(),
        }
    }

    pub fn hstack(spacing: f32, padding: f32, children: Vec<Node>) -> Node {
        Node {
            id: 0,
            component: Component::HStack { spacing, padding },
            children,
            width: None,
            height: None,
            properties: BTreeMap::new(),
        }
    }

    pub fn text(id: u32, text: &str) -> Node {
        Node {
            id,
            component: Component::Text { text: text.into() },
            children: Vec::new(),
            width: None,
            height: None,
            properties: BTreeMap::new(),
        }
    }

    pub fn spacer(id: u32) -> Node {
        Node {
            id,
            component: Component::Spacer,
            children: Vec::new(),
            width: None,
            height: None,
            properties: BTreeMap::new(),
        }
    }

    /// Assign stable unique sequential ids to a tree (pre-order; root first).
    pub fn assign_ids(root: &mut Node, next: &mut u32) {
        root.id = *next;
        *next += 1;
        for child in &mut root.children {
            assign_ids(child, next);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use alloc::vec;
    use pathland_opcode::category;
    use pathland_opcode::{init_memory, style, tree, Host, MemoryLayout, Opcode};

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

    #[test]
    fn first_emit_produces_full_structure() {
        let mut engine = Engine::new();
        let mut root = view::vstack(4.0, 8.0, vec![view::text(1, "ab"), view::text(2, "cd")]);
        view::assign_ids(&mut root, &mut 1);

        let ops = emit_and_collect(&mut engine, &root);
        // root: create + spacing + padding; each text: create + insert + text
        assert_eq!(ops.len(), 9);
        assert!(ops.iter().any(|o| {
            o.category() == category::TREE
                && o.command() == tree::CREATE_NODE
                && o.a() == 1
                && o.b() as u16 == component_type::VSTACK
        }));
        assert!(ops.iter().any(|o| {
            o.category() == category::STYLE && o.command() == style::SET_TEXT
        }));
        assert!(engine.tracked_nodes() == 3);
    }

    #[test]
    fn property_change_emits_only_delta() {
        let mut engine = Engine::new();
        let mut a = view::vstack(4.0, 8.0, vec![view::text(1, "ab")]);
        view::assign_ids(&mut a, &mut 1);
        emit_and_collect(&mut engine, &a);

        // Signal changed spacing 4 -> 12; ids stay stable.
        a.component = Component::VStack { spacing: 12.0, padding: 8.0 };
        let ops = emit_and_collect(&mut engine, &a);

        assert_eq!(ops.len(), 1, "only the spacing delta should emit");
        assert_eq!(ops[0].category(), category::STYLE);
        assert_eq!(ops[0].command(), style::SET_PROPERTY);
        assert_eq!(ops[0].a(), 1);
        assert_eq!(ops[0].b() as u16, pathland_opcode::property_id::SPACING);
        assert_eq!(ops[0].c_f32(), 12.0);
    }

    #[test]
    fn text_change_emits_single_set_text() {
        let mut engine = Engine::new();
        let mut root = view::vstack(0.0, 0.0, vec![view::text(1, "ab")]);
        view::assign_ids(&mut root, &mut 1);
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
        let mut root = view::vstack(0.0, 0.0, vec![view::text(1, "ab")]);
        view::assign_ids(&mut root, &mut 1);
        emit_and_collect(&mut engine, &root);

        root.children.push(view::text(3, "cd"));
        let ops = emit_and_collect(&mut engine, &root);
        // create node 3 + insert + text = 3
        assert_eq!(ops.len(), 3);
        assert!(ops.iter().any(|o| o.command() == tree::CREATE_NODE && o.a() == 3));
        assert!(ops.iter().any(|o| o.command() == tree::INSERT_CHILD && o.b() == 3));
    }

    #[test]
    fn node_removed_emits_delete() {
        let mut engine = Engine::new();
        let mut root = view::vstack(0.0, 0.0, vec![view::text(1, "ab"), view::text(3, "cd")]);
        view::assign_ids(&mut root, &mut 1);
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
        let mut root = view::hstack(0.0, 0.0, vec![view::text(1, "a"), view::text(2, "b")]);
        view::assign_ids(&mut root, &mut 1);
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
    fn steady_state_emits_zero() {
        let mut engine = Engine::new();
        let mut root = view::vstack(4.0, 8.0, vec![view::text(1, "ab"), view::text(2, "cd")]);
        view::assign_ids(&mut root, &mut 1);
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
        let mut root = view::vstack(4.0, 8.0, vec![view::text(1, "one"), view::text(2, "two")]);
        view::assign_ids(&mut root, &mut 1);

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
