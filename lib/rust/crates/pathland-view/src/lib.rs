//! # pathland-view
//!
//! The Pathland SwiftUI-style view DSL. Core components (`VStack`, `HStack`,
//! `Text`) and chainable modifiers (`spacing`, `padding`, `font_size`, `color`,
//! `background`) build a retained **view tree** (`Node`) that
//! `pathland-engine` turns into declarative `TREE`/`STYLE` opcodes.
//!
//! ## Building a tree
//!
//! Use the `vstack!`/`hstack!` macros (which box children for you) with the
//! free `text`/`spacer` functions, then chain modifiers and `build()`:
//!
//! ```
//! use pathland_view::{vstack, hstack, text, View, ViewExt};
//!
//! let node = vstack![
//!     text("a"),
//!     hstack![text("b")],
//! ]
//! .padding(16.0)
//! .build();
//! # let _ = node;
//! ```
//!
//! ## Decoupled modifiers
//!
//! Modifiers are **decoupled from views** (SwiftUI-style): any modifier applies
//! to any view via the blanket `View::modifier`, and application code composes
//! **custom modifiers** from the core ones by implementing `ViewModifier`:
//!
//! ```
//! use pathland_view::{View, ViewExt, ViewModifier, Node, Padding, Background};
//!
//! struct Card;
//! impl ViewModifier for Card {
//!     fn apply(&self, node: &mut Node) {
//!         Padding(16.0).apply(node);
//!         Background(0xFF_EEEEEE).apply(node);
//!     }
//! }
//!
//! // Works on any view:
//! let a = pathland_view::text("A").modifier(Card);
//! let b = pathland_view::vstack![].modifier(Card);
//! # let _ = (a, b);
//! ```
//!
//! Unsupported combinations are **allowed and ignored**: the modifier emits its
//! property and the renderer ignores what it cannot apply.
//!
//! ## No layout math
//!
//! The DSL describes structure + constraint properties only. It never computes
//! bounds; native renderers lay out their own elements.
//!
//! This crate is `no_std` + `alloc`.

#![no_std]
#![forbid(unsafe_op_in_unsafe_fn)]

#[cfg(test)]
extern crate std;

extern crate alloc;

use alloc::collections::BTreeMap;
use alloc::string::String;
use alloc::vec::Vec;

/// Re-exported for `vstack!`/`hstack!` macro hygiene (`$crate::Box`).
pub use alloc::boxed::Box;
/// Re-exported for `vstack!`/`hstack!` macro hygiene (`$crate::vec!`).
pub use alloc::vec;

use pathland_opcode::component_type;
use pathland_opcode::property_id;

pub use pathland_opcode;

// ---------------------------------------------------------------------------
// Core component macros + free functions
// ---------------------------------------------------------------------------

/// Build a vertical stack from a comma-separated list of views.
///
/// Each child is boxed automatically, so children can mix `Text`, `HStack`,
/// modified views, or custom `View` implementations. Nested stacks work:
///
/// ```
/// use pathland_view::{vstack, text, View};
/// let node = vstack![text("a"), text("b")].build();
/// # let _ = node;
/// ```
#[macro_export]
macro_rules! vstack {
    ($($child:expr),* $(,)?) => {
        $crate::VStack::new().children($crate::vec![$($crate::Box::new($child)),*])
    };
}

/// Build a horizontal stack from a comma-separated list of views.
///
/// See [`vstack!`] for details.
#[macro_export]
macro_rules! hstack {
    ($($child:expr),* $(,)?) => {
        $crate::HStack::new().children($crate::vec![$($crate::Box::new($child)),*])
    };
}

/// A text view from a string literal (shorthand for [`Text::new`]).
pub fn text(content: &str) -> Text {
    Text::new(content)
}

/// A flexible spacer (shorthand for [`Spacer`]).
pub fn spacer() -> Spacer {
    Spacer
}

// ---------------------------------------------------------------------------
// Retained view tree
// ---------------------------------------------------------------------------

/// A node in the retained view tree (the application's canonical UI tree).
#[derive(Clone, PartialEq)]
pub struct Node {
    /// Stable node id (0 until `assign_ids`).
    pub id: u32,
    pub component: Component,
    pub children: Vec<Node>,
    /// Constraint/style properties (propertyId → value) emitted as
    /// `STYLE:SET_PROPERTY`.
    pub properties: BTreeMap<u16, u32>,
}

impl core::fmt::Debug for Node {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.debug_struct("Node")
            .field("id", &self.id)
            .field("component", &self.component)
            .field("children", &self.children)
            .field("properties", &self.properties)
            .finish()
    }
}

impl Node {
    /// Build an empty node (id 0, no children/properties) for a component.
    pub fn from_component(component: &Component) -> Self {
        Self {
            id: 0,
            component: component.clone(),
            children: Vec::new(),
            properties: BTreeMap::new(),
        }
    }
}

/// Core component types. These describe **structure only** — spacing, padding,
/// and sizing arrive as modifiers (properties), never as layout math here.
#[derive(Clone, PartialEq)]
pub enum Component {
    /// Vertical stack (native vertical container).
    VStack,
    /// Horizontal stack (native horizontal container).
    HStack,
    /// Text leaf.
    Text { text: String },
    /// Interactive button.
    Button { label: String },
    /// Flexible spacer.
    Spacer,
}

impl core::fmt::Debug for Component {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            Component::VStack => f.write_str("VStack"),
            Component::HStack => f.write_str("HStack"),
            Component::Text { text } => f.debug_tuple("Text").field(text).finish(),
            Component::Button { label } => f.debug_tuple("Button").field(label).finish(),
            Component::Spacer => f.write_str("Spacer"),
        }
    }
}

/// Map a component to its protocol component type id.
pub fn component_type_id(component: &Component) -> u16 {
    match component {
        Component::VStack => component_type::VSTACK,
        Component::HStack => component_type::HSTACK,
        Component::Text { .. } => component_type::TEXT,
        Component::Button { .. } => component_type::BUTTON,
        Component::Spacer => component_type::SPACER,
    }
}

/// Cross-axis alignment values for stacks and the `Frame` compound modifier.
///
/// These are emitted as the `ALIGNMENT` (0x0002) property with an `ENUM` value
/// type (low byte of the property value).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Align {
    /// Align to the leading (start) edge.
    Leading,
    /// Center along the cross axis.
    Center,
    /// Align to the trailing (end) edge.
    Trailing,
    /// Fill the available cross-axis space.
    Fill,
}

impl Align {
    /// The protocol enum value for this alignment.
    pub fn value(self) -> u8 {
        match self {
            Align::Leading => 0,
            Align::Center => 1,
            Align::Trailing => 2,
            Align::Fill => 3,
        }
    }
}

/// The protocol value type for a property id.
///
/// Color-valued properties (COLOR, BACKGROUND_COLOR, …) are emitted with the
/// `COLOR` value type; all other constraint/style properties are `F32`.
pub fn value_type_for(prop: u16) -> u8 {
    match prop {
        property_id::COLOR
        | property_id::BACKGROUND_COLOR
        | property_id::BORDER_COLOR => pathland_opcode::value_type::COLOR,
        _ => pathland_opcode::value_type::F32,
    }
}

// ---------------------------------------------------------------------------
// View protocol
// ---------------------------------------------------------------------------

/// A composable view. Implement for custom views; the core components and
/// `Modified` wrappers implement it already.
pub trait View {
    /// Build the retained node for this view.
    fn build(&self) -> Node;
}

/// A view decorator (SwiftUI `ViewModifier`): transforms a node's properties.
///
/// Core modifiers (`Spacing`, `Padding`, `FontSize`, `Color`, `Background`)
/// implement this; application code implements it to compose custom modifiers.
pub trait ViewModifier {
    /// Apply the modifier to `node` (mutating constraint properties).
    fn apply(&self, node: &mut Node);
}

/// A view wrapped by a modifier (SwiftUI `some View` nesting).
#[derive(Debug, Clone, PartialEq)]
pub struct Modified<V, M> {
    view: V,
    modifier: M,
}

impl<V: View, M: ViewModifier> View for Modified<V, M> {
    fn build(&self) -> Node {
        let mut node = self.view.build();
        self.modifier.apply(&mut node);
        node
    }
}

/// Blanket modifier methods on any `View`.
///
/// `.modifier(...)` applies a custom (or core) modifier; the sugar methods
/// (`spacing`, `padding`, `font_size`, `color`, `background`) are conveniences
/// that construct the corresponding core modifier. Modifiers apply
/// innermost-first, matching SwiftUI ordering.
pub trait ViewExt: View + Sized {
    /// Apply a modifier to this view.
    fn modifier<M: ViewModifier>(self, modifier: M) -> Modified<Self, M> {
        Modified { view: self, modifier }
    }

    /// Chain `.spacing(value)`.
    fn spacing(self, value: f32) -> Modified<Self, Spacing> {
        self.modifier(Spacing(value))
    }

    /// Chain `.padding(value)`.
    fn padding(self, value: f32) -> Modified<Self, Padding> {
        self.modifier(Padding(value))
    }

    /// Chain `.font_size(value)`.
    fn font_size(self, value: f32) -> Modified<Self, FontSize> {
        self.modifier(FontSize(value))
    }

    /// Chain `.color(rgba)` (sRGB `0xAARRGGBB`).
    fn color(self, rgba: u32) -> Modified<Self, Color> {
        self.modifier(Color(rgba))
    }

    /// Chain `.background(rgba)` (sRGB `0xAARRGGBB`).
    fn background(self, rgba: u32) -> Modified<Self, Background> {
        self.modifier(Background(rgba))
    }

    /// Chain `.frame(width, height, alignment)` — a compound sizing modifier.
    ///
    /// `width`/`height` use the `size::FILL` (-1.0) and `size::HUG_CONTENT`
    /// (-2.0) sentinels, or `None` to leave that axis to the native renderer.
    /// When an alignment is provided it is emitted as the `ALIGNMENT` property.
    fn frame(
        self,
        width: Option<f32>,
        height: Option<f32>,
        alignment: Option<Align>,
    ) -> Modified<Self, Frame> {
        self.modifier(Frame {
            width,
            height,
            alignment,
        })
    }
}

impl<T: View> ViewExt for T {}

// ---------------------------------------------------------------------------
// Core modifiers
// ---------------------------------------------------------------------------

/// Stack main-axis gap.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Spacing(pub f32);

/// Uniform inner padding.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Padding(pub f32);

/// Text font size in points.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct FontSize(pub f32);

/// Text/foreground color (sRGB `0xAARRGGBB`).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Color(pub u32);

/// Background color (sRGB `0xAARRGGBB`).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Background(pub u32);

/// The compound `frame` sizing modifier (SwiftUI `frame`).
///
/// Emits `WIDTH`, `HEIGHT`, and optionally `ALIGNMENT` as ordinary
/// `SET_PROPERTY` values. `width`/`height` use the `size::FILL` (-1.0) and
/// `size::HUG_CONTENT` (-2.0) sentinels; `None` leaves that axis to the native
/// renderer.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Frame {
    pub width: Option<f32>,
    pub height: Option<f32>,
    pub alignment: Option<Align>,
}

impl ViewModifier for Spacing {
    fn apply(&self, node: &mut Node) {
        node.properties.insert(property_id::SPACING, self.0.to_bits());
    }
}

impl ViewModifier for Padding {
    fn apply(&self, node: &mut Node) {
        node.properties.insert(property_id::PADDING, self.0.to_bits());
    }
}

impl ViewModifier for FontSize {
    fn apply(&self, node: &mut Node) {
        node.properties
            .insert(property_id::FONT_SIZE, self.0.to_bits());
    }
}

impl ViewModifier for Color {
    fn apply(&self, node: &mut Node) {
        node.properties.insert(property_id::COLOR, self.0);
    }
}

impl ViewModifier for Background {
    fn apply(&self, node: &mut Node) {
        node.properties.insert(property_id::BACKGROUND_COLOR, self.0);
    }
}

impl ViewModifier for Frame {
    fn apply(&self, node: &mut Node) {
        if let Some(w) = self.width {
            node.properties
                .insert(property_id::WIDTH, w.to_bits());
        }
        if let Some(h) = self.height {
            node.properties
                .insert(property_id::HEIGHT, h.to_bits());
        }
        if let Some(a) = self.alignment {
            node.properties
                .insert(property_id::ALIGNMENT, (a.value() as f32).to_bits());
        }
    }
}

// ---------------------------------------------------------------------------
// Core components
// ---------------------------------------------------------------------------

/// A vertical stack.
pub struct VStack {
    children: Vec<Box<dyn View>>,
}

impl VStack {
    /// Create an empty vertical stack.
    pub fn new() -> Self {
        Self { children: Vec::new() }
    }

    /// Set the children.
    pub fn children(mut self, children: Vec<Box<dyn View>>) -> Self {
        self.children = children;
        self
    }
}

impl core::fmt::Debug for VStack {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.debug_struct("VStack").field("children", &self.children.len()).finish()
    }
}

impl Default for VStack {
    fn default() -> Self {
        Self::new()
    }
}

impl View for VStack {
    fn build(&self) -> Node {
        Node {
            id: 0,
            component: Component::VStack,
            children: self.children.iter().map(|c| c.build()).collect(),
            properties: BTreeMap::new(),
        }
    }
}

/// A horizontal stack.
pub struct HStack {
    children: Vec<Box<dyn View>>,
}

impl HStack {
    /// Create an empty horizontal stack.
    pub fn new() -> Self {
        Self { children: Vec::new() }
    }

    /// Set the children.
    pub fn children(mut self, children: Vec<Box<dyn View>>) -> Self {
        self.children = children;
        self
    }
}

impl core::fmt::Debug for HStack {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.debug_struct("HStack").field("children", &self.children.len()).finish()
    }
}

impl Default for HStack {
    fn default() -> Self {
        Self::new()
    }
}

impl View for HStack {
    fn build(&self) -> Node {
        Node {
            id: 0,
            component: Component::HStack,
            children: self.children.iter().map(|c| c.build()).collect(),
            properties: BTreeMap::new(),
        }
    }
}

/// A text leaf.
#[derive(Debug, Clone, PartialEq)]
pub struct Text {
    text: String,
}

impl Text {
    /// Create a text node.
    pub fn new(text: &str) -> Self {
        Self { text: text.into() }
    }
}

impl View for Text {
    fn build(&self) -> Node {
        Node {
            id: 0,
            component: Component::Text {
                text: self.text.clone(),
            },
            children: Vec::new(),
            properties: BTreeMap::new(),
        }
    }
}

/// A flexible spacer.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Spacer;

impl Spacer {
    /// Create a spacer.
    pub fn new() -> Self {
        Spacer
    }
}

impl Default for Spacer {
    fn default() -> Self {
        Spacer::new()
    }
}

impl View for Spacer {
    fn build(&self) -> Node {
        Node {
            id: 0,
            component: Component::Spacer,
            children: Vec::new(),
            properties: BTreeMap::new(),
        }
    }
}

/// An interactive button.
#[derive(Debug, Clone, PartialEq)]
pub struct Button {
    label: String,
}

impl Button {
    /// Create a button with the given label.
    pub fn new(label: &str) -> Self {
        Self { label: label.into() }
    }
}

impl View for Button {
    fn build(&self) -> Node {
        Node {
            id: 0,
            component: Component::Button {
                label: self.label.clone(),
            },
            children: Vec::new(),
            properties: BTreeMap::new(),
        }
    }
}

/// A button view (shorthand for [`Button::new`]).
pub fn button(label: &str) -> Button {
    Button::new(label)
}

// ---------------------------------------------------------------------------
// Id assignment
// ---------------------------------------------------------------------------

/// Assign stable unique sequential ids to a tree (pre-order; root first).
///
/// The engine keys its diff snapshot by node id, so call this after building
/// the (possibly re-built) tree and before `Engine::emit`.
pub fn assign_ids(root: &mut Node, next: &mut u32) {
    root.id = *next;
    *next += 1;
    for child in &mut root.children {
        assign_ids(child, next);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn text_builds_plain_node() {
        let node = Text::new("ab").build();
        assert_eq!(node.id, 0);
        assert_eq!(node.component, Component::Text { text: "ab".into() });
        assert!(node.properties.is_empty());
        assert!(node.children.is_empty());
    }

    #[test]
    fn modifiers_chain_and_apply_to_node() {
        let node = Text::new("hi")
            .padding(16.0)
            .color(0xFF_0000FF)
            .background(0xFF_EEEEEE)
            .build();
        assert_eq!(
            node.properties.get(&property_id::PADDING),
            Some(&16.0f32.to_bits())
        );
        assert_eq!(
            node.properties.get(&property_id::COLOR),
            Some(&0xFF_0000FF)
        );
        assert_eq!(
            node.properties.get(&property_id::BACKGROUND_COLOR),
            Some(&0xFF_EEEEEE)
        );
    }

    #[test]
    fn vstack_children_build_to_node_children() {
        let node = vstack![text("a"), text("b")]
            .spacing(4.0)
            .padding(8.0)
            .build();
        assert_eq!(node.component, Component::VStack);
        assert_eq!(node.children.len(), 2);
        assert_eq!(
            node.properties.get(&property_id::SPACING),
            Some(&4.0f32.to_bits())
        );
        assert_eq!(
            node.properties.get(&property_id::PADDING),
            Some(&8.0f32.to_bits())
        );
    }

    #[test]
    fn nested_stacks_build_via_macros() {
        let node = vstack![text("a"), hstack![text("b")]].build();
        assert_eq!(node.component, Component::VStack);
        assert_eq!(node.children.len(), 2);
        assert_eq!(node.children[0].component, Component::Text { text: "a".into() });
        assert_eq!(node.children[1].component, Component::HStack);
        assert_eq!(node.children[1].children.len(), 1);
    }

    #[test]
    fn macros_accept_empty_and_trailing_comma() {
        let empty = vstack![].build();
        assert!(empty.children.is_empty());
        let trailing = hstack![text("x"),].build();
        assert_eq!(trailing.children.len(), 1);
    }

    #[test]
    fn any_modifier_applies_to_any_view() {
        // .font_size on a stack is "allowed and ignored" — property is emitted.
        let stack = vstack![].font_size(24.0).build();
        assert_eq!(
            stack.properties.get(&property_id::FONT_SIZE),
            Some(&24.0f32.to_bits())
        );
    }

    #[test]
    fn custom_modifier_composes_core_modifiers() {
        struct Card;
        impl ViewModifier for Card {
            fn apply(&self, node: &mut Node) {
                Padding(16.0).apply(node);
                Background(0xFF_EEEEEE).apply(node);
                Color(0xFF_000000).apply(node);
            }
        }

        let text = text("A").modifier(Card).build();
        assert_eq!(
            text.properties.get(&property_id::PADDING),
            Some(&16.0f32.to_bits())
        );
        assert_eq!(
            text.properties.get(&property_id::BACKGROUND_COLOR),
            Some(&0xFF_EEEEEE)
        );

        let stack = vstack![].modifier(Card).build();
        assert_eq!(
            stack.properties.get(&property_id::BACKGROUND_COLOR),
            Some(&0xFF_EEEEEE)
        );
    }

    #[test]
    fn modifiers_apply_innermost_first() {
        let node = Text::new("x").padding(4.0).padding(8.0).build();
        // Innermost wins: first Padding(4), then Padding(8) overwrites.
        assert_eq!(
            node.properties.get(&property_id::PADDING),
            Some(&8.0f32.to_bits())
        );
    }

    #[test]
    fn assign_ids_is_pre_order_sequential() {
        let mut root = vstack![text("a"), hstack![text("b")]].build();
        assign_ids(&mut root, &mut 1);
        assert_eq!(root.id, 1);
        assert_eq!(root.children[0].id, 2);
        assert_eq!(root.children[1].id, 3);
        assert_eq!(root.children[1].children[0].id, 4);
    }

    #[test]
    fn frame_emits_width_height_alignment_as_properties() {
        use pathland_opcode::size;
        let node = text("x")
            .frame(Some(size::FILL), Some(24.0), Some(Align::Center))
            .build();
        assert_eq!(
            node.properties.get(&property_id::WIDTH),
            Some(&size::FILL.to_bits())
        );
        assert_eq!(
            node.properties.get(&property_id::HEIGHT),
            Some(&24.0f32.to_bits())
        );
        assert_eq!(
            node.properties.get(&property_id::ALIGNMENT),
            Some(&(Align::Center.value() as f32).to_bits())
        );
    }

    #[test]
    fn frame_without_axis_omits_that_property() {
        let node = text("x").frame(Some(100.0), None, None).build();
        assert_eq!(
            node.properties.get(&property_id::WIDTH),
            Some(&100.0f32.to_bits())
        );
        assert!(!node.properties.contains_key(&property_id::HEIGHT));
        assert!(!node.properties.contains_key(&property_id::ALIGNMENT));
    }
}
