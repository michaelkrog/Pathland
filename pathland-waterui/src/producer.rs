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
//! Frames are pushed to a **sink** as network batches (initial render + every
//! delta), so a server can stream them to a browser over WebSocket without
//! polling. Button actions are captured into a `nodeId → action` map so a host
//! can dispatch inbound input events back into the application.

use std::cell::RefCell;
use std::collections::BTreeMap;
use std::rc::Rc;

use pathland_core::{Opcode, SharedHeader, component_type, property_id, value_type, Guest, RingError};
use pathland_core_transport::{BatchEncoder, FrameSource, RingTransport};
use waterui_controls::button::ButtonConfig;
use waterui_core::handler::BoxedAction;
use waterui_core::reactive::watcher::BoxWatcherGuard;
use waterui_core::{AnyView, Computed, Environment, Metadata, Native, Retain, Signal, View};
use waterui_layout::container::FixedContainer;
use waterui_layout::spacer::Spacer;
use waterui_layout::stack::{Axis, LazyStackAxis};
use waterui_text::TextConfig;
use waterui_text::styled::StyledStr;

/// Sentinel parent id for the root node (the ring treats `0` as "no parent").
const ROOT_PARENT: u32 = 0;

/// A reactive binding discovered during the walk.
enum Reactive {
    /// A node's text content, re-emitted as `SET_TEXT`.
    Text { node: u32, content: Computed<StyledStr> },
    /// A node's `f32` property, re-emitted as `SET_PROPERTY` (`value_type::F32`).
    Property { node: u32, property: u16, value: Computed<f32> },
}

/// Emits WaterUI views as Pathland opcodes, pushing network batches to a sink.
pub struct Emitter {
    transport: Rc<RefCell<RingTransport>>,
    encoder: Rc<RefCell<BatchEncoder>>,
    sink: Rc<dyn Fn(Vec<u8>)>,
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
    /// Create an emitter with a no-op sink (ring-only draining via
    /// [`Emitter::transport`]).
    #[must_use]
    pub fn new() -> Self {
        Self::with_sink(|_| {})
    }

    /// Create an emitter that pushes each frame as a network batch to `sink`
    /// (initial render + every reactive delta).
    #[must_use]
    pub fn with_sink(sink: impl Fn(Vec<u8>) + 'static) -> Self {
        Self {
            transport: Rc::new(RefCell::new(RingTransport::new())),
            encoder: Rc::new(RefCell::new(BatchEncoder::new())),
            sink: Rc::new(sink),
            actions: Rc::new(RefCell::new(BTreeMap::new())),
            next_id: 1,
            guards: Vec::new(),
        }
    }

    /// The shared ring, for consumers that read frames in place.
    #[must_use]
    pub fn transport(&self) -> Rc<RefCell<RingTransport>> {
        Rc::clone(&self.transport)
    }

    /// Emit a view as one frame, returning the id of the root node. The initial
    /// frame is pushed to the sink; reactive fields are subscribed so a later
    /// signal change pushes a `SET_TEXT` / `SET_PROPERTY` delta.
    pub fn emit<V: View>(&mut self, view: V, env: &Environment) -> Result<u32, RingError> {
        let mut reactive: Vec<Reactive> = Vec::new();
        let mut actions: Vec<(u32, BoxedAction<()>)> = Vec::new();

        let (root, next_id) = {
            let transport = Rc::clone(&self.transport);
            let mut borrow = transport.borrow_mut();
            let mut guest = borrow.producer();
            guest.begin_frame();

            let (root, next_id) = {
                let mut walk = Walk {
                    guest: &mut guest,
                    next_id: self.next_id,
                    reactive: &mut reactive,
                    actions: &mut actions,
                };
                let root = walk.any(AnyView::new(view), env, ROOT_PARENT)?;
                (root, walk.next_id)
            };

            guest.end_frame();
            (root, next_id)
        };
        self.next_id = next_id;

        for (id, action) in actions {
            self.actions.borrow_mut().insert(id, action);
        }

        self.subscribe(reactive);
        drain_push(&self.transport, &self.encoder, &self.sink);

        Ok(root)
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
            let transport = Rc::clone(&self.transport);
            let encoder = Rc::clone(&self.encoder);
            let sink = Rc::clone(&self.sink);
            match binding {
                Reactive::Text { node, content } => {
                    let guard = content.watch(move |ctx| {
                        let text = ctx.into_value().to_plain().to_string();
                        {
                            let mut borrow = transport.borrow_mut();
                            let mut guest = borrow.producer();
                            guest.begin_frame();
                            let _ = guest.set_text(node, &text);
                            guest.end_frame();
                        }
                        drain_push(&transport, &encoder, &sink);
                    });
                    self.guards.push(Box::new(guard));
                }
                Reactive::Property { node, property, value } => {
                    let guard = value.watch(move |ctx| {
                        let bits = ctx.into_value().to_bits();
                        {
                            let mut borrow = transport.borrow_mut();
                            let mut guest = borrow.producer();
                            guest.begin_frame();
                            let _ = guest.set_property(node, property, value_type::F32, bits);
                            guest.end_frame();
                        }
                        drain_push(&transport, &encoder, &sink);
                    });
                    self.guards.push(Box::new(guard));
                }
            }
        }
    }
}

/// Drain any new frame from the ring and push it to the sink as a batch.
fn drain_push(
    transport: &Rc<RefCell<RingTransport>>,
    encoder: &Rc<RefCell<BatchEncoder>>,
    sink: &Rc<dyn Fn(Vec<u8>)>,
) {
    let opcodes: Vec<Opcode> = {
        let mut borrow = transport.borrow_mut();
        match borrow.next_frame() {
            Ok(Some(batch)) => batch.frame().opcodes().collect(),
            _ => return,
        }
    };

    let (frame_count, arena_used): (u32, Vec<u8>) = {
        let borrow = transport.borrow();
        let buffer = borrow.buffer();
        let header = SharedHeader::new(buffer);
        let offset = header.arena_offset();
        let cursor = header.arena_cursor() as usize;
        (header.frame_count(), buffer[offset..offset + cursor].to_vec())
    };

    let bytes = encoder.borrow_mut().encode(frame_count, &opcodes, &arena_used);
    sink(bytes);
}

/// The recursive walker: borrows the guest ring plus the reactive and action
/// sinks, and owns the node-id cursor for the duration of one emit pass.
struct Walk<'g, 'm> {
    guest: &'g mut Guest<'m>,
    next_id: u32,
    reactive: &'g mut Vec<Reactive>,
    actions: &'g mut Vec<(u32, BoxedAction<()>)>,
}

impl<'g, 'm> Walk<'g, 'm> {
    fn alloc_id(&mut self) -> u32 {
        let id = self.next_id;
        self.next_id += 1;
        id
    }

    fn insert(&mut self, parent: u32, child: u32) -> Result<(), RingError> {
        if parent != ROOT_PARENT {
            self.guest.insert_child(parent, child, pathland_core::APPEND)?;
        }
        Ok(())
    }

    fn any(&mut self, view: AnyView, env: &Environment, parent: u32) -> Result<u32, RingError> {
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
    ) -> Result<u32, RingError> {
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
        self.guest.create_node(id, ct)?;
        self.insert(parent, id)?;
        if let Some(spacing) = spacing {
            self.guest.set_property(
                id,
                property_id::SPACING,
                value_type::F32,
                spacing.get().to_bits(),
            )?;
            self.reactive.push(Reactive::Property {
                node: id,
                property: property_id::SPACING,
                value: spacing,
            });
        }

        for child in contents {
            self.any(child, env, id)?;
        }
        Ok(id)
    }

    fn text_node(&mut self, config: Native<TextConfig>, parent: u32) -> Result<u32, RingError> {
        let config = config.into_inner();
        self.emit_leaf(component_type::TEXT, config.content, parent)
    }

    fn button_node(&mut self, config: Native<ButtonConfig>, parent: u32) -> Result<u32, RingError> {
        let config = config.into_inner();
        // `ButtonConfig` is produced by `Button::body(env)`, which resolves the
        // label and stores the resolved content as the accessibility label.
        let content = config.label.accessibility_label();
        let action = config.action;
        let id = self.emit_leaf(component_type::BUTTON, content, parent)?;
        self.actions.push((id, action));
        Ok(id)
    }

    fn emit_leaf(
        &mut self,
        ct: u16,
        content: Computed<StyledStr>,
        parent: u32,
    ) -> Result<u32, RingError> {
        let text = content.get().to_plain().to_string();

        let id = self.alloc_id();
        self.guest.create_node(id, ct)?;
        self.insert(parent, id)?;
        self.guest.set_text(id, &text)?;

        self.reactive.push(Reactive::Text { node: id, content });
        Ok(id)
    }

    fn spacer_node(&mut self, parent: u32) -> Result<u32, RingError> {
        let id = self.alloc_id();
        self.guest.create_node(id, component_type::SPACER)?;
        self.insert(parent, id)?;
        Ok(id)
    }
}
