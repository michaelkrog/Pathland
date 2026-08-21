//! # pathland-guest
//!
//! The Pathland **WASM guest component**. It owns the canonical retained view
//! tree and the diff-based engine, and exposes the flat, language-agnostic
//! `pathland:view/pathland` world:
//!
//! - **`builder`** — build/update the retained tree by node id.
//! - **`engine`** — frame lifecycle + `emit` (writes delta opcodes into the
//!   ring/arena in linear memory) and `take-batch` (returns the pending frame
//!   as a network batch).
//! - **`input`** — raw-input event ingress from the host; routed back to the
//!   host's `app.on-event` callback.
//!
//! Any WIT host (GTK desktop, future Java/Quarkus) drives this component; each
//! language wraps the world in its own ergonomic surface.
//!
//! This crate is built as a WASM component with `cargo component build
//! -p pathland-guest`. For the native workspace build it compiles to an empty
//! crate (the implementation is gated on `target_arch = "wasm32"`).

#![cfg(target_arch = "wasm32")]

use std::collections::{BTreeMap, HashMap};
use std::sync::Mutex;

use pathland_engine::Engine;
use pathland_opcode::property_id;
use pathland_opcode::{init_memory, Guest as RingGuest, Host, MemoryLayout, Opcode};
use pathland_transport::BatchEncoder;
use pathland_view::Node;

#[allow(warnings)]
mod bindings;

use bindings::exports::pathland::view::builder::Guest as BuilderGuest;
use bindings::exports::pathland::view::engine::Guest as EngineGuest;
use bindings::exports::pathland::view::input::Guest as InputGuest;
use bindings::pathland::view::types::{Component, Event, Property};

/// A flat node in the guest's retained tree (id → node).
#[derive(Clone)]
struct FlatNode {
    id: u32,
    view_component: pathland_view::Component,
    properties: BTreeMap<u16, u32>,
    parent: Option<u32>,
    children: Vec<u32>,
}

/// The guest component state: retained tree, engine, ring memory.
///
/// The WIT exports are stateless functions, so state lives in a global mutex
/// (the component model is single-threaded per instance; a plain `static`
/// would also work, but `Mutex` keeps the borrow checker happy).
struct State {
    nodes: HashMap<u32, FlatNode>,
    engine: Engine,
    mem: Vec<u8>,
    layout: MemoryLayout,
    encoder: BatchEncoder,
}

static STATE: Mutex<Option<State>> = Mutex::new(None);

fn state() -> &'static Mutex<Option<State>> {
    &STATE
}

/// Initialize the guest state (idempotent).
fn ensure_state() {
    let mut guard = state().lock().unwrap();
    if guard.is_none() {
        let layout = MemoryLayout::default();
        let mut mem = vec![0u8; layout.total_bytes()];
        init_memory(&mut mem, &layout);
        *guard = Some(State {
            nodes: HashMap::new(),
            engine: Engine::new(),
            mem,
            layout,
            encoder: BatchEncoder::new(),
        });
    }
}

/// Map a WIT component to a `pathland_view::Component`.
fn to_view_component(c: &Component) -> pathland_view::Component {
    match c {
        Component::Hstack => pathland_view::Component::HStack,
        Component::Vstack => pathland_view::Component::VStack,
        Component::Text => pathland_view::Component::Text { text: String::new() },
        Component::Button => pathland_view::Component::Button { label: String::new() },
        Component::Spacer => pathland_view::Component::Spacer,
    }
}

/// Map a WIT property to a protocol property id.
fn to_property_id(p: &Property) -> u16 {
    match p {
        Property::Spacing => property_id::SPACING,
        Property::Padding => property_id::PADDING,
        Property::FontSize => property_id::FONT_SIZE,
        Property::Color => property_id::COLOR,
        Property::BackgroundColor => property_id::BACKGROUND_COLOR,
    }
}

/// Materialize a `pathland_view::Node` tree rooted at `root_id`, pre-order.
fn materialize(nodes: &HashMap<u32, FlatNode>, root_id: u32) -> Option<Node> {
    let flat = nodes.get(&root_id)?.clone();
    let mut node = Node::from_component(&flat.view_component);
    node.id = flat.id;
    node.properties = flat.properties.clone();
    for child_id in &flat.children {
        if let Some(child) = materialize(nodes, *child_id) {
            node.children.push(child);
        }
    }
    Some(node)
}

/// The root is the node without a parent (the app authors a single root).
fn root_id(nodes: &HashMap<u32, FlatNode>) -> Option<u32> {
    nodes
        .values()
        .find(|n| n.parent.is_none())
        .map(|n| n.id)
}

impl BuilderGuest for State {
    fn create_node(id: u32, component: Component) {
        ensure_state();
        let mut guard = state().lock().unwrap();
        let s = guard.as_mut().unwrap();
        let entry = s.nodes.entry(id).or_insert(FlatNode {
            id,
            view_component: to_view_component(&component),
            properties: BTreeMap::new(),
            parent: None,
            children: Vec::new(),
        });
        entry.view_component = to_view_component(&component);
        entry.properties.clear();
    }

    fn insert_child(parent: u32, child: u32, index: u32) {
        ensure_state();
        let mut guard = state().lock().unwrap();
        let s = guard.as_mut().unwrap();
        if let Some(p) = s.nodes.get_mut(&parent) {
            let idx = if index == u32::MAX {
                p.children.len()
            } else {
                (index as usize).min(p.children.len())
            };
            if !p.children.contains(&child) {
                p.children.insert(idx, child);
            }
        }
        if let Some(c) = s.nodes.get_mut(&child) {
            c.parent = Some(parent);
        }
    }

    fn remove_child(parent: u32, child: u32) {
        ensure_state();
        let mut guard = state().lock().unwrap();
        let s = guard.as_mut().unwrap();
        if let Some(p) = s.nodes.get_mut(&parent) {
            p.children.retain(|c| *c != child);
        }
        if let Some(c) = s.nodes.get_mut(&child) {
            c.parent = None;
        }
    }

    fn set_text(id: u32, text: String) {
        ensure_state();
        let mut guard = state().lock().unwrap();
        let s = guard.as_mut().unwrap();
        if let Some(node) = s.nodes.get_mut(&id) {
            match &mut node.view_component {
                pathland_view::Component::Text { text: t } => *t = text,
                pathland_view::Component::Button { label } => *label = text,
                _ => {}
            }
        }
    }

    fn set_property(id: u32, property: Property, value: f32) {
        ensure_state();
        let mut guard = state().lock().unwrap();
        let s = guard.as_mut().unwrap();
        if let Some(node) = s.nodes.get_mut(&id) {
            let pid = to_property_id(&property);
            if property == Property::Color || property == Property::BackgroundColor {
                node.properties.insert(pid, value as u32);
            } else {
                node.properties.insert(pid, value.to_bits());
            }
        }
    }
}

impl EngineGuest for State {
    fn begin_frame() {
        ensure_state();
    }

    fn emit() {
        ensure_state();
        let mut guard = state().lock().unwrap();
        let s = guard.as_mut().unwrap();
        let root = root_id(&s.nodes).and_then(|r| materialize(&s.nodes, r));
        if let Some(root) = root {
            let mut ring = RingGuest::new(&mut s.mem, &s.layout);
            ring.begin_frame();
            s.engine.emit(&root, &mut ring).ok();
            ring.end_frame();
        }
    }

    fn end_frame() {}

    fn take_batch() -> Vec<u8> {
        ensure_state();
        let mut guard = state().lock().unwrap();
        let s = guard.as_mut().unwrap();
        // Drain completed frames from the ring and encode them as a batch.
        let mut host = Host::new(&mut s.mem, &s.layout);
        let mut bytes = Vec::new();
        for frame in host.frames() {
            let opcodes: Vec<Opcode> = frame.opcodes().collect();
            let arena = frame.arena().to_vec();
            let frame_count = host.frame_count();
            bytes.extend(s.encoder.encode(frame_count, &opcodes, &arena));
        }
        bytes
    }
}

impl InputGuest for State {
    fn dispatch(event: Event) {
        route_event(event);
    }
}

/// Route a raw input back to the host application.
fn route_event(event: Event) {
    bindings::pathland::view::app::on_event(event);
}

bindings::export!(State with_types_in bindings);
