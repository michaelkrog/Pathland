//! Host-side reader: opcode frames -> native-element description.
//!
//! Consumes frames and builds a **native-element description**: the tree
//! structure (`TREE`) plus constraint properties (`STYLE`) a renderer maps onto
//! that platform's native elements (GTK widgets, DOM elements, HTML).
//!
//! The engine does not compute layout; this stores only what the renderer needs
//! to create native elements and let them lay themselves out.

use std::collections::HashMap;

use pathland_core::{category, component_type, style, tree, value_type, Frame, Opcode};

/// A decoded node in the host's native-element description.
#[derive(Debug, Clone, PartialEq)]
pub struct HostNode {
    pub id: u32,
    pub component_type: u16,
    pub text: Option<String>,
    pub parent: Option<u32>,
    pub children: Vec<u32>,
    /// Constraint properties (propertyId -> value) for native layout/styling.
    pub properties: HashMap<u16, u32>,
    /// `STRING`-valued properties resolved at apply time (propertyId -> text).
    ///
    /// The wire carries strings in the arena / batch string section referenced
    /// by an offset; this map holds the resolved text for `LABEL`, `PROMPT`,
    /// `IMAGE_SOURCE`, `FONT_FAMILY`, … (see `spec/OPCODE.md`).
    pub strings: HashMap<u16, String>,
}

impl HostNode {
    /// A `STRING`-valued property resolved from the frame's string section.
    pub fn string_property(&self, prop: u16) -> Option<&str> {
        self.strings.get(&prop).map(String::as_str)
    }
}

impl Default for HostNode {
    fn default() -> Self {
        Self {
            id: 0,
            component_type: component_type::HSTACK,
            text: None,
            parent: None,
            children: Vec::new(),
            properties: HashMap::new(),
            strings: HashMap::new(),
        }
    }
}

/// The host's native-element description of a rendered tree.
#[derive(Debug, Default)]
pub struct RenderTree {
    /// nodeId -> node.
    pub nodes: HashMap<u32, HostNode>,
}

impl RenderTree {
    /// Apply a frame's opcodes to this tree (a delta).
    pub fn apply_frame(&mut self, frame: &Frame<'_>) {
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
                    if let Some(p) = self.nodes.get_mut(&parent) {
                        if !p.children.contains(&child) {
                            p.children.push(child);
                        }
                    }
                    if let Some(c) = self.nodes.get_mut(&child) {
                        c.parent = Some(parent);
                    }
                }
                (category::TREE, tree::REMOVE_CHILD) => {
                    let (parent, child) = (op.a(), op.b());
                    if let Some(p) = self.nodes.get_mut(&parent) {
                        p.children.retain(|c| *c != child);
                    }
                    if let Some(c) = self.nodes.get_mut(&child) {
                        c.parent = None;
                    }
                }
                (category::TREE, tree::MOVE_CHILD) => {
                    let (parent, child, new_index) = (op.a(), op.b(), op.c() as usize);
                    if let Some(p) = self.nodes.get_mut(&parent) {
                        if let Some(pos) = p.children.iter().position(|c| *c == child) {
                            p.children.remove(pos);
                        }
                        let idx = if new_index == usize::MAX {
                            p.children.len()
                        } else {
                            new_index.min(p.children.len())
                        };
                        p.children.insert(idx, child);
                    }
                }
                (category::STYLE, style::SET_PROPERTY) => {
                    let prop_id = op.b() as u16;
                    let vt = (op.b() >> 16) as u8;
                    if let Some(n) = self.nodes.get_mut(&op.a()) {
                        if vt == value_type::STRING {
                            // Resolve the arena offset into the actual text.
                            if let Ok(text) = frame.arena_str(op.c()) {
                                n.strings.insert(prop_id, text.to_string());
                            }
                        } else {
                            n.properties.insert(prop_id, op.c());
                        }
                    }
                }
                (category::STYLE, style::SET_TEXT) => {
                    if let Some(n) = self.nodes.get_mut(&op.a()) {
                        n.text = frame.arena_str(op.b()).ok().map(|s| s.to_string());
                    }
                }
                (category::STYLE, style::SET_DESIGN_TOKEN) => {
                    // Token overrides are handled by the renderer's theme layer.
                    let _ = op;
                }
                _ => {}
            }
        }
    }

    /// Look up a node by id.
    pub fn node(&self, id: u32) -> Option<&HostNode> {
        self.nodes.get(&id)
    }

    /// The root node: the single node without a parent.
    pub fn root(&self) -> Option<&HostNode> {
        self.nodes.values().find(|n| n.parent.is_none())
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
        (category::TREE, tree::MOVE_CHILD) => format!(
            "TREE:MOVE_CHILD parent={} child={} index={}",
            op.a(),
            op.b(),
            op.c()
        ),
        (category::STYLE, style::SET_PROPERTY) => format!(
            "STYLE:SET_PROPERTY id={} prop=0x{:04x} value=0x{:08x}",
            op.a(),
            op.b() as u16,
            op.c()
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
    use pathland_engine::Engine;
    use pathland_core::{init_memory, Guest, MemoryLayout};
    use pathland_view::{assign_ids, text, vstack, View, ViewExt};

    #[test]
    fn decodes_a_declarative_frame() {
        let layout = MemoryLayout::default();
        let mut mem = vec![0u8; layout.total_bytes()];
        init_memory(&mut mem, &layout);

        let mut root = vstack![text("ab"), text("cd")]
            .spacing(4.0)
            .padding(8.0)
            .build();
        assign_ids(&mut root, &mut 1);

        let mut engine = Engine::new();
        {
            let mut guest = Guest::new(&mut mem, &layout);
            guest.begin_frame();
            engine.emit(&root, &mut guest).unwrap();
            guest.end_frame();
        }

        let mut host = pathland_core::Host::new(&mut mem, &layout);
        let frames = host.frames();
        let frame = &frames[0];
        let tree = render_tree_from_frame(frame);

        assert_eq!(tree.nodes.len(), 3);
        let root_node = tree.node(1).unwrap();
        assert_eq!(root_node.component_type, component_type::VSTACK);
        assert_eq!(
            root_node.properties.get(&pathland_core::property_id::SPACING),
            Some(&4.0f32.to_bits())
        );
        let child = tree.node(2).unwrap();
        assert_eq!(child.text.as_deref(), Some("ab"));
        // No layout/rect data is present.
        assert!(!child.properties.contains_key(&pathland_core::property_id::WIDTH));
    }

    #[test]
    fn applies_a_delta_frame() {
        let layout = MemoryLayout::default();
        let mut mem = vec![0u8; layout.total_bytes()];
        init_memory(&mut mem, &layout);

        let mut engine = Engine::new();
        let mut tree = RenderTree::default();

        let mut a = vstack![text("ab")]
            .spacing(4.0)
            .padding(8.0)
            .build();
        assign_ids(&mut a, &mut 1);
        {
            let mut guest = Guest::new(&mut mem, &layout);
            guest.begin_frame();
            engine.emit(&a, &mut guest).unwrap();
            guest.end_frame();
        }
        {
            let mut host = pathland_core::Host::new(&mut mem, &layout);
            tree.apply_frame(&host.frames()[0]);
        }

        // Delta: spacing 4 -> 12.
        let mut b = vstack![text("ab")]
            .spacing(12.0)
            .padding(8.0)
            .build();
        assign_ids(&mut b, &mut 1);
        {
            let mut guest = Guest::new(&mut mem, &layout);
            guest.begin_frame();
            engine.emit(&b, &mut guest).unwrap();
            guest.end_frame();
        }
        {
            let mut host = pathland_core::Host::new(&mut mem, &layout);
            tree.apply_frame(&host.frames()[0]);
        }

        assert_eq!(tree.nodes.len(), 2);
        let root = tree.node(1).unwrap();
        assert_eq!(
            root.properties.get(&pathland_core::property_id::SPACING),
            Some(&12.0f32.to_bits())
        );
    }

    #[test]
    fn string_properties_resolve_from_frame() {
        use pathland_core::{Guest, Host, MemoryLayout, init_memory, property_id, value_type};

        let layout = MemoryLayout::default();
        let mut mem = vec![0u8; layout.total_bytes()];
        init_memory(&mut mem, &layout);

        {
            let mut guest = Guest::new(&mut mem, &layout);
            guest.begin_frame();
            guest.create_node(1, component_type::IMAGE).unwrap();
            let ref_src = guest.alloc_str("assets/logo.png").unwrap();
            guest
                .set_property(1, property_id::IMAGE_SOURCE, value_type::STRING, ref_src)
                .unwrap();
            guest.end_frame();
        }
        {
            let mut host = Host::new(&mut mem, &layout);
            let mut tree = RenderTree::default();
            tree.apply_frame(&host.frames()[0]);

            let n = tree.node(1).unwrap();
            assert_eq!(n.component_type, component_type::IMAGE);
            // The STRING property is resolved to its text...
            assert_eq!(
                n.string_property(property_id::IMAGE_SOURCE),
                Some("assets/logo.png")
            );
            // ...and is NOT stored as a raw arena offset in `properties`.
            assert!(!n.properties.contains_key(&property_id::IMAGE_SOURCE));
        }
    }
}
