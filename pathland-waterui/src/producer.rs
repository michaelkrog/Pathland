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
    Opcode, border_edges, category, component_type, property_id, style, tree, value_type,
};
use waterui::border::Border;
use waterui::color::ResolvedColor;
use waterui_controls::button::ButtonConfig;
use waterui_controls::slider::SliderConfig;
use waterui_controls::text_field::ResolvedTextFieldConfig;
use waterui_controls::toggle::{ToggleConfig, ToggleStyle};
use waterui_core::handler::BoxedAction;
use waterui_core::reactive::watcher::BoxWatcherGuard;
use waterui_core::{AnyView, Binding, Computed, Environment, Metadata, Native, Retain, Signal, SignalExt, View};
use waterui_layout::EdgeSet;
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
    /// A node's property, re-emitted as `SET_PROPERTY` with an explicit value
    /// type (`value` carries the raw wire bits: `f32` bits for F32, packed
    /// `0xAARRGGBB` for COLOR, etc.).
    Property { node: u32, property: u16, value_type: u8, value: Computed<u32> },
}

/// Pack a resolved color into the wire `0xAARRGGBB` representation.
fn pack_color(color: ResolvedColor) -> u32 {
    let srgb = color.to_srgb();
    let r = (srgb.red.clamp(0.0, 1.0) * 255.0).round() as u32;
    let g = (srgb.green.clamp(0.0, 1.0) * 255.0).round() as u32;
    let b = (srgb.blue.clamp(0.0, 1.0) * 255.0).round() as u32;
    let a = (color.opacity.clamp(0.0, 1.0) * 255.0).round() as u32;
    (a << 24) | (r << 16) | (g << 8) | b
}

/// Encode an [`EdgeSet`] as the `BORDER_EDGES` bitmask.
fn edge_bits(edges: &EdgeSet) -> u32 {
    let mut bits = 0;
    if edges.top {
        bits |= border_edges::TOP;
    }
    if edges.leading {
        bits |= border_edges::LEADING;
    }
    if edges.bottom {
        bits |= border_edges::BOTTOM;
    }
    if edges.trailing {
        bits |= border_edges::TRAILING;
    }
    bits
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

    /// Set a `STRING`-typed property whose text lives in the frame's string
    /// section (the opcode carries a relative offset, like `SET_TEXT`).
    fn set_string_property(&mut self, id: u32, prop: u16, text: &str) {
        let offset = self.strings.len() as u32;
        self.strings
            .extend_from_slice(&(text.len() as u32).to_le_bytes());
        self.strings.extend_from_slice(text.as_bytes());
        self.opcodes.push(Opcode::new(
            category::STYLE,
            style::SET_PROPERTY,
            0,
            id,
            ((value_type::STRING as u32) << 16) | prop as u32,
            offset,
        ));
    }
}

/// Emits WaterUI views as self-contained Pathland frames, pushing them to a sink.
pub struct Emitter {
    sink: Rc<dyn Fn(Vec<Opcode>, Vec<u8>)>,
    actions: Rc<RefCell<BTreeMap<u32, BoxedAction<()>>>>,
    values: Rc<RefCell<BTreeMap<u32, Binding<f64>>>>,
    texts: Rc<RefCell<BTreeMap<u32, Binding<StyledStr>>>>,
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
            values: Rc::new(RefCell::new(BTreeMap::new())),
            texts: Rc::new(RefCell::new(BTreeMap::new())),
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
        let mut values: Vec<(u32, Binding<f64>)> = Vec::new();
        let mut texts: Vec<(u32, Binding<StyledStr>)> = Vec::new();

        let (root, next_id) = {
            let mut walk = Walk {
                builder: &mut builder,
                next_id: self.next_id,
                reactive: &mut reactive,
                actions: &mut actions,
                values: &mut values,
                texts: &mut texts,
            };
            let root = walk.any(AnyView::new(view), env, ROOT_PARENT);
            (root, walk.next_id)
        };
        self.next_id = next_id;

        for (id, action) in actions {
            self.actions.borrow_mut().insert(id, action);
        }
        for (id, value) in values {
            self.values.borrow_mut().insert(id, value);
        }
        for (id, text) in texts {
            self.texts.borrow_mut().insert(id, text);
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

    /// Write a value from a `VALUE_CHANGED` event into the control's binding.
    ///
    /// Returns `true` if a binding was found and updated. The renderer resolves
    /// the value from its own geometry (already clamped to the control range).
    pub fn set_value(&self, node_id: u32, value: f32) -> bool {
        let mut values = self.values.borrow_mut();
        match values.get_mut(&node_id) {
            Some(binding) => {
                binding.set(f64::from(value));
                true
            }
            None => false,
        }
    }

    /// Write text from a `TEXT_CHANGED` event into the field's binding.
    ///
    /// Returns `true` if a binding was found and updated.
    pub fn set_text(&self, node_id: u32, value: &str) -> bool {
        let mut texts = self.texts.borrow_mut();
        match texts.get_mut(&node_id) {
            Some(binding) => {
                binding.set(StyledStr::from(value.to_string()));
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
                Reactive::Property { node, property, value_type, value } => {
                    let guard = value.watch(move |ctx| {
                        let bits = ctx.into_value();
                        let mut builder = FrameBuilder::default();
                        builder.set_property(node, property, value_type, bits);
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
    values: &'g mut Vec<(u32, Binding<f64>)>,
    texts: &'g mut Vec<(u32, Binding<StyledStr>)>,
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
        if view.is::<Metadata<Border>>() {
            let m = *view.downcast::<Metadata<Border>>().expect("downcast border");
            let id = self.any(m.content, env, parent);
            self.border_props(id, &m.value, env);
            return id;
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
        if view.is::<Native<ToggleConfig>>() {
            let c = *view.downcast::<Native<ToggleConfig>>().expect("downcast toggle");
            return self.toggle_node(c, parent);
        }
        if view.is::<Native<SliderConfig>>() {
            let c = *view.downcast::<Native<SliderConfig>>().expect("downcast slider");
            return self.slider_node(c, parent);
        }
        if view.is::<Native<ResolvedTextFieldConfig>>() {
            let c = *view
                .downcast::<Native<ResolvedTextFieldConfig>>()
                .expect("downcast text field");
            return self.text_field_node(c, parent);
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
            let value: Computed<u32> = spacing.map(f32::to_bits).computed();
            self.builder.set_property(id, property_id::SPACING, value_type::F32, value.get());
            self.reactive.push(Reactive::Property {
                node: id,
                property: property_id::SPACING,
                value_type: value_type::F32,
                value,
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

    fn toggle_node(&mut self, config: Native<ToggleConfig>, parent: u32) -> u32 {
        let config = config.into_inner();
        // WaterUI's `ToggleStyle` is backend-owned (switch vs checkbox); Pathland
        // only models the two native primitives, so the producer maps the style
        // here — `Automatic` defaults to a switch, mirroring WaterUI's backends.
        let ct = match config.style {
            ToggleStyle::Checkbox => component_type::CHECKBOX,
            _ => component_type::SWITCH,
        };
        let label = config.label.accessibility_label();
        let id = self.emit_leaf(ct, label, parent);

        let value: Computed<u32> = config.toggle.map(u32::from).computed();
        self.builder
            .set_property(id, property_id::SELECTED, value_type::U8, value.get());
        self.reactive.push(Reactive::Property {
            node: id,
            property: property_id::SELECTED,
            value_type: value_type::U8,
            value,
        });

        let toggle = config.toggle;
        let action: BoxedAction<()> = Box::new(move |_env: &Environment| {
            toggle.set(!toggle.get());
        });
        self.actions.push((id, action));
        id
    }

    fn slider_node(&mut self, config: Native<SliderConfig>, parent: u32) -> u32 {
        let config = config.into_inner();
        let label = config.label.accessibility_label();
        let id = self.emit_leaf(component_type::SLIDER, label, parent);

        let min = *config.range.start();
        let max = *config.range.end();
        self.builder
            .set_property(id, property_id::MIN_VALUE, value_type::F32, (min as f32).to_bits());
        self.builder
            .set_property(id, property_id::MAX_VALUE, value_type::F32, (max as f32).to_bits());

        let value: Computed<u32> = config.value.map(|v| (v as f32).to_bits()).computed();
        self.builder
            .set_property(id, property_id::VALUE, value_type::F32, value.get());
        self.reactive.push(Reactive::Property {
            node: id,
            property: property_id::VALUE,
            value_type: value_type::F32,
            value,
        });

        self.values.push((id, config.value));
        id
    }

    fn text_field_node(&mut self, config: Native<ResolvedTextFieldConfig>, parent: u32) -> u32 {
        let config = config.into_inner();
        let id = self.alloc_id();
        self.builder.create_node(id, component_type::TEXT_FIELD);
        self.insert(parent, id);

        // The field's current value is the node's text, re-emitted reactively
        // as `SET_TEXT` when the binding changes.
        let value = config.value.clone();
        let content: Computed<StyledStr> = value.computed();
        self.builder.set_text(id, &content.get().to_plain().to_string());
        self.reactive.push(Reactive::Text { node: id, content });

        // Label + prompt are static `STRING` properties.
        let label = config.label.accessibility_label().get().to_plain().to_string();
        if !label.is_empty() {
            self.builder.set_string_property(id, property_id::LABEL, &label);
        }
        let prompt = config.prompt.content.get().to_plain().to_string();
        if !prompt.is_empty() {
            self.builder.set_string_property(id, property_id::PROMPT, &prompt);
        }

        self.texts.push((id, value));
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

    /// Emit a [`Border`]'s constraints onto `id`, subscribing to its (reactive)
    /// color so a change re-emits `SET_PROPERTY(BORDER_COLOR)`.
    fn border_props(&mut self, id: u32, border: &Border, env: &Environment) {
        self.builder
            .set_property(id, property_id::BORDER_WIDTH, value_type::F32, border.width.to_bits());
        if border.corner_radius != 0.0 {
            self.builder.set_property(
                id,
                property_id::BORDER_RADIUS,
                value_type::F32,
                border.corner_radius.to_bits(),
            );
        }
        self.builder
            .set_property(id, property_id::BORDER_EDGES, value_type::U32, edge_bits(&border.edges));

        let packed: Computed<u32> = border.color.resolve(env).map(pack_color).computed();
        self.builder
            .set_property(id, property_id::BORDER_COLOR, value_type::COLOR, packed.get());
        self.reactive.push(Reactive::Property {
            node: id,
            property: property_id::BORDER_COLOR,
            value_type: value_type::COLOR,
            value: packed,
        });
    }
}
