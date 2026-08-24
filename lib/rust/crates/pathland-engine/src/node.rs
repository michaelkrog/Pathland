//! Retained view tree types.
//!
//! The retained tree is the application's canonical UI tree: the single source
//! of truth the engine diffs into declarative `TREE`/`STYLE` opcodes. It lives
//! here (in the opcode-engine core) so the diff emitter can walk it without the
//! engine depending on the authoring DSL.

use alloc::collections::BTreeMap;
use alloc::rc::Rc;
use alloc::string::String;
use alloc::vec::Vec;
use core::cell::RefCell;

use pathland_core::component_type;

use crate::signal::SignalId;

/// A node in the retained view tree (the application's canonical UI tree).
#[derive(Clone, PartialEq)]
pub struct Node {
    /// Stable node id (0 until `assign_ids`).
    pub id: u32,
    pub component: Component,
    pub children: Vec<Node>,
    /// Constraint/style properties (propertyId to value) emitted as
    /// `STYLE:SET_PROPERTY`.
    pub properties: BTreeMap<u16, u32>,
    /// A signal the node's text is bound to (overrides `Component::Text` /
    /// `Component::Button` label when set).
    pub text_binding: Option<SignalId>,
    /// Property signals (propertyId to signal), overriding the static
    /// `properties` entry for that id when both are present.
    pub property_bindings: BTreeMap<u16, SignalId>,
    /// App-side gesture handlers (callbacks). These live only in the
    /// application's retained tree and are **never** emitted as protocol.
    pub gestures: Vec<Gesture>,
}

impl core::fmt::Debug for Node {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.debug_struct("Node")
            .field("id", &self.id)
            .field("component", &self.component)
            .field("children", &self.children)
            .field("properties", &self.properties)
            .field("text_binding", &self.text_binding)
            .field("property_bindings", &self.property_bindings)
            .field("gestures", &self.gestures.len())
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
            text_binding: None,
            property_bindings: BTreeMap::new(),
            gestures: Vec::new(),
        }
    }
}

/// An app-side gesture handler attached to a view.
///
/// Callbacks live only in the application's retained tree and are **never**
/// emitted as protocol — the protocol carries only the declarative
/// `EVENT_LISTENERS` signal. Tap is the first gesture; more can be added later.
#[derive(Clone)]
pub enum Gesture {
    /// A tap gesture: invoke the closure when a tap is recognized.
    Tap(Rc<RefCell<dyn FnMut() + 'static>>),
}

impl PartialEq for Gesture {
    fn eq(&self, other: &Self) -> bool {
        match (self, other) {
            (Gesture::Tap(a), Gesture::Tap(b)) => Rc::ptr_eq(a, b),
        }
    }
}

impl core::fmt::Debug for Gesture {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            Gesture::Tap(_) => f.write_str("Tap(..)"),
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

/// Collect a `node id -> tap callback` map from a built (and id-assigned) tree.
///
/// Call after [`assign_ids`] so each node has its stable id; the returned map
/// keys the recognizer's tap target to the closure registered by
/// `.on_tap_gesture(...)`.
pub fn collect_tap_handlers(
    root: &Node,
    out: &mut BTreeMap<u32, Rc<RefCell<dyn FnMut() + 'static>>>,
) {
    for gesture in &root.gestures {
        let Gesture::Tap(handler) = gesture;
        out.insert(root.id, handler.clone());
    }
    for child in &root.children {
        collect_tap_handlers(child, out);
    }
}
