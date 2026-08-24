//! Consumer: decode Pathland opcode frames into a retained node description.
//!
//! This mirrors `pathland-render-gtk`'s `RenderTree`, but keeps no platform
//! widget — it retains only the declarative structure (`id → component, text,
//! properties, children`) so the frame can be inspected or rebuilt as WaterUI
//! views. Per Pathland's statelessness principle, this is a cache of the
//! renderer's own output, never application state.

use std::collections::BTreeMap;

use pathland_core::{category, component_type, style, tree, Frame};
use waterui_core::AnyView;
use waterui_layout::Spacer;
use waterui_layout::stack::{HStack, HorizontalAlignment, VStack, VerticalAlignment};
use waterui_text::Text;

/// A decoded node in the retained description.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Node {
    /// Protocol component type id (see `pathland_core::component_type`).
    pub component: u16,
    /// Text content set via `STYLE::SET_TEXT`, if any.
    pub text: Option<String>,
    /// Constraint/style properties (`propertyId → value`).
    pub properties: BTreeMap<u16, u32>,
    /// Child node ids in insertion order.
    pub children: Vec<u32>,
}

impl Node {
    fn new(component: u16) -> Self {
        Self {
            component,
            text: None,
            properties: BTreeMap::new(),
            children: Vec::new(),
        }
    }
}

/// Applies opcode frames incrementally into a retained node map.
#[derive(Debug, Default, PartialEq)]
pub struct Consumer {
    nodes: BTreeMap<u32, Node>,
}

impl Consumer {
    /// Create an empty consumer.
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// Apply a frame's opcodes, mutating the retained description.
    pub fn apply(&mut self, frame: &Frame<'_>) {
        for op in frame.opcodes() {
            match op.category() {
                category::TREE => self.apply_tree(op.command(), op),
                category::STYLE => self.apply_style(op.command(), op, frame),
                _ => {}
            }
        }
    }

    fn apply_tree(&mut self, command: u8, op: pathland_core::Opcode) {
        match command {
            tree::CREATE_NODE => {
                let id = op.a();
                let component = op.b() as u16;
                self.nodes.insert(id, Node::new(component));
            }
            tree::DELETE_NODE => {
                self.nodes.remove(&op.a());
            }
            tree::INSERT_CHILD => {
                let (parent, child) = (op.a(), op.b());
                if let Some(node) = self.nodes.get_mut(&parent) {
                    node.children.push(child);
                }
            }
            tree::REMOVE_CHILD => {
                let (parent, child) = (op.a(), op.b());
                if let Some(node) = self.nodes.get_mut(&parent) {
                    node.children.retain(|&c| c != child);
                }
            }
            tree::MOVE_CHILD => {
                let (parent, child, index) = (op.a(), op.b(), op.c());
                if let Some(node) = self.nodes.get_mut(&parent) {
                    node.children.retain(|&c| c != child);
                    let index = (index as usize).min(node.children.len());
                    node.children.insert(index, child);
                }
            }
            _ => {}
        }
    }

    fn apply_style(&mut self, command: u8, op: pathland_core::Opcode, frame: &Frame<'_>) {
        match command {
            style::SET_TEXT => {
                if let Ok(text) = frame.arena_str(op.b()) {
                    if let Some(node) = self.nodes.get_mut(&op.a()) {
                        node.text = Some(text.to_string());
                    }
                }
            }
            style::SET_PROPERTY => {
                let property = (op.b() & 0xFFFF) as u16;
                if let Some(node) = self.nodes.get_mut(&op.a()) {
                    node.properties.insert(property, op.c());
                }
            }
            _ => {}
        }
    }

    /// The retained node at `id`, if present.
    #[must_use]
    pub fn node(&self, id: u32) -> Option<&Node> {
        self.nodes.get(&id)
    }

    /// Reconstruct the subtree rooted at `id` as WaterUI views.
    ///
    /// Component types the consumer does not know how to rebuild are skipped
    /// (and their children dropped). Rebuilt stacks use WaterUI's default
    /// spacing/alignment, since the wire carries only the axis for now.
    #[must_use]
    pub fn rebuild(&self, id: u32) -> Option<AnyView> {
        let node = self.nodes.get(&id)?;
        match node.component {
            component_type::VSTACK => {
                let children: Vec<AnyView> = node
                    .children
                    .iter()
                    .filter_map(|&child| self.rebuild(child))
                    .collect();
                Some(AnyView::new(VStack::new(
                    HorizontalAlignment::Center,
                    10.0,
                    children,
                )))
            }
            component_type::HSTACK => {
                let children: Vec<AnyView> = node
                    .children
                    .iter()
                    .filter_map(|&child| self.rebuild(child))
                    .collect();
                Some(AnyView::new(HStack::new(
                    VerticalAlignment::Center,
                    10.0,
                    children,
                )))
            }
            component_type::TEXT => {
                let content = node.text.clone().unwrap_or_default();
                Some(AnyView::new(Text::new(content)))
            }
            component_type::SPACER => Some(AnyView::new(Spacer::flexible())),
            _ => None,
        }
    }

    /// Number of retained nodes.
    #[must_use]
    pub fn len(&self) -> usize {
        self.nodes.len()
    }

    /// Whether the retained description is empty.
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.nodes.is_empty()
    }
}
