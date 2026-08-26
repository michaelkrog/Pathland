//! # pathland-render-html
//!
//! A Pathland renderer that maps opcode frames onto **declarative HTML**
//! elements. Like every Pathland renderer it is a pure function of the opcode
//! stream: it retains only its own decoded output tree (a cache), never
//! application state, and emits `WHAT` the UI is — never layout rects. Native
//! browser layout does the positioning.
//!
//! This is the "server-side render" / remote-projection target (Goal #15): the
//! same opcode stream that drives a native backend drives this HTML document.
//!
//! Frames are **self-contained**: `apply(opcodes, strings)` resolves `SET_TEXT`
//! by a *relative* offset into the frame's own string section (no mirrored
//! arena), and every rendered element carries a stable `data-pathland-id` so a
//! client can hydrate it and apply later deltas in place.

use std::collections::BTreeMap;

use pathland_core::{Opcode, border_edges, category, component_type, property_id, style, tree};

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

    /// The `SELECTED` checked state, decoded from its `U8` wire value.
    fn checked(&self) -> bool {
        self.properties
            .get(&property_id::SELECTED)
            .copied()
            .unwrap_or(0)
            != 0
    }

    /// An `F32` property value, or a default when absent.
    fn f32_property(&self, prop: u16, default: f32) -> f32 {
        self.properties
            .get(&prop)
            .copied()
            .map(f32::from_bits)
            .unwrap_or(default)
    }

    /// Border CSS, decoded from `BORDER_WIDTH`/`BORDER_COLOR`/`BORDER_RADIUS`/
    /// `BORDER_EDGES` (empty when the node has no border).
    fn border_style(&self) -> String {
        let Some(width_bits) = self.properties.get(&property_id::BORDER_WIDTH) else {
            return String::new();
        };
        let width = f32::from_bits(*width_bits);
        let color = self
            .properties
            .get(&property_id::BORDER_COLOR)
            .copied()
            .unwrap_or(0xFF00_0000);
        let edges = self
            .properties
            .get(&property_id::BORDER_EDGES)
            .copied()
            .unwrap_or(border_edges::ALL);

        let (r, g, b, a) = unpack_color(color);
        let mut css = String::new();
        for (flag, side) in [
            (border_edges::TOP, "top"),
            (border_edges::LEADING, "left"),
            (border_edges::BOTTOM, "bottom"),
            (border_edges::TRAILING, "right"),
        ] {
            if edges & flag != 0 {
                css.push_str(&format!("border-{side}:{width}px solid rgba({r},{g},{b},{a});"));
            }
        }
        if let Some(radius) = self.properties.get(&property_id::BORDER_RADIUS) {
            let radius = f32::from_bits(*radius);
            if radius != 0.0 {
                css.push_str(&format!("border-radius:{radius}px;"));
            }
        }
        css
    }
}

/// Unpack a `0xAARRGGBB` color into `(r, g, b, alpha)` where `alpha` is `0..1`.
fn unpack_color(argb: u32) -> (u32, u32, u32, f32) {
    let r = (argb >> 16) & 0xFF;
    let g = (argb >> 8) & 0xFF;
    let b = argb & 0xFF;
    let a = ((argb >> 24) & 0xFF) as f32 / 255.0;
    (r, g, b, a)
}

/// Applies opcode frames to a retained node map and renders it as HTML.
#[derive(Debug, Default)]
pub struct HtmlRenderer {
    nodes: BTreeMap<u32, Node>,
}

impl HtmlRenderer {
    /// Create an empty renderer.
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

    /// Render the subtree rooted at `root` as a full HTML document.
    #[must_use]
    pub fn render(&self, root: u32) -> String {
        let body = self.render_node(root);
        format!(
            "<!DOCTYPE html>\n<html>\n<head>\n<meta charset=\"utf-8\">\n\
             <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n\
             <title>Pathland</title>\n\
             <style>\n\
             body {{ font-family: system-ui, sans-serif; margin: 0; padding: 16px; }}\n\
             button {{ padding: 8px 16px; font: inherit; }}\n\
             .pathland-toggle {{ display: inline-flex; align-items: center; gap: 8px; }}\n\
             .pathland-toggle input[type=\"checkbox\"] {{ accent-color: #2196F3; width: 16px; height: 16px; }}\n\
             .pathland-toggle input[role=\"switch\"] {{ appearance: none; width: 44px; height: 24px; border-radius: 12px; background: #bbb; cursor: pointer; position: relative; transition: background 0.15s; }}\n\
             .pathland-toggle input[role=\"switch\"]:checked {{ background: #2196F3; }}\n\
             .pathland-toggle input[role=\"switch\"]::after {{ content: \"\"; position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: white; transition: left 0.15s; }}\n\
             .pathland-toggle input[role=\"switch\"]:checked::after {{ left: 22px; }}\n\
             .pathland-slider {{ display: inline-flex; align-items: center; gap: 10px; }}\n\
             .pathland-slider input[type=\"range\"] {{ flex: 1; accent-color: #2196F3; }}\n\
             </style>\n</head>\n<body>{body}</body>\n</html>\n"
        )
    }

    /// Render the subtree rooted at `root` as an HTML fragment (no `<html>`).
    #[must_use]
    pub fn render_fragment(&self, root: u32) -> String {
        self.render_node(root)
    }

    fn render_node(&self, id: u32) -> String {
        let Some(node) = self.nodes.get(&id) else {
            return String::new();
        };
        let children: String = node
            .children
            .iter()
            .map(|&child| self.render_node(child))
            .collect();
        let data_id = format!(" data-pathland-id=\"{id}\"");
        let border = node.border_style();

        match node.component {
            component_type::VSTACK => self.wrap_stack(id, "column", node, &children, &border),
            component_type::HSTACK => self.wrap_stack(id, "row", node, &children, &border),
            component_type::TEXT => {
                let text = escape(node.text.as_deref().unwrap_or_default());
                let style = style_attr(&border);
                format!("<span{data_id}{style}>{text}</span>")
            }
            component_type::BUTTON => {
                let text = escape(node.text.as_deref().unwrap_or_default());
                let style = style_attr(&border);
                format!("<button{data_id}{style}>{text}</button>")
            }
            component_type::SWITCH | component_type::CHECKBOX => {
                let role = if node.component == component_type::SWITCH {
                    " role=\"switch\""
                } else {
                    ""
                };
                let checked = if node.checked() { " checked" } else { "" };
                let text = escape(node.text.as_deref().unwrap_or_default());
                let style = style_attr(&border);
                format!(
                    "<label{data_id} class=\"pathland-toggle\"{style}><input type=\"checkbox\"{role}{checked}><span class=\"pathland-text\">{text}</span></label>"
                )
            }
            component_type::SPACER => {
                let style = if border.is_empty() {
                    "flex:1".to_string()
                } else {
                    format!("flex:1;{border}")
                };
                format!("<div{data_id} style=\"{style}\"></div>")
            }
            component_type::SLIDER => {
                let min = node.f32_property(property_id::MIN_VALUE, 0.0);
                let max = node.f32_property(property_id::MAX_VALUE, 1.0);
                let value = node.f32_property(property_id::VALUE, min);
                let text = escape(node.text.as_deref().unwrap_or_default());
                let style = style_attr(&border);
                format!(
                    "<label{data_id} class=\"pathland-slider\"{style}><input type=\"range\" min=\"{min}\" max=\"{max}\" step=\"any\" value=\"{value}\"><span class=\"pathland-text\">{text}</span></label>"
                )
            }
            _ => children,
        }
    }

    fn wrap_stack(&self, id: u32, direction: &str, node: &Node, children: &str, border: &str) -> String {
        let gap = node
            .spacing()
            .map(|s| format!("gap:{s}px;"))
            .unwrap_or_default();
        format!(
            "<div data-pathland-id=\"{id}\" style=\"display:flex;flex-direction:{direction};{gap}align-items:center;{border}\">{children}</div>"
        )
    }
}

/// A `style="…"` attribute for a non-empty CSS fragment.
fn style_attr(css: &str) -> String {
    if css.is_empty() {
        String::new()
    } else {
        format!(" style=\"{css}\"")
    }
}

/// Escape text for inclusion in an HTML body.
fn escape(input: &str) -> String {
    input
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

#[cfg(test)]
mod tests {
    use super::*;
    use pathland_core::Opcode;

    #[test]
    fn renders_vstack_of_text() {
        // Hand-craft a self-contained frame: VSTACK(1) with a TEXT(2) child.
        let mut opcodes = Vec::new();
        let mut strings = Vec::new();
        opcodes.push(Opcode::new(category::TREE, tree::CREATE_NODE, 0, 1, component_type::VSTACK as u32, 0));
        opcodes.push(Opcode::new(category::TREE, tree::INSERT_CHILD, 0, 0, 1, pathland_core::APPEND));
        opcodes.push(Opcode::new(category::TREE, tree::CREATE_NODE, 0, 2, component_type::TEXT as u32, 0));
        opcodes.push(Opcode::new(category::TREE, tree::INSERT_CHILD, 0, 1, 2, pathland_core::APPEND));
        strings.extend_from_slice(&(5u32).to_le_bytes());
        strings.extend_from_slice(b"Hello");
        opcodes.push(Opcode::new(category::STYLE, style::SET_TEXT, 0, 2, 0, 0));

        let mut renderer = HtmlRenderer::new();
        renderer.apply(&opcodes, &strings);

        let html = renderer.render(1);
        assert!(html.contains("<!DOCTYPE html>"));
        assert!(html.contains("flex-direction:column"));
        assert!(html.contains("<span data-pathland-id=\"2\">Hello</span>"));
        assert!(html.contains("data-pathland-id=\"1\""));
    }

    #[test]
    fn escapes_text() {
        assert_eq!(escape("<a & b>"), "&lt;a &amp; b&gt;");
    }

    #[test]
    fn renders_border() {
        use pathland_core::value_type;

        let mut opcodes = Vec::new();
        let mut strings = Vec::new();
        opcodes.push(Opcode::new(
            category::TREE,
            tree::CREATE_NODE,
            0,
            1,
            component_type::TEXT as u32,
            0,
        ));
        strings.extend_from_slice(&(5u32).to_le_bytes());
        strings.extend_from_slice(b"Hello");
        opcodes.push(Opcode::new(category::STYLE, style::SET_TEXT, 0, 1, 0, 0));
        // border: width 2, opaque red, all edges
        opcodes.push(Opcode::new(
            category::STYLE,
            style::SET_PROPERTY,
            0,
            1,
            ((value_type::F32 as u32) << 16) | property_id::BORDER_WIDTH as u32,
            2.0f32.to_bits(),
        ));
        opcodes.push(Opcode::new(
            category::STYLE,
            style::SET_PROPERTY,
            0,
            1,
            ((value_type::COLOR as u32) << 16) | property_id::BORDER_COLOR as u32,
            0xFFFF_0000,
        ));
        opcodes.push(Opcode::new(
            category::STYLE,
            style::SET_PROPERTY,
            0,
            1,
            ((value_type::U32 as u32) << 16) | property_id::BORDER_EDGES as u32,
            border_edges::ALL,
        ));

        let mut renderer = HtmlRenderer::new();
        renderer.apply(&opcodes, &strings);
        let html = renderer.render(1);

        assert!(html.contains("border-top:2px solid rgba(255,0,0,1)"));
        assert!(html.contains("border-left:2px solid rgba(255,0,0,1)"));
        assert!(html.contains("border-bottom:2px solid rgba(255,0,0,1)"));
        assert!(html.contains("border-right:2px solid rgba(255,0,0,1)"));
    }

    #[test]
    fn renders_switch_checked() {
        use pathland_core::value_type;

        let mut opcodes = Vec::new();
        let mut strings = Vec::new();
        opcodes.push(Opcode::new(
            category::TREE,
            tree::CREATE_NODE,
            0,
            1,
            component_type::SWITCH as u32,
            0,
        ));
        strings.extend_from_slice(&(7u32).to_le_bytes());
        strings.extend_from_slice(b"Enabled");
        opcodes.push(Opcode::new(category::STYLE, style::SET_TEXT, 0, 1, 0, 0));
        opcodes.push(Opcode::new(
            category::STYLE,
            style::SET_PROPERTY,
            0,
            1,
            ((value_type::U8 as u32) << 16) | property_id::SELECTED as u32,
            1,
        ));

        let mut renderer = HtmlRenderer::new();
        renderer.apply(&opcodes, &strings);
        let html = renderer.render(1);

        assert!(html.contains("<input type=\"checkbox\" role=\"switch\" checked>"));
        assert!(html.contains("<span class=\"pathland-text\">Enabled</span>"));
    }

    #[test]
    fn renders_checkbox_unchecked() {
        use pathland_core::value_type;

        let mut opcodes = Vec::new();
        let mut strings = Vec::new();
        opcodes.push(Opcode::new(
            category::TREE,
            tree::CREATE_NODE,
            0,
            1,
            component_type::CHECKBOX as u32,
            0,
        ));
        strings.extend_from_slice(&(5u32).to_le_bytes());
        strings.extend_from_slice(b"Email");
        opcodes.push(Opcode::new(category::STYLE, style::SET_TEXT, 0, 1, 0, 0));
        opcodes.push(Opcode::new(
            category::STYLE,
            style::SET_PROPERTY,
            0,
            1,
            ((value_type::U8 as u32) << 16) | property_id::SELECTED as u32,
            0,
        ));

        let mut renderer = HtmlRenderer::new();
        renderer.apply(&opcodes, &strings);
        let html = renderer.render(1);

        assert!(html.contains("<input type=\"checkbox\">"));
        assert!(!html.contains("<input type=\"checkbox\" role=\"switch\""));
        assert!(html.contains("<span class=\"pathland-text\">Email</span>"));
    }

    #[test]
    fn renders_slider() {
        use pathland_core::value_type;

        let mut opcodes = Vec::new();
        let mut strings = Vec::new();
        opcodes.push(Opcode::new(
            category::TREE,
            tree::CREATE_NODE,
            0,
            1,
            component_type::SLIDER as u32,
            0,
        ));
        strings.extend_from_slice(&(6u32).to_le_bytes());
        strings.extend_from_slice(b"Volume");
        opcodes.push(Opcode::new(category::STYLE, style::SET_TEXT, 0, 1, 0, 0));
        opcodes.push(Opcode::new(
            category::STYLE,
            style::SET_PROPERTY,
            0,
            1,
            ((value_type::F32 as u32) << 16) | property_id::MIN_VALUE as u32,
            0.0f32.to_bits(),
        ));
        opcodes.push(Opcode::new(
            category::STYLE,
            style::SET_PROPERTY,
            0,
            1,
            ((value_type::F32 as u32) << 16) | property_id::MAX_VALUE as u32,
            1.0f32.to_bits(),
        ));
        opcodes.push(Opcode::new(
            category::STYLE,
            style::SET_PROPERTY,
            0,
            1,
            ((value_type::F32 as u32) << 16) | property_id::VALUE as u32,
            0.5f32.to_bits(),
        ));

        let mut renderer = HtmlRenderer::new();
        renderer.apply(&opcodes, &strings);
        let html = renderer.render(1);

        assert!(html.contains(
            "<input type=\"range\" min=\"0\" max=\"1\" step=\"any\" value=\"0.5\">"
        ));
        assert!(html.contains("<span class=\"pathland-text\">Volume</span>"));
    }
}
