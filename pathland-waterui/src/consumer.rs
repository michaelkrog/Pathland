//! Consumer: decode Pathland opcode frames into a retained node description.
//!
//! This mirrors `pathland-render-gtk`'s `RenderTree`, but keeps no platform
//! widget — it retains only the declarative structure (`id → component, text,
//! properties, children`) so the frame can be inspected or rebuilt as WaterUI
//! views. Per Pathland's statelessness principle, this is a cache of the
//! renderer's own output, never application state.
//!
//! Frames are **self-contained**: `apply(opcodes, strings)` resolves `SET_TEXT`
//! by a *relative* offset into the frame's own string section, so no mirrored
//! arena is needed.

use std::collections::BTreeMap;

use pathland_core::{Opcode, category, component_type, property_id, style, tree};
use waterui_controls::button::button;
use waterui_controls::slider::slider;
use waterui_controls::toggle::Toggle;
use waterui_core::{AnyView, binding};
use waterui_layout::Spacer;
use waterui_layout::stack::{HStack, HorizontalAlignment, VStack, VerticalAlignment};
use waterui_text::Text;

/// Read a length-prefixed string (`[u32 len][bytes]`) at `offset`.
fn read_str(strings: &[u8], offset: u32) -> Option<&str> {
    let off = offset as usize;
    let len = u32::from_le_bytes(strings.get(off..off + 4)?.try_into().ok()?) as usize;
    std::str::from_utf8(strings.get(off + 4..off + 4 + len)?).ok()
}

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

    /// The `SPACING` constraint, decoded from its `f32` wire value.
    fn spacing(&self) -> Option<f32> {
        self.properties
            .get(&property_id::SPACING)
            .map(|bits| f32::from_bits(*bits))
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

    /// Apply a self-contained frame's opcodes + string section, mutating the
    /// retained description.
    pub fn apply(&mut self, opcodes: &[Opcode], strings: &[u8]) {
        for op in opcodes {
            match op.category() {
                category::TREE => self.apply_tree(op.command(), *op),
                category::STYLE => self.apply_style(op.command(), *op, strings),
                _ => {}
            }
        }
    }

    fn apply_tree(&mut self, command: u8, op: Opcode) {
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

    fn apply_style(&mut self, command: u8, op: Opcode, strings: &[u8]) {
        match command {
            style::SET_TEXT => {
                if let Some(text) = read_str(strings, op.b()) {
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
                    node.spacing().unwrap_or(10.0),
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
                    node.spacing().unwrap_or(10.0),
                    children,
                )))
            }
            component_type::TEXT => {
                let content = node.text.clone().unwrap_or_default();
                Some(AnyView::new(Text::new(content)))
            }
            component_type::BUTTON => {
                let content = node.text.clone().unwrap_or_default();
                Some(AnyView::new(button(content)))
            }
            component_type::SWITCH | component_type::CHECKBOX => {
                let checked = node
                    .properties
                    .get(&property_id::SELECTED)
                    .copied()
                    .unwrap_or(0)
                    != 0;
                let label = node.text.clone().unwrap_or_default();
                let state = binding(checked);
                let toggle = Toggle::new(&state).label(label);
                let toggle = if node.component == component_type::CHECKBOX {
                    toggle.checkbox()
                } else {
                    toggle.switch()
                };
                Some(AnyView::new(toggle))
            }
            component_type::SPACER => Some(AnyView::new(Spacer::flexible())),
            component_type::SLIDER => {
                let value = node
                    .properties
                    .get(&property_id::VALUE)
                    .copied()
                    .map(f32::from_bits)
                    .unwrap_or(0.0);
                let min = node
                    .properties
                    .get(&property_id::MIN_VALUE)
                    .copied()
                    .map(f32::from_bits)
                    .unwrap_or(0.0);
                let max = node
                    .properties
                    .get(&property_id::MAX_VALUE)
                    .copied()
                    .map(f32::from_bits)
                    .unwrap_or(1.0);
                let label = node.text.clone().unwrap_or_default();
                let state = binding(f64::from(value));
                Some(AnyView::new(
                    slider(label, &state).range(f64::from(min)..=f64::from(max)),
                ))
            }
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
