//! Diff-based reactive emitter.
//!
//! The engine holds the application's retained view tree and emits the
//! declarative structure as `TREE`/`STYLE` opcodes into the 16-byte ring
//! buffer (VStack, HStack, Text, spacing, padding, alignment). It does not
//! compute rects or layout; native renderers lay out their own elements.
//!
//! Emission is diff-based: on each `emit` the engine compares the current tree
//! against a snapshot of what it last emitted and writes only the opcodes for
//! nodes that actually changed. An unchanged tree emits zero opcodes.
//!
//! The emit pass performs zero dynamic heap allocations in the steady state.

use alloc::borrow::ToOwned;
use alloc::collections::BTreeMap;
use alloc::string::String;
use alloc::vec::Vec;

use crate::node::{component_type_id, value_type_for, Component, Node};
use crate::Guest;

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
    /// nodeId to last emitted state (a preallocated slab; node ids are dense).
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
    ) -> Result<EmitResult, crate::RingError> {
        self.gen = self.gen.wrapping_add(1);
        let mut out = 0usize;
        self.reconcile_node(root, None, 0, guest, &mut out)?;

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
    ) -> Result<(), crate::RingError> {
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
        let text_changed = match &prev {
            Some(p) => p.text.as_deref() != text_borrowed,
            None => text_borrowed.is_some(),
        };

        match &prev {
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
                if p.component_type != component_type {
                    guest.create_node(node.id, component_type)?;
                    *out += 1;
                }
                if text_changed {
                    if let Some(t) = text_borrowed {
                        guest.set_text(node.id, t)?;
                        *out += 1;
                    }
                }
                for (prop, value) in &node.properties {
                    if p.properties.get(prop) != Some(value) {
                        guest.set_property(node.id, *prop, value_type_for(*prop), *value)?;
                        *out += 1;
                    }
                }
            }
        }

        let mut prev_props = None;
        let mut prev_text = None;
        if let Some(p) = prev {
            if !props_changed {
                prev_props = Some(p.properties);
            }
            if !text_changed {
                prev_text = p.text;
            }
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
