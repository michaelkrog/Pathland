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

use pathland_core::{
    Opcode, border_edges, category, component_type, property_id, style, tree, value_type,
};

mod capi;
mod tw;

/// A decoded node in the retained description.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Node {
    /// Protocol component type id (see `pathland_core::component_type`).
    pub component: u16,
    /// Text content set via `STYLE::SET_TEXT`, if any.
    pub text: Option<String>,
    /// Constraint/style properties (`propertyId → value`).
    pub properties: BTreeMap<u16, u32>,
    /// `STRING`-typed properties resolved at apply time (`propertyId → text`).
    pub strings: BTreeMap<u16, String>,
    /// Date value from `STYLE::SET_DATE`: (days since epoch, millis of day).
    pub date: Option<(i32, u32)>,
    /// Child node ids in insertion order.
    pub children: Vec<u32>,
}

impl Node {
    fn new(component: u16) -> Self {
        Self {
            component,
            text: None,
            properties: BTreeMap::new(),
            strings: BTreeMap::new(),
            date: None,
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

    /// `CONTENT_MARGINS` (F32), if present.
    fn content_margins(&self) -> Option<f32> {
        self.properties
            .get(&property_id::CONTENT_MARGINS)
            .map(|bits| f32::from_bits(*bits))
    }

    /// A raw `U32` property value (no f32 reinterpretation), or a default.
    fn u32_property(&self, prop: u16, default: u32) -> u32 {
        self.properties.get(&prop).copied().unwrap_or(default)
    }

    /// The cross-axis alignment CSS for a stack, from the `ALIGNMENT` enum
    /// (`Leading`=0, `Center`=1, `Trailing`=2, `Fill`=3; default `Fill`).
    fn alignment_css(&self) -> String {
        let idx = self
            .properties
            .get(&property_id::ALIGNMENT)
            .map(|bits| f32::from_bits(*bits) as u8)
            .unwrap_or(3);
        let cross = match idx {
            0 => "flex-start",
            1 => "center",
            2 => "flex-end",
            _ => "stretch",
        };
        format!("align-items:{cross};")
    }

    /// Constraint/style CSS decoded from the node's properties (padding, color,
    /// fonts, opacity, visibility, size, text alignment/truncation). Empty when
    /// the node has no such properties.
    fn style_css(&self) -> String {
        let mut css = String::new();

        // Layout modifiers.
        if let Some(bits) = self.properties.get(&property_id::PADDING) {
            let v = f32::from_bits(*bits);
            if v != 0.0 {
                css.push_str(&format!("padding:{v}px;"));
            }
        }
        for (prop, side) in [
            (property_id::PADDING_TOP, "top"),
            (property_id::PADDING_RIGHT, "right"),
            (property_id::PADDING_BOTTOM, "bottom"),
            (property_id::PADDING_LEFT, "left"),
        ] {
            if let Some(bits) = self.properties.get(&prop) {
                let v = f32::from_bits(*bits);
                if v != 0.0 {
                    css.push_str(&format!("padding-{side}:{v}px;"));
                }
            }
        }
        if let Some(bits) = self.properties.get(&property_id::WIDTH) {
            css.push_str(&format!("width:{};", size_css(f32::from_bits(*bits))));
        }
        if let Some(bits) = self.properties.get(&property_id::HEIGHT) {
            css.push_str(&format!("height:{};", size_css(f32::from_bits(*bits))));
        }

        // Appearance.
        if let Some(bits) = self.properties.get(&property_id::COLOR) {
            css.push_str(&format!("color:{};", rgba(*bits)));
        }
        if let Some(bits) = self.properties.get(&property_id::BACKGROUND_COLOR) {
            css.push_str(&format!("background-color:{};", rgba(*bits)));
        }
        if let Some(bits) = self.properties.get(&property_id::FONT_SIZE) {
            let v = f32::from_bits(*bits);
            if v > 0.0 {
                css.push_str(&format!("font-size:{v}px;"));
            }
        }
        if let Some(bits) = self.properties.get(&property_id::FONT_WEIGHT) {
            let v = f32::from_bits(*bits);
            if v > 0.0 {
                css.push_str(&format!("font-weight:{v};"));
            }
        }
        if let Some(family) = self.strings.get(&property_id::FONT_FAMILY) {
            css.push_str(&format!("font-family:'{}';", family.replace('\'', "\\'")));
        }
        if let Some(bits) = self.properties.get(&property_id::OPACITY) {
            let v = f32::from_bits(*bits);
            if v < 1.0 {
                css.push_str(&format!("opacity:{v};"));
            }
        }
        if let Some(bits) = self.properties.get(&property_id::VISIBLE) {
            if *bits == 0 {
                css.push_str("display:none;");
            }
        }
        if let Some(bits) = self.properties.get(&property_id::Z_INDEX) {
            css.push_str(&format!("z-index:{};", f32::from_bits(*bits) as i32));
        }

        // Text layout.
        if let Some(bits) = self.properties.get(&property_id::LINE_LIMIT) {
            let n = *bits;
            if n != 0 {
                css.push_str(&format!(
                    "display:-webkit-box;-webkit-line-clamp:{n};-webkit-box-orient:vertical;overflow:hidden;"
                ));
            }
        }
        if let Some(bits) = self.properties.get(&property_id::TEXT_ALIGNMENT) {
            let idx = (f32::from_bits(*bits) as u8).min(2) as usize;
            css.push_str(&format!("text-align:{};", ["left", "center", "right"][idx]));
        }
        if self.properties.contains_key(&property_id::TRUNCATION_MODE) {
            css.push_str("text-overflow:ellipsis;overflow:hidden;");
        }

        css
    }

    /// Structural Tailwind classes for this node (Phase 1): padding/size/z-index/
    /// opacity/visibility/position. Decorative props (color, background, fonts,
    /// borders, effects, text layout) stay inline in Phase 1 via [`Self::style_css`].
    fn style_classes(&self) -> String {
        let padding = self
            .properties
            .get(&property_id::PADDING)
            .map(|bits| f32::from_bits(*bits));
        let edges: Vec<(u16, f32)> = [
            (0, property_id::PADDING_TOP),
            (1, property_id::PADDING_RIGHT),
            (2, property_id::PADDING_BOTTOM),
            (3, property_id::PADDING_LEFT),
        ]
        .into_iter()
        .filter_map(|(idx, prop)| {
            self.properties
                .get(&prop)
                .map(|bits| (idx, f32::from_bits(*bits)))
        })
        .collect();
        let margins = self.content_margins();
        let width = self.properties.get(&property_id::WIDTH).map(|b| f32::from_bits(*b));
        let height = self.properties.get(&property_id::HEIGHT).map(|b| f32::from_bits(*b));
        let z_index = self
            .properties
            .get(&property_id::Z_INDEX)
            .map(|bits| f32::from_bits(*bits) as i32);
        let opacity = self
            .properties
            .get(&property_id::OPACITY)
            .map(|bits| f32::from_bits(*bits));
        let visible = self
            .properties
            .get(&property_id::VISIBLE)
            .map(|bits| *bits != 0)
            .unwrap_or(true);
        let position = if let (Some(x), Some(y)) = (
            self.properties.get(&property_id::POSITION_X).map(|b| f32::from_bits(*b)),
            self.properties.get(&property_id::POSITION_Y).map(|b| f32::from_bits(*b)),
        ) {
            Some((x, y))
        } else {
            None
        };

        let mut parts = vec![
            tw::padding_classes(padding, &edges, margins),
            tw::size_classes(width, height),
            tw::structural_classes(z_index, opacity, visible, position),
        ];
        parts.retain(|s| !s.is_empty());
        parts.join(" ")
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

/// A `0xAARRGGBB` color as a CSS `rgba(r,g,b,a)` string.
fn rgba(argb: u32) -> String {
    let (r, g, b, a) = unpack_color(argb);
    format!("rgba({r},{g},{b},{a})")
}

/// A `WIDTH`/`HEIGHT` hint as CSS: `FILL` (-1) → `100%`, `HUG_CONTENT` (-2) →
/// `max-content`, otherwise pixels.
fn size_css(v: f32) -> String {
    if v == pathland_core::size::FILL {
        "100%".to_string()
    } else if v == pathland_core::size::HUG_CONTENT {
        "max-content".to_string()
    } else {
        format!("{v}px")
    }
}

/// The column count of a `GRID` from its `WIDTH` property (cell-axis count);
/// `FILL`/absent → auto-fit.
fn grid_columns(node: &Node) -> Option<u32> {
    let w = node.f32_property(property_id::WIDTH, -1.0);
    if w <= 0.0 {
        None
    } else {
        Some(w.round() as u32)
    }
}

/// Convert days since the Unix epoch (negative = before 1970) to a Gregorian
/// `(year, month, day)` using the civil-from-days algorithm.
fn days_to_date(days: i32) -> (i32, u32, u32) {
    let z = i64::from(days) + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y as i32, m as u32, d as u32)
}

/// Millis of day → `(hours, minutes, seconds)`.
fn millis_to_hms(millis: u32) -> (u32, u32, u32) {
    let total = millis / 1000;
    (total / 3600, (total % 3600) / 60, total % 60)
}

/// Event-surfacing `data-*` attributes for a hydration client, from
/// `EVENT_LISTENERS` / `ACTION_ID` / `BINDING_ID`.
fn event_attrs(node: &Node) -> String {
    let mut attrs = String::new();
    if let Some(m) = node.properties.get(&property_id::EVENT_LISTENERS) {
        if *m != 0 {
            attrs.push_str(&format!(" data-event-listeners=\"{m}\""));
        }
    }
    if let Some(a) = node.properties.get(&property_id::ACTION_ID) {
        attrs.push_str(&format!(" data-action-id=\"{a}\""));
    }
    if let Some(b) = node.properties.get(&property_id::BINDING_ID) {
        attrs.push_str(&format!(" data-binding-id=\"{b}\""));
    }
    attrs
}

/// ARIA attributes from `ROLE` / `STATE` / `ENABLED`.
fn aria_attrs(node: &Node) -> String {
    let mut attrs = String::new();
    if let Some(bits) = node.properties.get(&property_id::ROLE) {
        let role = match f32::from_bits(*bits) as u8 {
            1 => "button",
            2 => "link",
            3 => "heading",
            6 => "textbox",
            7 => "slider",
            8 => "switch",
            9 => "checkbox",
            12 => "tab",
            16 => "scrollbar",
            19 => "menuitem",
            _ => "",
        };
        if !role.is_empty() {
            attrs.push_str(&format!(" role=\"{role}\""));
        }
    }
    if let Some(bits) = node.properties.get(&property_id::STATE) {
        match f32::from_bits(*bits) as u8 {
            1 => attrs.push_str(" aria-disabled=\"true\""),
            2 => attrs.push_str(" aria-current=\"true\""),
            3 => attrs.push_str(" aria-pressed=\"true\""),
            4 => attrs.push_str(" aria-selected=\"true\""),
            _ => {}
        }
    }
    if let Some(bits) = node.properties.get(&property_id::ENABLED) {
        if *bits == 0 {
            attrs.push_str(" disabled");
        }
    }
    attrs
}

/// Decode a self-contained snapshot batch (opcodes + string section) into a
/// **transient** `id → Node` map. The map lives only for the duration of one
/// render call — the renderer retains nothing between calls.
fn decode(opcodes: &[Opcode], strings: &[u8]) -> BTreeMap<u32, Node> {
    let mut nodes = BTreeMap::new();
    for op in opcodes {
        match op.category() {
            category::TREE => apply_tree(&mut nodes, op.command(), *op),
            category::STYLE => apply_style(&mut nodes, op.command(), *op, strings),
            _ => {}
        }
    }
    nodes
}

/// Read a `[u32 len][utf8]` entry from the batch's string section at a relative offset.
fn strings_str(strings: &[u8], offset: u32) -> Option<String> {
    let offset = offset as usize;
    if offset + 4 > strings.len() {
        return None;
    }
    let len = u32::from_le_bytes(strings[offset..offset + 4].try_into().ok()?) as usize;
    let start = offset + 4;
    if start + len > strings.len() {
        return None;
    }
    std::str::from_utf8(&strings[start..start + len]).ok().map(str::to_owned)
}

fn apply_tree(nodes: &mut BTreeMap<u32, Node>, command: u8, op: Opcode) {
    match command {
        tree::CREATE_NODE => {
            let id = op.a();
            let component = op.b() as u16;
            nodes.insert(id, Node::new(component));
        }
        tree::DELETE_NODE => {
            nodes.remove(&op.a());
        }
        tree::INSERT_CHILD => {
            let (parent, child) = (op.a(), op.b());
            if let Some(node) = nodes.get_mut(&parent) {
                node.children.push(child);
            }
        }
        tree::REMOVE_CHILD => {
            let (parent, child) = (op.a(), op.b());
            if let Some(node) = nodes.get_mut(&parent) {
                node.children.retain(|&c| c != child);
            }
        }
        tree::MOVE_CHILD => {
            let (parent, child, index) = (op.a(), op.b(), op.c());
            if let Some(node) = nodes.get_mut(&parent) {
                node.children.retain(|&c| c != child);
                let index = (index as usize).min(node.children.len());
                node.children.insert(index, child);
            }
        }
        _ => {}
    }
}

fn apply_style(nodes: &mut BTreeMap<u32, Node>, command: u8, op: Opcode, strings: &[u8]) {
    match command {
        style::SET_TEXT => {
            if let Some(text) = strings_str(strings, op.b()) {
                if let Some(node) = nodes.get_mut(&op.a()) {
                    node.text = Some(text);
                }
            }
        }
        style::SET_PROPERTY => {
            let property = (op.b() & 0xFFFF) as u16;
            if let Some(node) = nodes.get_mut(&op.a()) {
                let vt = (op.b() >> 16) as u8;
                if vt == value_type::STRING {
                    if let Some(text) = strings_str(strings, op.c()) {
                        node.strings.insert(property, text);
                    }
                } else {
                    node.properties.insert(property, op.c());
                }
            }
        }
        style::SET_DATE => {
            if let Some(node) = nodes.get_mut(&op.a()) {
                // B = days since epoch (I32), C = millis of day (U32).
                node.date = Some((op.b() as i32, op.c()));
            }
        }
        _ => {}
    }
}

/// A **stateless, streaming** HTML renderer. Each render call decodes a
/// self-contained snapshot batch into a transient map, walks it once, and
/// streams HTML text out — zero state retained across calls. A pure function
/// of the opcode stream (Renderer Statelessness).
#[derive(Debug, Default, Clone, Copy)]
pub struct HtmlRenderer;

impl HtmlRenderer {
    /// Create a renderer (stateless; the same value serves every render).
    #[must_use]
    pub fn new() -> Self {
        Self
    }

    /// Render the subtree rooted at `root` as a full HTML document.
    #[must_use]
    pub fn render_document(&self, opcodes: &[Opcode], strings: &[u8], root: u32) -> String {
        let body = self.render_fragment(opcodes, strings, root);
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
             .pathland-textfield {{ display: inline-flex; align-items: center; gap: 8px; }}\n\
             .pathland-textfield input[type=\"text\"] {{ font: inherit; padding: 6px 10px; border: 1px solid #ccc; border-radius: 6px; }}\n\
             .pathland-textfield input[type=\"password\"] {{ font: inherit; padding: 6px 10px; border: 1px solid #ccc; border-radius: 6px; }}\n\
             .pathland-spinner {{ width: 20px; height: 20px; border: 3px solid #e0e0e0; border-top-color: #2196F3; border-radius: 50%; animation: pathland-spin 0.8s linear infinite; }}\n\
             @keyframes pathland-spin {{ to {{ transform: rotate(360deg); }} }}\n\
             .pathland-gauge {{ display: block; height: 10px; width: 100%; background: #eee; border-radius: 5px; overflow: hidden; }}\n\
             .pathland-gauge > div {{ height: 100%; background: #2196F3; transition: width 0.15s; }}\n\
             </style>\n</head>\n<body>{body}</body>\n</html>\n"
        )
    }

    /// Render the subtree rooted at `root` as an HTML fragment (no `<html>`).
    #[must_use]
    pub fn render_fragment(&self, opcodes: &[Opcode], strings: &[u8], root: u32) -> String {
        let nodes = decode(opcodes, strings);
        render_node(&nodes, root)
    }
}

    fn render_node(nodes: &BTreeMap<u32, Node>, id: u32) -> String {
        let Some(node) = nodes.get(&id) else {
            return String::new();
        };
        let children: String = node
            .children
            .iter()
            .map(|&child| render_node(nodes, child))
            .collect();
        let data_id = format!(" data-pathland-id=\"{id}\"");
        let css = format!("{}{}", node.style_css(), node.border_style());
        let style = style_attr(&css);
        let classes = node.style_classes();
        let class = class_attr(&classes);
        let event = event_attrs(node);
        let aria = aria_attrs(node);

        match node.component {
            component_type::VSTACK => wrap_stack(id, "column", node, &children, &css, &classes, &event, &aria),
            component_type::HSTACK => wrap_stack(id, "row", node, &children, &css, &classes, &event, &aria),
            component_type::LAZY_VSTACK => {
                wrap_stack(id, "column", node, &children, &css, &classes, &event, &aria)
            }
            component_type::LAZY_HSTACK => {
                wrap_stack(id, "row", node, &children, &css, &classes, &event, &aria)
            }
            component_type::TEXT => {
                let text = escape(node.text.as_deref().unwrap_or_default());
                format!("<span{data_id}{event}{aria}{class}{style}>{text}</span>")
            }
            component_type::BUTTON => {
                // Composite Override Mode: children present → custom body.
                let body = if node.children.is_empty() {
                    escape(node.text.as_deref().unwrap_or_default())
                } else {
                    children
                };
                format!("<button{data_id}{event}{aria}{class}{style}>{body}</button>")
            }
            component_type::TOGGLE => {
                let toggle_style = node.f32_property(property_id::TOGGLE_STYLE, 0.0).round() as u8;
                let checked = if node.checked() { " checked" } else { "" };
                let body = if node.children.is_empty() {
                    format!(
                        "<span class=\"pathland-text\">{}</span>",
                        escape(node.text.as_deref().unwrap_or_default())
                    )
                } else {
                    format!("<div class=\"pathland-custom-body\">{children}</div>")
                };
                let toggle_class = class_attr(&format!("pathland-toggle {classes}"));
                match toggle_style {
                    1 => format!(
                        "<label{data_id}{event}{aria}{toggle_class}{style}><input type=\"checkbox\"{checked}>{body}</label>"
                    ),
                    2 => {
                        let pressed = if node.checked() { "true" } else { "false" };
                        format!(
                            "<button{data_id}{event}{aria}{class} type=\"button\" aria-pressed=\"{pressed}\"{style}>{body}</button>"
                        )
                    }
                    _ => format!(
                        "<label{data_id}{event}{aria}{toggle_class}{style}><input type=\"checkbox\" role=\"switch\"{checked}>{body}</label>"
                    ),
                }
            }
            component_type::SPACER => {
                format!("<div{data_id}{event}{aria} class=\"flex-1\"{style}></div>")
            }
            component_type::SLIDER => {
                let min = node.f32_property(property_id::MIN_VALUE, 0.0);
                let max = node.f32_property(property_id::MAX_VALUE, 1.0);
                let value = node.f32_property(property_id::VALUE, min);
                let body = if node.children.is_empty() {
                    format!(
                        "<span class=\"pathland-text\">{}</span>",
                        escape(node.text.as_deref().unwrap_or_default())
                    )
                } else {
                    format!("<div class=\"pathland-custom-body\">{children}</div>")
                };
                let slider_class = class_attr(&format!("pathland-slider {classes}"));
                format!(
                    "<label{data_id}{event}{aria}{slider_class}{style}><input type=\"range\" min=\"{min}\" max=\"{max}\" step=\"any\" value=\"{value}\">{body}</label>"
                )
            }
            component_type::TEXT_FIELD => {
                let value = escape(node.text.as_deref().unwrap_or_default());
                let label = escape(
                    node.strings
                        .get(&property_id::LABEL)
                        .map(String::as_str)
                        .unwrap_or_default(),
                );
                let prompt = escape(
                    node.strings
                        .get(&property_id::PROMPT)
                        .map(String::as_str)
                        .unwrap_or_default(),
                );
                let input_type = if node.f32_property(property_id::IS_SECURE, 0.0) != 0.0 {
                    "password"
                } else {
                    "text"
                };
                let textfield_class = class_attr(&format!("pathland-textfield {classes}"));
                format!(
                    "<label{data_id}{event}{aria}{textfield_class}{style}><span class=\"pathland-label\">{label}</span><input type=\"{input_type}\" value=\"{value}\" placeholder=\"{prompt}\"></label>"
                )
            }
            component_type::TEXT_EDITOR => {
                let value = escape(node.text.as_deref().unwrap_or_default());
                format!("<textarea{data_id}{event}{aria}{class} rows=\"4\"{style}>{value}</textarea>")
            }
            component_type::IMAGE => {
                let src = escape(
                    node.strings
                        .get(&property_id::IMAGE_SOURCE)
                        .map(String::as_str)
                        .unwrap_or_default(),
                );
                format!("<img{data_id}{event}{aria}{class} src=\"{src}\"{style}>")
            }
            component_type::COLOR => {
                let color = node.u32_property(property_id::COLOR, 0xFF00_0000);
                // Layout-greedy (SwiftUI Color): expands to the available space
                // unless a size modifier constrains it.
                format!(
                    "<div{data_id}{event}{aria}{class} style=\"flex:1 1 auto;align-self:stretch;background-color:{};{css}\">{children}</div>",
                    rgba(color)
                )
            }
            component_type::SHAPE => {
                let kind = node.f32_property(property_id::SHAPE_KIND, 0.0).round() as u8;
                let fill = node.u32_property(property_id::COLOR, 0xFF00_0000);
                let w = node.f32_property(property_id::WIDTH, 100.0);
                let h = node.f32_property(property_id::HEIGHT, 100.0);
                let base = format!(
                    "width:{};height:{};background-color:{};{css}",
                    size_css(w),
                    size_css(h),
                    rgba(fill)
                );
                let shape_css = match kind {
                    0 | 4 => "border-radius:50%;",
                    2 => {
                        let r = node.f32_property(property_id::BORDER_RADIUS, 8.0);
                        return format!("<div{data_id}{event}{aria}{class} style=\"{base}border-radius:{r}px;\"></div>");
                    }
                    3 => "border-radius:9999px;",
                    5 => {
                        return format!(
                            "<svg{data_id}{event}{aria} width=\"100\" height=\"100\" viewBox=\"0 0 100 100\"><rect width=\"100\" height=\"100\" fill=\"{}\"/></svg>",
                            rgba(fill)
                        );
                    }
                    _ => "",
                };
                format!("<div{data_id}{event}{aria}{class} style=\"{base}{shape_css}\"></div>")
            }
            component_type::DIVIDER => {
                let width = node.f32_property(property_id::BORDER_WIDTH, 1.0);
                let color = node
                    .properties
                    .get(&property_id::COLOR)
                    .copied()
                    .map(rgba)
                    .unwrap_or_else(|| "rgba(0,0,0,0.2)".to_string());
                format!(
                    "<div{data_id}{event}{aria}{class} style=\"height:0;border-top:{width}px solid {color};\"></div>"
                )
            }
            component_type::PROGRESS_VIEW => {
                let indeterminate = node.f32_property(property_id::IS_INDETERMINATE, 0.0) != 0.0
                    || node.f32_property(property_id::PROGRESS, -1.0) < 0.0;
if indeterminate {
                    let spinner_class = class_attr(&format!("pathland-spinner {classes}"));
                    format!("<div{data_id}{spinner_class}{style}></div>")
                } else {
                    let value = node.f32_property(property_id::PROGRESS, 0.0);
                    let max = node.f32_property(property_id::MAX_VALUE, 1.0);
                    format!(
                        "<progress{data_id}{event}{aria}{class} value=\"{value}\" max=\"{max}\"{style}></progress>"
                    )
                }
            }
            component_type::GAUGE => {
                let min = node.f32_property(property_id::MIN_VALUE, 0.0);
                let max = node.f32_property(property_id::MAX_VALUE, 1.0);
                let value = node.f32_property(property_id::VALUE, min);
                let pct = if max > min {
                    ((value - min) / (max - min)).clamp(0.0, 1.0) * 100.0
                } else {
                    0.0
                };
                let gauge_class = class_attr(&format!("pathland-gauge {classes}"));
                format!(
                    "<div{data_id}{event}{aria}{gauge_class}{style}><div style=\"width:{pct}%\"></div></div>"
                )
            }
            component_type::GRID | component_type::LAZY_VGRID | component_type::LAZY_HGRID => {
                let cols = grid_columns(node);
                let grid = tw::grid_classes(cols, node.spacing(), node.component == component_type::LAZY_HGRID);
                let class = class_attr(&grid);
                format!("<div{data_id}{event}{aria}{class}{style}>{children}</div>")
            }
            component_type::SCROLLVIEW => {
                let class = class_attr(&format!("overflow-auto {classes}"));
                format!("<div{data_id}{event}{aria}{class}{style}>{children}</div>")
            }
            component_type::ZSTACK => {
                let inner: String = node
                    .children
                    .iter()
                    .map(|&child| {
                        let child_html = render_node(nodes, child);
                        if child_html.is_empty() {
                            String::new()
                        } else {
                            format!("<div class=\"absolute inset-0\">{child_html}</div>")
                        }
                    })
                    .collect();
                let class = class_attr(&format!("relative w-full h-full {classes}"));
                format!("<div{data_id}{event}{aria}{class}{style}>{inner}</div>")
            }
            component_type::STEPPER => {
                let min = node.f32_property(property_id::MIN_VALUE, 0.0);
                let max = node.f32_property(property_id::MAX_VALUE, 100.0);
                let value = node.f32_property(property_id::VALUE, min);
                let step = node.f32_property(property_id::STEP_VALUE, 1.0);
                format!(
                    "<input{data_id}{event}{aria}{class} type=\"number\" min=\"{min}\" max=\"{max}\" step=\"{step}\" value=\"{value}\"{style}>"
                )
            }
            component_type::DATE_PICKER => {
                let mode = node.f32_property(property_id::DATE_PICKER_MODE, 0.0).round() as u8;
                let (t, value) = match node.date {
                    Some((days, millis)) => match mode {
                        1 => {
                            let (hh, mm, _) = millis_to_hms(millis);
                            ("time", format!("{hh:02}:{mm:02}"))
                        }
                        2 => {
                            let (y, m, d) = days_to_date(days);
                            let (hh, mm, _) = millis_to_hms(millis);
                            (
                                "datetime-local",
                                format!("{y:04}-{m:02}-{d:02}T{hh:02}:{mm:02}"),
                            )
                        }
                        _ => {
                            let (y, m, d) = days_to_date(days);
                            ("date", format!("{y:04}-{m:02}-{d:02}"))
                        }
                    },
                    None => ("date", String::new()),
                };
                format!("<input{data_id}{event}{aria}{class} type=\"{t}\" value=\"{value}\"{style}>")
            }
            component_type::PICKER => {
                let selected = node.u32_property(property_id::SELECTION, 0);
                let options: String = node
                    .children
                    .iter()
                    .enumerate()
                    .map(|(i, &child)| {
                        let label = nodes
                            .get(&child)
                            .and_then(|n| n.text.clone())
                            .unwrap_or_default();
                        let sel = if i as u32 == selected { " selected" } else { "" };
                        format!("<option value=\"{i}\"{sel}>{}</option>", escape(&label))
                    })
                    .collect();
                format!("<select{data_id}{event}{aria}{class}{style}>{options}</select>")
            }
            component_type::MENU => {
                let label = escape(node.text.as_deref().unwrap_or_default());
                format!(
                    "<div{data_id}{event}{aria}{class} role=\"menu\"{style}><button type=\"button\">{label}</button>{children}</div>"
                )
            }
            component_type::COLOR_PICKER => {
                let color = node.u32_property(property_id::COLOR_VALUE, 0xFF00_0000);
                let hex = format!(
                    "#{:02x}{:02x}{:02x}",
                    (color >> 16) & 0xFF,
                    (color >> 8) & 0xFF,
                    color & 0xFF
                );
                format!("<input{data_id}{event}{aria}{class} type=\"color\" value=\"{hex}\"{style}>")
            }
            component_type::COMMENT => String::new(),
            _ => String::new(),
        }
    }

    fn wrap_stack(
        id: u32,
        direction: &str,
        node: &Node,
        children: &str,
        css: &str,
        _classes: &str,
        event: &str,
        aria: &str,
    ) -> String {
        let gap = node.spacing();
        let alignment = node
            .properties
            .get(&property_id::ALIGNMENT)
            .map(|bits| f32::from_bits(*bits) as u8)
            .unwrap_or(3);
        let stack = tw::stack_classes(direction, alignment, gap);
        let class = class_attr(&stack);
        format!(
            "<div data-pathland-id=\"{id}\"{event}{aria}{class} style=\"{css}\">{children}</div>",
        )
    }

/// A `style="…"` attribute for a non-empty CSS fragment.
fn style_attr(css: &str) -> String {
    if css.is_empty() {
        String::new()
    } else {
        format!(" style=\"{css}\"")
    }
}

/// A `class="…"` attribute for a non-empty Tailwind class list.
fn class_attr(classes: &str) -> String {
    let classes = classes.trim();
    if classes.is_empty() {
        String::new()
    } else {
        format!(" class=\"{classes}\"")
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

        let renderer = HtmlRenderer::new();

        let html = renderer.render_document(&opcodes, &strings, 1);
        assert!(html.contains("<!DOCTYPE html>"));
        assert!(html.contains("class=\"flex flex-col\""));
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

        let renderer = HtmlRenderer::new();
        let html = renderer.render_document(&opcodes, &strings, 1);

        assert!(html.contains("border-top:2px solid rgba(255,0,0,1)"));
        assert!(html.contains("border-left:2px solid rgba(255,0,0,1)"));
        assert!(html.contains("border-bottom:2px solid rgba(255,0,0,1)"));
        assert!(html.contains("border-right:2px solid rgba(255,0,0,1)"));
    }

    #[test]
    fn renders_toggle_switch_checked() {
        use pathland_core::value_type;

        let mut opcodes = Vec::new();
        let mut strings = Vec::new();
        opcodes.push(Opcode::new(
            category::TREE,
            tree::CREATE_NODE,
            0,
            1,
            component_type::TOGGLE as u32,
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
            ((value_type::F32 as u32) << 16) | property_id::TOGGLE_STYLE as u32,
            0.0f32.to_bits(),
        ));
        opcodes.push(Opcode::new(
            category::STYLE,
            style::SET_PROPERTY,
            0,
            1,
            ((value_type::U8 as u32) << 16) | property_id::SELECTED as u32,
            1,
        ));

        let renderer = HtmlRenderer::new();
        let html = renderer.render_document(&opcodes, &strings, 1);

        assert!(html.contains("<input type=\"checkbox\" role=\"switch\" checked>"));
        assert!(html.contains("<span class=\"pathland-text\">Enabled</span>"));
    }

    #[test]
    fn renders_toggle_checkbox_unchecked() {
        use pathland_core::value_type;

        let mut opcodes = Vec::new();
        let mut strings = Vec::new();
        opcodes.push(Opcode::new(
            category::TREE,
            tree::CREATE_NODE,
            0,
            1,
            component_type::TOGGLE as u32,
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
            ((value_type::F32 as u32) << 16) | property_id::TOGGLE_STYLE as u32,
            1.0f32.to_bits(),
        ));
        opcodes.push(Opcode::new(
            category::STYLE,
            style::SET_PROPERTY,
            0,
            1,
            ((value_type::U8 as u32) << 16) | property_id::SELECTED as u32,
            0,
        ));

        let renderer = HtmlRenderer::new();
        let html = renderer.render_document(&opcodes, &strings, 1);

        assert!(html.contains("<input type=\"checkbox\">"));
        assert!(!html.contains("<input type=\"checkbox\" role=\"switch\""));
        assert!(html.contains("<span class=\"pathland-text\">Email</span>"));
    }

    #[test]
    fn renders_toggle_button_pressed() {
        use pathland_core::value_type;

        let mut opcodes = Vec::new();
        let mut strings = Vec::new();
        opcodes.push(Opcode::new(
            category::TREE,
            tree::CREATE_NODE,
            0,
            1,
            component_type::TOGGLE as u32,
            0,
        ));
        strings.extend_from_slice(&(4u32).to_le_bytes());
        strings.extend_from_slice(b"Mute");
        opcodes.push(Opcode::new(category::STYLE, style::SET_TEXT, 0, 1, 0, 0));
        opcodes.push(Opcode::new(
            category::STYLE,
            style::SET_PROPERTY,
            0,
            1,
            ((value_type::F32 as u32) << 16) | property_id::TOGGLE_STYLE as u32,
            2.0f32.to_bits(),
        ));
        opcodes.push(Opcode::new(
            category::STYLE,
            style::SET_PROPERTY,
            0,
            1,
            ((value_type::U8 as u32) << 16) | property_id::SELECTED as u32,
            1,
        ));

        let renderer = HtmlRenderer::new();
        let html = renderer.render_document(&opcodes, &strings, 1);

        assert!(html.contains("<button") && html.contains("type=\"button\""));
        assert!(html.contains("aria-pressed=\"true\""));
        assert!(html.contains("<span class=\"pathland-text\">Mute</span>"));
        assert!(html.contains("</button>"));
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

        let renderer = HtmlRenderer::new();
        let html = renderer.render_document(&opcodes, &strings, 1);

        assert!(html.contains(
            "<input type=\"range\" min=\"0\" max=\"1\" step=\"any\" value=\"0.5\">"
        ));
        assert!(html.contains("<span class=\"pathland-text\">Volume</span>"));
    }

    #[test]
    fn renders_text_field() {
        use pathland_core::value_type;

        let mut opcodes = Vec::new();
        let mut strings = Vec::new();
        opcodes.push(Opcode::new(
            category::TREE,
            tree::CREATE_NODE,
            0,
            1,
            component_type::TEXT_FIELD as u32,
            0,
        ));
        // value (node text)
        strings.extend_from_slice(&(3u32).to_le_bytes());
        strings.extend_from_slice(b"Bob");
        opcodes.push(Opcode::new(category::STYLE, style::SET_TEXT, 0, 1, 0, 0));
        // label (STRING property)
        strings.extend_from_slice(&(5u32).to_le_bytes());
        strings.extend_from_slice(b"Name:");
        opcodes.push(Opcode::new(
            category::STYLE,
            style::SET_PROPERTY,
            0,
            1,
            ((value_type::STRING as u32) << 16) | property_id::LABEL as u32,
            7, // relative offset of the label entry in the string section
        ));
        // prompt (STRING property)
        strings.extend_from_slice(&(5u32).to_le_bytes());
        strings.extend_from_slice(b"Enter");
        opcodes.push(Opcode::new(
            category::STYLE,
            style::SET_PROPERTY,
            0,
            1,
            ((value_type::STRING as u32) << 16) | property_id::PROMPT as u32,
            16, // relative offset of the prompt entry
        ));

        let renderer = HtmlRenderer::new();
        let html = renderer.render_document(&opcodes, &strings, 1);

        assert!(html.contains("class=\"pathland-textfield\""));
        assert!(html.contains("<span class=\"pathland-label\">Name:</span>"));
        assert!(html.contains(
            "<input type=\"text\" value=\"Bob\" placeholder=\"Enter\">"
        ));
    }

    #[test]
    fn applies_network_decoded_frame() {
        // The renderer consumes a self-contained opcode + string section directly
        // (the transport layer's encode/decode round-trip is covered by the
        // transport crate's own tests).
        use pathland_core_transport::encode_frame;

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

        let bytes = encode_frame(&opcodes, &strings);
        assert!(bytes.len() > 16);

        let renderer = HtmlRenderer::new();
        let html = renderer.render_document(&opcodes, &strings, 1);
        assert!(html.contains("<span data-pathland-id=\"1\">Hello</span>"));
    }

    #[test]
    fn days_to_date_maps_epoch_and_pre_epoch() {
        assert_eq!(days_to_date(0), (1970, 1, 1));
        assert_eq!(days_to_date(19_723), (2024, 1, 1));
        // Pre-1970 (negative days).
        assert_eq!(days_to_date(-1), (1969, 12, 31));
        assert_eq!(days_to_date(-365), (1969, 1, 1));
    }

    #[test]
    fn renders_image_with_source() {
        use pathland_core::value_type;

        let mut opcodes = Vec::new();
        let mut strings = Vec::new();
        opcodes.push(Opcode::new(category::TREE, tree::CREATE_NODE, 0, 1, component_type::IMAGE as u32, 0));
        strings.extend_from_slice(&(15u32).to_le_bytes());
        strings.extend_from_slice(b"assets/logo.png");
        opcodes.push(Opcode::new(
            category::STYLE,
            style::SET_PROPERTY,
            0,
            1,
            ((value_type::STRING as u32) << 16) | property_id::IMAGE_SOURCE as u32,
            0,
        ));

        let renderer = HtmlRenderer::new();
        let html = renderer.render_document(&opcodes, &strings, 1);
        assert!(html.contains("<img data-pathland-id=\"1\" src=\"assets/logo.png\">"));
    }

    #[test]
    fn renders_grid_with_columns() {
        use pathland_core::value_type;

        let mut opcodes = Vec::new();
        opcodes.push(Opcode::new(category::TREE, tree::CREATE_NODE, 0, 1, component_type::GRID as u32, 0));
        opcodes.push(Opcode::new(
            category::STYLE,
            style::SET_PROPERTY,
            0,
            1,
            ((value_type::F32 as u32) << 16) | property_id::WIDTH as u32,
            2.0f32.to_bits(),
        ));
        opcodes.push(Opcode::new(category::TREE, tree::CREATE_NODE, 0, 2, component_type::TEXT as u32, 0));
        opcodes.push(Opcode::new(category::TREE, tree::INSERT_CHILD, 0, 1, 2, 0));

        let renderer = HtmlRenderer::new();
        let html = renderer.render_document(&opcodes, &[], 1);
        assert!(html.contains("class=\"grid grid-cols-2\""));
    }

    #[test]
    fn renders_scrollview_and_zstack_containers() {
        let mut opcodes = Vec::new();
        opcodes.push(Opcode::new(category::TREE, tree::CREATE_NODE, 0, 1, component_type::SCROLLVIEW as u32, 0));
        opcodes.push(Opcode::new(category::TREE, tree::CREATE_NODE, 0, 2, component_type::TEXT as u32, 0));
        opcodes.push(Opcode::new(category::TREE, tree::INSERT_CHILD, 0, 1, 2, 0));
        opcodes.push(Opcode::new(category::TREE, tree::CREATE_NODE, 0, 3, component_type::ZSTACK as u32, 0));
        opcodes.push(Opcode::new(category::TREE, tree::CREATE_NODE, 0, 4, component_type::TEXT as u32, 0));
        opcodes.push(Opcode::new(category::TREE, tree::INSERT_CHILD, 0, 3, 4, 0));

        let renderer = HtmlRenderer::new();
        let scroll = renderer.render_document(&opcodes, &[], 1);
        assert!(scroll.contains("class=\"overflow-auto\""));
        assert!(scroll.contains("<span data-pathland-id=\"2\"></span>"));
        let zstack = renderer.render_document(&opcodes, &[], 3);
        assert!(zstack.contains("class=\"relative w-full h-full\""));
        assert!(zstack.contains("class=\"absolute inset-0\""));
    }

    #[test]
    fn renders_progress_view_and_spinner() {
        use pathland_core::value_type;

        let mut opcodes = Vec::new();
        opcodes.push(Opcode::new(category::TREE, tree::CREATE_NODE, 0, 1, component_type::PROGRESS_VIEW as u32, 0));
        opcodes.push(Opcode::new(
            category::STYLE,
            style::SET_PROPERTY,
            0,
            1,
            ((value_type::F32 as u32) << 16) | property_id::PROGRESS as u32,
            0.5f32.to_bits(),
        ));
        opcodes.push(Opcode::new(category::TREE, tree::CREATE_NODE, 0, 2, component_type::PROGRESS_VIEW as u32, 0));
        opcodes.push(Opcode::new(
            category::STYLE,
            style::SET_PROPERTY,
            0,
            2,
            ((value_type::U8 as u32) << 16) | property_id::IS_INDETERMINATE as u32,
            1,
        ));

        let renderer = HtmlRenderer::new();
        assert!(renderer.render_document(&opcodes, &[], 1).contains("<progress"));
        assert!(renderer.render_document(&opcodes, &[], 2).contains("pathland-spinner"));
    }

    #[test]
    fn renders_date_picker_from_set_date() {
        let mut opcodes = Vec::new();
        opcodes.push(Opcode::new(category::TREE, tree::CREATE_NODE, 0, 1, component_type::DATE_PICKER as u32, 0));
        // days=19723 → 2024-01-01; millis of day = 0.
        opcodes.push(Opcode::new(category::STYLE, style::SET_DATE, 0, 1, 19_723, 0));

        let renderer = HtmlRenderer::new();
        let html = renderer.render_document(&opcodes, &[], 1);
        assert!(html.contains("<input data-pathland-id=\"1\" type=\"date\" value=\"2024-01-01\">"));
    }

    #[test]
    fn renders_picker_from_child_options() {
        use pathland_core::value_type;

        let mut opcodes = Vec::new();
        opcodes.push(Opcode::new(category::TREE, tree::CREATE_NODE, 0, 1, component_type::PICKER as u32, 0));
        let mut strings = Vec::new();
        strings.extend_from_slice(&(3u32).to_le_bytes());
        strings.extend_from_slice(b"Red");
        opcodes.push(Opcode::new(category::TREE, tree::CREATE_NODE, 0, 2, component_type::TEXT as u32, 0));
        opcodes.push(Opcode::new(category::STYLE, style::SET_TEXT, 0, 2, 0, 0));
        opcodes.push(Opcode::new(category::TREE, tree::INSERT_CHILD, 0, 1, 2, 0));
        opcodes.push(Opcode::new(
            category::STYLE,
            style::SET_PROPERTY,
            0,
            1,
            ((value_type::U32 as u32) << 16) | property_id::SELECTION as u32,
            0,
        ));

        let renderer = HtmlRenderer::new();
        let html = renderer.render_document(&opcodes, &strings, 1);
        assert!(html.contains("<select"));
        assert!(html.contains("<option value=\"0\" selected>Red</option>"));
    }

    #[test]
    fn renders_color_picker_and_color_node() {
        use pathland_core::value_type;

        let mut opcodes = Vec::new();
        opcodes.push(Opcode::new(category::TREE, tree::CREATE_NODE, 0, 1, component_type::COLOR_PICKER as u32, 0));
        opcodes.push(Opcode::new(
            category::STYLE,
            style::SET_PROPERTY,
            0,
            1,
            ((value_type::COLOR as u32) << 16) | property_id::COLOR_VALUE as u32,
            0xFF00_00FF,
        ));
        opcodes.push(Opcode::new(category::TREE, tree::CREATE_NODE, 0, 2, component_type::COLOR as u32, 0));
        opcodes.push(Opcode::new(
            category::STYLE,
            style::SET_PROPERTY,
            0,
            2,
            ((value_type::COLOR as u32) << 16) | property_id::COLOR as u32,
            0xFF00_00FF,
        ));

        let renderer = HtmlRenderer::new();
        assert!(renderer.render_document(&opcodes, &[], 1).contains("<input data-pathland-id=\"1\" type=\"color\" value=\"#0000ff\">"));
        assert!(renderer.render_document(&opcodes, &[], 2).contains("background-color:rgba(0,0,255,1)"));
    }

    #[test]
    fn button_composite_renders_custom_body() {
        let mut opcodes = Vec::new();
        opcodes.push(Opcode::new(category::TREE, tree::CREATE_NODE, 0, 1, component_type::BUTTON as u32, 0));
        opcodes.push(Opcode::new(category::TREE, tree::CREATE_NODE, 0, 2, component_type::TEXT as u32, 0));
        opcodes.push(Opcode::new(category::TREE, tree::INSERT_CHILD, 0, 1, 2, 0));
        let mut strings = Vec::new();
        strings.extend_from_slice(&(1u32).to_le_bytes());
        strings.extend_from_slice(b"A");
        opcodes.push(Opcode::new(category::STYLE, style::SET_TEXT, 0, 2, 0, 0));

        let renderer = HtmlRenderer::new();
        let html = renderer.render_document(&opcodes, &strings, 1);
        assert!(html.contains("<button data-pathland-id=\"1\"><span data-pathland-id=\"2\">A</span></button>"));
    }

    #[test]
    fn event_attrs_and_aria_are_emitted() {
        use pathland_core::value_type;

        let mut opcodes = Vec::new();
        opcodes.push(Opcode::new(category::TREE, tree::CREATE_NODE, 0, 1, component_type::BUTTON as u32, 0));
        opcodes.push(Opcode::new(
            category::STYLE,
            style::SET_PROPERTY,
            0,
            1,
            ((value_type::U32 as u32) << 16) | property_id::EVENT_LISTENERS as u32,
            pathland_core::listener::POINTER_DOWN | pathland_core::listener::POINTER_UP,
        ));
        opcodes.push(Opcode::new(
            category::STYLE,
            style::SET_PROPERTY,
            0,
            1,
            ((value_type::U32 as u32) << 16) | property_id::ACTION_ID as u32,
            42,
        ));
        opcodes.push(Opcode::new(
            category::STYLE,
            style::SET_PROPERTY,
            0,
            1,
            ((value_type::U8 as u32) << 16) | property_id::ENABLED as u32,
            0,
        ));

        let renderer = HtmlRenderer::new();
        let html = renderer.render_document(&opcodes, &[], 1);
        assert!(html.contains("data-event-listeners=\"5\""));
        assert!(html.contains("data-action-id=\"42\""));
        assert!(html.contains(" disabled"));
    }

    #[test]
    fn alignment_maps_to_flex_cross_axis() {
        use pathland_core::value_type;

        let mut opcodes = Vec::new();
        opcodes.push(Opcode::new(category::TREE, tree::CREATE_NODE, 0, 1, component_type::VSTACK as u32, 0));
        opcodes.push(Opcode::new(
            category::STYLE,
            style::SET_PROPERTY,
            0,
            1,
            ((value_type::F32 as u32) << 16) | property_id::ALIGNMENT as u32,
            0.0f32.to_bits(), // Leading
        ));

        let renderer = HtmlRenderer::new();
        let html = renderer.render_document(&opcodes, &[], 1);
        assert!(html.contains("class=\"flex flex-col items-start\""));
    }

    #[test]
    fn text_field_secure_uses_password_input() {
        use pathland_core::value_type;

        let mut opcodes = Vec::new();
        opcodes.push(Opcode::new(category::TREE, tree::CREATE_NODE, 0, 1, component_type::TEXT_FIELD as u32, 0));
        opcodes.push(Opcode::new(
            category::STYLE,
            style::SET_PROPERTY,
            0,
            1,
            ((value_type::U8 as u32) << 16) | property_id::IS_SECURE as u32,
            1,
        ));

        let renderer = HtmlRenderer::new();
        let html = renderer.render_document(&opcodes, &[], 1);
        assert!(html.contains("<input type=\"password\""));
    }

    #[test]
    fn style_css_applies_color_font_and_visibility() {
        use pathland_core::value_type;

        let mut opcodes = Vec::new();
        opcodes.push(Opcode::new(category::TREE, tree::CREATE_NODE, 0, 1, component_type::TEXT as u32, 0));
        opcodes.push(Opcode::new(
            category::STYLE,
            style::SET_PROPERTY,
            0,
            1,
            ((value_type::COLOR as u32) << 16) | property_id::COLOR as u32,
            0xFF11_2233,
        ));
        opcodes.push(Opcode::new(
            category::STYLE,
            style::SET_PROPERTY,
            0,
            1,
            ((value_type::F32 as u32) << 16) | property_id::FONT_SIZE as u32,
            18.0f32.to_bits(),
        ));
        opcodes.push(Opcode::new(
            category::STYLE,
            style::SET_PROPERTY,
            0,
            1,
            ((value_type::U8 as u32) << 16) | property_id::VISIBLE as u32,
            0,
        ));

        let renderer = HtmlRenderer::new();
        let html = renderer.render_document(&opcodes, &[], 1);
        assert!(html.contains("color:rgba(17,34,51,1)"));
        assert!(html.contains("font-size:18px"));
        assert!(html.contains("display:none"));
    }

    #[test]
    fn safelist_covers_every_structural_class() {
        let list = tw::safelist();
        for class in [
            "flex",
            "flex-col",
            "flex-row",
            "items-start",
            "items-center",
            "items-end",
            "gap-[12px]",
            "p-[8px]",
            "pt-[4px]",
            "w-full",
            "w-fit",
            "w-[320px]",
            "h-[200px]",
            "flex-1",
            "grid",
            "grid-cols-3",
            "grid-flow-col",
            "overflow-auto",
            "absolute",
            "relative",
            "inset-0",
            "hidden",
            "z-[5]",
            "opacity-[0.5]",
            "left-[16px]",
            "top-[8px]",
        ] {
            assert!(list.contains(class), "safelist missing {class}");
        }
    }

    #[test]
    fn renders_stack_with_gap_and_structural_child_classes() {
        use pathland_core::value_type;

        let mut opcodes = Vec::new();
        let mut strings = Vec::new();
        opcodes.push(Opcode::new(category::TREE, tree::CREATE_NODE, 0, 1, component_type::VSTACK as u32, 0));
        opcodes.push(Opcode::new(
            category::STYLE,
            style::SET_PROPERTY,
            0,
            1,
            ((value_type::F32 as u32) << 16) | property_id::SPACING as u32,
            12.0f32.to_bits(),
        ));
        opcodes.push(Opcode::new(category::TREE, tree::CREATE_NODE, 0, 2, component_type::TEXT as u32, 0));
        opcodes.push(Opcode::new(category::TREE, tree::INSERT_CHILD, 0, 1, 2, 0));
        opcodes.push(Opcode::new(
            category::STYLE,
            style::SET_PROPERTY,
            0,
            2,
            ((value_type::F32 as u32) << 16) | property_id::PADDING as u32,
            8.0f32.to_bits(),
        ));
        strings.extend_from_slice(&(2u32).to_le_bytes());
        strings.extend_from_slice(b"Hi");
        opcodes.push(Opcode::new(category::STYLE, style::SET_TEXT, 0, 2, 0, 0));

        let html = HtmlRenderer::new().render_document(&opcodes, &strings, 1);
        assert!(html.contains("class=\"flex flex-col gap-[12px]\""));
        assert!(html.contains("class=\"p-[8px]\""));
    }
}
