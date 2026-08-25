//! Producer: walk a WaterUI view tree and emit Pathland opcodes.
//!
//! The emitter walks the view tree with a hand-rolled recursive walker over
//! [`AnyView`]. It handles the raw native leaf types it knows about (container,
//! text, button, spacer) and unwraps the two metadata wrappers WaterUI uses to
//! smuggle state past the type-erasure boundary (`Metadata<Environment>` for
//! the stack axis, `Metadata<Retain>` for watcher-guard lifetimes). Any other
//! view is a composite and is expanded via [`View::body`].
//!
//! Reactive fields are the one piece of change detection the producer
//! participates in: a [`TextConfig`] carries a [`Computed`] content signal and
//! a stack carries a [`Computed`] spacing signal, so the emitter subscribes to
//! each and re-emits a `SET_TEXT` / `SET_PROPERTY` delta whenever it changes.
//!
//! Frames are **self-contained**: each one is pushed to a sink as
//! `(opcodes, strings)`, where `SET_TEXT` references its string by a *relative*
//! offset into that frame's own string section. A consumer therefore needs no
//! prior state (no ring, no mirrored arena) to decode a frame. Button actions
//! are captured into a `nodeId → action` map so a host can dispatch inbound
//! input events back into the application.

use std::cell::RefCell;
use std::collections::BTreeMap;
use std::rc::Rc;

use pathland_core::{
    Opcode, category, component_type, property_id, style, tree, value_type,
};
use waterui_controls::button::ButtonConfig;
use waterui_core::handler::BoxedAction;
use waterui_core::reactive::watcher::BoxWatcherGuard;
use waterui_core::{AnyView, Computed, Environment, Metadata, Native, Retain, Signal, View};
use waterui_layout::container::FixedContainer;
use waterui_layout::spacer::Spacer;
use waterui_layout::stack::{Axis, LazyStackAxis};
use waterui_text::TextConfig;
use waterui_text::styled::StyledStr;

/// Sentinel parent id for the root node (`0` means "no parent").
const ROOT_PARENT: u32 = 0;

/// A reactive binding discovered during the walk.
enum Reactive {
    /// A node's text content, re-emitted as `SET_TEXT`.
    Text { node: u32, content: Computed<StyledStr> },
    /// A node's `f32` property, re-emitted as `SET_PROPERTY` (`value_type::F32`).
    Property { node: u32, property: u16, value: Computed<f32> },
}

/// Accumulates a self-contained frame: opcodes plus a per-frame string section.
///
/// `SET_TEXT` opcodes reference their string by a **relative** offset into the
/// string section (unlike the shared-memory ring, whose arena offsets are
/// absolute). A frame is therefore self-describing — it can be serialized and
/// decoded with no prior state and no mirrored arena.
#[derive(Default)]
struct FrameBuilder {
    opcodes: Vec<Opcode>,
    strings: Vec<u8>,
}

impl FrameBuilder {
    fn create_node(&mut self, id: u32, component: u16) {
        self.opcodes
            .push(Opcode::new(category::TREE, tree::CREATE_NODE, 0, id, component as u32, 0));
    }

    fn insert_child(&mut self, parent: u32, child: u32, index: u32) {
        self.opcodes
            .push(Opcode::new(category::TREE, tree::INSERT_CHILD, 0, parent, child, index));
    }

    fn set_property(&mut self, id: u32, prop: u16, vt: u8, value: u32) {
        self.opcodes.push(Opcode::new(
            category::STYLE,
            style::SET_PROPERTY,
            0,
            id,
            ((vt as u32) << 16) | prop as u32,
            value,
        ));
    }

    fn set_text(&mut self, id: u32, text: &str) {
        let offset = self.strings.len() as u32;
        self.strings
            .extend_from_slice(&(text.len() as u32).to_le_bytes());
        self.strings.extend_from_slice(text.as_bytes());
        self.opcodes
            .push(Opcode::new(category::STYLE, style::SET_TEXT, 0, id, offset, 0));
    }
}

/// Emits WaterUI views as self-contained Pathland frames, pushing them to a sink.
pub struct Emitter {
    sink: Rc<dyn Fn(Vec<Opcode>, Vec<u8>)>,
    actions: Rc<RefCell<BTreeMap<u32, BoxedAction<()>>>>,
    next_id: u32,
    guards: Vec<BoxWatcherGuard>,
}

impl Default for Emitter {
    fn default() -> Self {
        Self::new()
    }
}

impl Emitter {
    /// Create an emitter with a no-op sink.
    #[must_use]
    pub fn new() -> Self {
        Self::with_sink(|_, _| {})
    }

    /// Create an emitter that pushes each frame `(opcodes, strings)` to `sink`
    /// (the initial render + every reactive delta).
    #[must_use]
    pub fn with_sink(sink: impl Fn(Vec<Opcode>, Vec<u8>) + 'static) -> Self {
        Self {
            sink: Rc::new(sink),
            actions: Rc::new(RefCell::new(BTreeMap::new())),
            next_id: 1,
            guards: Vec::new(),
        }
    }

    /// Emit a view as one self-contained frame, returning the id of the root
    /// node. Reactive fields are subscribed so a later signal change pushes a
    /// `SET_TEXT` / `SET_PROPERTY` delta frame.
    pub fn emit<V: View>(&mut self, view: V, env: &Environment) -> u32 {
        let mut builder = FrameBuilder::default();
        let mut reactive: Vec<Reactive> = Vec::new();
        let mut actions: Vec<(u32, BoxedAction<()>)> = Vec::new();

        let (root, next_id) = {
            let mut walk = Walk {
                builder: &mut builder,
                next_id: self.next_id,
                reactive: &mut reactive,
                actions: &mut actions,
            };
            let root = walk.any(AnyView::new(view), env, ROOT_PARENT);
            (root, walk.next_id)
        };
        self.next_id = next_id;

        for (id, action) in actions {
            self.actions.borrow_mut().insert(id, action);
        }

        self.subscribe(reactive);
        (self.sink)(builder.opcodes, builder.strings);
        root
    }

    /// Invoke the captured action for `node_id` (used to dispatch input events).
    ///
    /// Returns `true` if a handler was found and invoked.
    pub fn invoke(&self, node_id: u32, env: &Environment) -> bool {
        let mut actions = self.actions.borrow_mut();
        match actions.get_mut(&node_id) {
            Some(action) => {
                action(env);
                true
            }
            None => false,
        }
    }

    fn subscribe(&mut self, reactive: Vec<Reactive>) {
        for binding in reactive {
            let sink = Rc::clone(&self.sink);
            match binding {
                Reactive::Text { node, content } => {
                    let guard = content.watch(move |ctx| {
                        let text = ctx.into_value().to_plain().to_string();
                        let mut builder = FrameBuilder::default();
                        builder.set_text(node, &text);
                        sink(builder.opcodes, builder.strings);
                    });
                    self.guards.push(Box::new(guard));
                }
                Reactive::Property { node, property, value } => {
                    let guard = value.watch(move |ctx| {
                        let bits = ctx.into_value().to_bits();
                        let mut builder = FrameBuilder::default();
                        builder.set_property(node, property, value_type::F32, bits);
                        sink(builder.opcodes, builder.strings);
                    });
                    self.guards.push(Box::new(guard));
                }
            }
        }
    }
}

/// The recursive walker: borrows the frame builder plus the reactive and action
/// sinks, and owns the node-id cursor for the duration of one emit pass.
struct Walk<'g> {
    builder: &'g mut FrameBuilder,
    next_id: u32,
    reactive: &'g mut Vec<Reactive>,
    actions: &'g mut Vec<(u32, BoxedAction<()>)>,
}

impl<'g> Walk<'g> {
    fn alloc_id(&mut self) -> u32 {
        let id = self.next_id;
        self.next_id += 1;
        id
    }

    fn insert(&mut self, parent: u32, child: u32) {
        if parent != ROOT_PARENT {
            self.builder.insert_child(parent, child, pathland_core::APPEND);
        }
    }

    fn any(&mut self, view: AnyView, env: &Environment, parent: u32) -> u32 {
        // `Metadata<Environment>` carries a scoped environment (WaterUI injects
        // the stack `Axis` this way); recurse into the content with that env.
        if view.is::<Metadata<Environment>>() {
            let m = *view.downcast::<Metadata<Environment>>().expect("downcast environment");
            return self.any(m.content, &m.value, parent);
        }
        // `Metadata<Retain>` keeps watcher guards alive for the subtree's
        // lifetime; unwrap it (the retained value is dropped, which for a
        // static tree holds no guards).
        if view.is::<Metadata<Retain>>() {
            let m = *view.downcast::<Metadata<Retain>>().expect("downcast retain");
            return self.any(m.content, env, parent);
        }
        if view.is::<Native<FixedContainer>>() {
            let c = *view
                .downcast::<Native<FixedContainer>>()
                .expect("downcast container");
            return self.container(c, env, parent);
        }
        if view.is::<Native<TextConfig>>() {
            let c = *view.downcast::<Native<TextConfig>>().expect("downcast text");
            return self.text_node(c, parent);
        }
        if view.is::<Native<ButtonConfig>>() {
            let c = *view.downcast::<Native<ButtonConfig>>().expect("downcast button");
            return self.button_node(c, parent);
        }
        if view.is::<Native<Spacer>>() {
            let _s = *view.downcast::<Native<Spacer>>().expect("downcast spacer");
            return self.spacer_node(parent);
        }

        // Composite view: expand its body and keep walking.
        let body = view.body(env);
        self.any(AnyView::new(body), env, parent)
    }

    fn container(
        &mut self,
        container: Native<FixedContainer>,
        env: &Environment,
        parent: u32,
    ) -> u32 {
        let inner = container.into_inner();
        let stack_axis = inner.stack_axis();
        let (_layout, contents) = inner.into_inner();

        let (ct, spacing) = match stack_axis {
            Some(LazyStackAxis::Vertical { spacing, .. }) => (component_type::VSTACK, Some(spacing)),
            Some(LazyStackAxis::Horizontal { spacing, .. }) => {
                (component_type::HSTACK, Some(spacing))
            }
            None => {
                let axis = env.get::<Axis>().copied().unwrap_or(Axis::Vertical);
                let ct = if axis.is_horizontal() {
                    component_type::HSTACK
                } else {
                    component_type::VSTACK
                };
                (ct, None)
            }
        };

        let id = self.alloc_id();
        self.builder.create_node(id, ct);
        self.insert(parent, id);
        if let Some(spacing) = spacing {
            self.builder
                .set_property(id, property_id::SPACING, value_type::F32, spacing.get().to_bits());
            self.reactive.push(Reactive::Property {
                node: id,
                property: property_id::SPACING,
                value: spacing,
            });
        }

        for child in contents {
            self.any(child, env, id);
        }
        id
    }

    fn text_node(&mut self, config: Native<TextConfig>, parent: u32) -> u32 {
        let config = config.into_inner();
        self.emit_leaf(component_type::TEXT, config.content, parent)
    }

    fn button_node(&mut self, config: Native<ButtonConfig>, parent: u32) -> u32 {
        let config = config.into_inner();
        // `ButtonConfig` is produced by `Button::body(env)`, which resolves the
        // label and stores the resolved content as the accessibility label.
        let content = config.label.accessibility_label();
        let action = config.action;
        let id = self.emit_leaf(component_type::BUTTON, content, parent);
        self.actions.push((id, action));
        id
    }

    fn emit_leaf(&mut self, ct: u16, content: Computed<StyledStr>, parent: u32) -> u32 {
        let text = content.get().to_plain().to_string();

        let id = self.alloc_id();
        self.builder.create_node(id, ct);
        self.insert(parent, id);
        self.builder.set_text(id, &text);

        self.reactive.push(Reactive::Text { node: id, content });
        id
    }

    fn spacer_node(&mut self, parent: u32) -> u32 {
        let id = self.alloc_id();
        self.builder.create_node(id, component_type::SPACER);
        self.insert(parent, id);
        id
    }
}
