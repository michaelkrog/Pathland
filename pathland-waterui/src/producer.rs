//! Producer: walk a WaterUI view tree and emit Pathland opcodes.
//!
//! The emitter is a hand-rolled recursive walker over [`AnyView`]. It handles
//! the raw native leaf types it knows about (container, text, spacer) and
//! unwraps the two metadata wrappers WaterUI uses to smuggle state past the
//! type-erasure boundary (`Metadata<Environment>` for the stack axis,
//! `Metadata<Retain>` for watcher-guard lifetimes). Any other view is a
//! composite and is expanded via [`View::body`].

use pathland_core::{component_type, Guest, RingError};
use waterui_core::{AnyView, Environment, Metadata, Native, Retain, Signal, View};
use waterui_layout::container::FixedContainer;
use waterui_layout::spacer::Spacer;
use waterui_layout::stack::Axis;
use waterui_text::TextConfig;

/// Sentinel parent id for the root node (the ring treats `0` as "no parent").
const ROOT_PARENT: u32 = 0;

/// Emits WaterUI views as Pathland opcodes into a [`Guest`] ring.
pub struct Emitter<'a> {
    guest: Guest<'a>,
    next_id: u32,
}

impl<'a> Emitter<'a> {
    /// Create an emitter writing into the given guest ring.
    pub fn new(guest: Guest<'a>) -> Self {
        Self { guest, next_id: 1 }
    }

    /// Emit a view as one frame, returning the id of the root node.
    pub fn emit<V: View>(&mut self, view: V, env: &Environment) -> Result<u32, RingError> {
        self.guest.begin_frame();
        let root = self.emit_any(AnyView::new(view), env, ROOT_PARENT)?;
        self.guest.end_frame();
        Ok(root)
    }

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

    fn emit_any(
        &mut self,
        view: AnyView,
        env: &Environment,
        parent: u32,
    ) -> Result<u32, RingError> {
        // `Metadata<Environment>` carries a scoped environment (WaterUI injects
        // the stack `Axis` this way); recurse into the content with that env.
        if view.is::<Metadata<Environment>>() {
            let m = *view.downcast::<Metadata<Environment>>().expect("downcast environment");
            return self.emit_any(m.content, &m.value, parent);
        }
        // `Metadata<Retain>` keeps watcher guards alive for the subtree's
        // lifetime; unwrap it (the retained value is dropped, which for a
        // static tree holds no guards).
        if view.is::<Metadata<Retain>>() {
            let m = *view.downcast::<Metadata<Retain>>().expect("downcast retain");
            return self.emit_any(m.content, env, parent);
        }
        if view.is::<Native<FixedContainer>>() {
            let c = *view
                .downcast::<Native<FixedContainer>>()
                .expect("downcast container");
            return self.emit_container(c, env, parent);
        }
        if view.is::<Native<TextConfig>>() {
            let c = *view.downcast::<Native<TextConfig>>().expect("downcast text");
            return self.emit_text(c, parent);
        }
        if view.is::<Native<Spacer>>() {
            let _s = *view.downcast::<Native<Spacer>>().expect("downcast spacer");
            return self.emit_spacer(parent);
        }

        // Composite view: expand its body and keep walking.
        let body = view.body(env);
        self.emit_any(AnyView::new(body), env, parent)
    }

    fn emit_container(
        &mut self,
        container: Native<FixedContainer>,
        env: &Environment,
        parent: u32,
    ) -> Result<u32, RingError> {
        let (_layout, contents) = container.into_inner().into_inner();
        let axis = env.get::<Axis>().copied().unwrap_or(Axis::Vertical);
        let ct = if axis.is_horizontal() {
            component_type::HSTACK
        } else {
            component_type::VSTACK
        };

        let id = self.alloc_id();
        self.guest.create_node(id, ct)?;
        self.insert(parent, id)?;

        for child in contents {
            self.emit_any(child, env, id)?;
        }
        Ok(id)
    }

    fn emit_text(&mut self, config: Native<TextConfig>, parent: u32) -> Result<u32, RingError> {
        let config = config.into_inner();
        let text = config.content.get().to_plain().to_string();

        let id = self.alloc_id();
        self.guest.create_node(id, component_type::TEXT)?;
        self.insert(parent, id)?;
        self.guest.set_text(id, &text)?;
        Ok(id)
    }

    fn emit_spacer(&mut self, parent: u32) -> Result<u32, RingError> {
        let id = self.alloc_id();
        self.guest.create_node(id, component_type::SPACER)?;
        self.insert(parent, id)?;
        Ok(id)
    }
}
