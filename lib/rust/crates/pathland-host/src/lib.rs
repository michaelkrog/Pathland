//! # pathland-host
//!
//! Host-side reader for the Pathland 16-byte opcode ring. Consumes frames from
//! shared linear memory and decodes them into a simple in-memory render tree —
//! the entry point a renderer (DOM, GTK, …) builds on.
//!
//! This crate is a small, `std` convenience layer over `pathland-opcode`; the
//! core decoding lives in the guest/host types there. Here we add a
//! renderer-friendly model: nodes, bounds, and text, produced from a frame of
//! `TREE` / `LAYOUT` / `STYLE` opcodes.

use std::collections::HashMap;

pub use pathland_layout;
pub use pathland_opcode;

use pathland_opcode::category;
use pathland_opcode::component_type;
use pathland_opcode::layout;
use pathland_opcode::style;
use pathland_opcode::tree;
use pathland_opcode::{Frame, Opcode};

/// A decoded node in the host render tree.
#[derive(Debug, Clone, PartialEq)]
pub struct HostNode {
    pub id: u32,
    pub component_type: u16,
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    pub text: Option<String>,
    pub parent: Option<u32>,
    pub children: Vec<u32>,
}

impl Default for HostNode {
    fn default() -> Self {
        Self {
            id: 0,
            component_type: component_type::HSTACK,
            x: 0.0,
            y: 0.0,
            width: 0.0,
            height: 0.0,
            text: None,
            parent: None,
            children: Vec::new(),
        }
    }
}

/// A decoded frame for a renderer.
#[derive(Debug, Default)]
pub struct RenderTree {
    /// nodeId → node. Always contains the root (id 0).
    pub nodes: HashMap<u32, HostNode>,
}

impl RenderTree {
    /// Apply a frame's opcodes to this tree.
    pub fn apply_frame(&mut self, frame: &Frame<'_>) {
        let mut parents: Vec<(u32, u32)> = Vec::new();
        for op in frame.opcodes() {
            match (op.category(), op.command()) {
                (category::TREE, tree::CREATE_NODE) => {
                    let id = op.a();
                    let ty = op.b() as u16;
                    let entry = self.nodes.entry(id).or_default();
                    entry.id = id;
                    entry.component_type = ty;
                }
                (category::TREE, tree::DELETE_NODE) => {
                    self.nodes.remove(&op.a());
                }
                (category::TREE, tree::INSERT_CHILD) => {
                    let (parent, child) = (op.a(), op.b());
                    parents.push((parent, child));
                    if let Some(p) = self.nodes.get_mut(&parent) {
                        p.children.push(child);
                    }
                    if let Some(c) = self.nodes.get_mut(&child) {
                        c.parent = Some(parent);
                    }
                }
                (category::LAYOUT, layout::SET_ORIGIN) => {
                    if let Some(n) = self.nodes.get_mut(&op.a()) {
                        n.x = op.b_f32();
                        n.y = op.c_f32();
                    }
                }
                (category::LAYOUT, layout::SET_SIZE) => {
                    if let Some(n) = self.nodes.get_mut(&op.a()) {
                        n.width = op.b_f32();
                        n.height = op.c_f32();
                    }
                }
                (category::STYLE, style::SET_TEXT) => {
                    if let Some(n) = self.nodes.get_mut(&op.a()) {
                        n.text = frame.arena_str(op.b()).ok().map(|s| s.to_string());
                    }
                }
                (category::STYLE, style::SET_PROPERTY) => {
                    // Properties other than text are not modeled yet.
                    let _ = op;
                }
                _ => {}
            }
        }
        for (parent, child) in parents {
            if let Some(p) = self.nodes.get_mut(&parent) {
                if !p.children.contains(&child) {
                    p.children.push(child);
                }
            }
        }
    }

    /// Look up a node by id.
    pub fn node(&self, id: u32) -> Option<&HostNode> {
        self.nodes.get(&id)
    }

    /// The root node (id 0).
    pub fn root(&self) -> Option<&HostNode> {
        self.nodes.get(&0)
    }
}

/// Decode a frame into a fresh `RenderTree`.
pub fn render_tree_from_frame(frame: &Frame<'_>) -> RenderTree {
    let mut tree = RenderTree::default();
    tree.apply_frame(frame);
    tree
}

/// Convert a single opcode into a human-readable line (debugging aid).
pub fn describe(op: &Opcode) -> String {
    match (op.category(), op.command()) {
        (category::TREE, tree::CREATE_NODE) => {
            format!("TREE:CREATE_NODE id={} type=0x{:04x}", op.a(), op.b() as u16)
        }
        (category::TREE, tree::DELETE_NODE) => format!("TREE:DELETE_NODE id={}", op.a()),
        (category::TREE, tree::INSERT_CHILD) => format!(
            "TREE:INSERT_CHILD parent={} child={} index={}",
            op.a(),
            op.b(),
            op.c()
        ),
        (category::TREE, tree::REMOVE_CHILD) => {
            format!("TREE:REMOVE_CHILD parent={} child={}", op.a(), op.b())
        }
        (category::LAYOUT, layout::SET_ORIGIN) => format!(
            "LAYOUT:SET_ORIGIN id={} x={} y={}",
            op.a(),
            op.b_f32(),
            op.c_f32()
        ),
        (category::LAYOUT, layout::SET_SIZE) => format!(
            "LAYOUT:SET_SIZE id={} w={} h={}",
            op.a(),
            op.b_f32(),
            op.c_f32()
        ),
        (category::STYLE, style::SET_TEXT) => {
            format!("STYLE:SET_TEXT id={} arenaRef={}", op.a(), op.b())
        }
        _ => format!("{:?}", op),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use pathland_layout::view;
    use pathland_layout::{LayoutEngine, Rect};
    use pathland_opcode::{init_memory, Guest, MemoryLayout};

    #[test]
    fn decodes_a_layout_frame() {
        let layout = MemoryLayout::default();
        let mut mem = vec![0u8; layout.total_bytes()];
        init_memory(&mut mem, &layout);

        let mut root = view::vstack(4.0, 8.0, vec![view::text(1, "ab"), view::text(2, "cd")]);
        let mut next = 1;
        view::assign_ids(&mut root, &mut next);

        {
            let mut guest = Guest::new(&mut mem, &layout);
            guest.begin_frame();
            // Emit the full tree structure + layout in one frame.
            emit_tree(&root, &mut guest);
            LayoutEngine::layout(&root, Rect::new(0.0, 0.0, 100.0, 100.0), &mut guest).unwrap();
            guest.end_frame();
        }

        let mut host = pathland_opcode::Host::new(&mut mem, &layout);
        let frames = host.frames();
        let frame = &frames[0];
        let tree = render_tree_from_frame(frame);

        assert_eq!(tree.nodes.len(), 3);
        let root_node = tree.node(1).unwrap();
        assert_eq!(root_node.component_type, component_type::VSTACK);
        let child = tree.node(2).unwrap();
        assert_eq!(child.text.as_deref(), Some("ab"));
        assert_eq!(child.x, 8.0);
        assert_eq!(child.y, 8.0);
        assert_eq!(child.width, 16.0);
    }

    /// Emit TREE opcodes for a node tree (structure only).
    fn emit_tree(node: &pathland_layout::Node, guest: &mut Guest<'_>) {
        let ty = pathland_layout::component_type_id(&node.component);
        guest.create_node(node.id, ty).unwrap();
        if node.id != 0 {
            guest.insert_child(0, node.id, pathland_opcode::APPEND).unwrap();
        }
        for (i, child) in node.children.iter().enumerate() {
            guest.insert_child(node.id, child.id, i as u32).unwrap();
            emit_tree(child, guest);
        }
        if let pathland_layout::Component::Text { text } = &node.component {
            guest.set_text(node.id, text).unwrap();
        }
    }
}
