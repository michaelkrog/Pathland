//! # pathland-view-wit
//!
//! Host-side bindings for the `pathland:view/pathland` world plus a **DSL
//! bridge**: instantiate the compiled `pathland-view-wasm` component in wasmtime
//! and drive its flat `builder` interface from a `pathland_view::Node` tree.
//!
//! The bridge is what makes the DSL a uniform surface: a developer authors a
//! tree with `vstack![...]` / `text(...)` / custom views, and this crate walks
//! that `Node` tree and issues the equivalent WIT `builder` calls. Custom views
//! and core views are indistinguishable here — both resolve to the same `Node`
//! tree.

use pathland_core::property_id;
use pathland_view::Node;
use wasmtime::component::bindgen;
use wasmtime::component::{HasSelf, ResourceTable};
use wasmtime::{Config, Engine, Store};
use wasmtime_wasi::p2::add_to_linker_sync as add_wasi_to_linker;
use wasmtime_wasi::{WasiCtx, WasiCtxBuilder, WasiCtxView, WasiView};

// Component bindings for the `pathland:view/pathland` world.
bindgen!({
    world: "pathland",
    path: "../../../../wit",
});

pub use pathland::view::types::{self as types, Component, Event, Property};

/// Errors produced while driving the guest component.
#[derive(Debug)]
pub enum HostError {
    /// wasmtime failed to instantiate or run the component.
    Wasmtime(wasmtime::Error),
}

impl From<wasmtime::Error> for HostError {
    fn from(e: wasmtime::Error) -> Self {
        HostError::Wasmtime(e)
    }
}

/// The application callback provided by the host (the guest's `app.on-event`).
///
/// The `&mut Store<App>` is passed so the handler can reach host state (e.g.
/// rebuild the DSL tree and re-emit).
pub trait AppHandler: Send {
    /// Handle a raw input routed back from the guest.
    fn on_event(&mut self, event: &Event);
}

/// A null handler for tests that don't need event routing.
pub struct NullApp;

impl AppHandler for NullApp {
    fn on_event(&mut self, _event: &Event) {}
}

/// The host application type is the guest's `app` import.
///
/// `add_to_linker` requires the store data type to implement the `Host` trait;
/// we blanket-forward to the `AppHandler` trait.
impl pathland::view::types::Host for AppHost {}
impl pathland::view::app::Host for AppHost {
    fn on_event(&mut self, event: Event) {
        AppHandler::on_event(self.app.as_mut(), &event);
    }
}

/// Host-side store state: the app handler plus WASI (the wasip1 guest imports
/// the WASI reactor interfaces even though Pathland itself doesn't use them).
pub struct AppHost {
    app: Box<dyn AppHandler>,
    wasi: WasiCtx,
    table: ResourceTable,
}

impl WasiView for AppHost {
    fn ctx(&mut self) -> WasiCtxView<'_> {
        WasiCtxView {
            ctx: &mut self.wasi,
            table: &mut self.table,
        }
    }
}

/// A ready-to-drive guest component: the wasmtime store + instance.
pub struct GuestHost {
    store: Store<AppHost>,
    pathland: Pathland,
}

impl GuestHost {
    /// Instantiate the compiled `pathland-view-wasm` component.
    pub fn new(component_bytes: &[u8], app: impl AppHandler + 'static) -> Result<Self, HostError> {
        let mut config = Config::new();
        config.wasm_component_model(true);
        let engine = Engine::new(&config)?;
        let mut store = Store::new(
            &engine,
            AppHost {
                app: Box::new(app),
                wasi: WasiCtxBuilder::new().build(),
                table: ResourceTable::new(),
            },
        );

        let component = wasmtime::component::Component::new(&engine, component_bytes)?;
        let mut linker = wasmtime::component::Linker::new(&engine);
        // The guest imports the WASI preview1 reactor interfaces (from the
        // wasip1 target); satisfy them with the component-model WASI host.
        add_wasi_to_linker::<AppHost>(&mut linker)?;
        // The guest calls back into the host via `pathland:view/app/on-event`.
        pathland::view::app::add_to_linker::<_, HasSelf<_>>(&mut linker, |x| x)?;
        let pathland = Pathland::instantiate(&mut store, &component, &linker)?;

        Ok(Self { store, pathland })
    }

    /// The store's app handler (used after `dispatch` to let the host react).
    pub fn app(&mut self) -> &mut dyn AppHandler {
        self.store.data_mut().app.as_mut()
    }

    /// Run the bridge: walk a DSL `Node` tree into the guest's retained tree.
    ///
    /// The tree's node ids (from `assign_ids`) become the guest's stable ids,
    /// so re-sending an updated tree lets the guest diff and emit only deltas.
    pub fn import_tree(&mut self, root: &Node) -> Result<(), HostError> {
        import_tree(&mut self.pathland, &mut self.store, root)?;
        Ok(())
    }

    /// Emit the retained tree as a network batch (opcodes + arena delta).
    pub fn emit(&mut self) -> Result<Vec<u8>, HostError> {
        let builder = self.pathland.pathland_view_engine();
        builder.call_begin_frame(&mut self.store)?;
        builder.call_emit(&mut self.store)?;
        builder.call_end_frame(&mut self.store)?;
        let bytes = builder.call_take_batch(&mut self.store)?;
        Ok(bytes)
    }

    /// Dispatch a raw input into the guest (routed back via `app.on-event`).
    pub fn dispatch(&mut self, event: &Event) -> Result<(), HostError> {
        let input = self.pathland.pathland_view_input();
        input.call_dispatch(&mut self.store, *event)?;
        Ok(())
    }
}

/// Map a `pathland_view::Component` to the WIT `Component` variant.
fn to_wit_component(c: &pathland_view::Component) -> Component {
    match c {
        pathland_view::Component::VStack => Component::Vstack,
        pathland_view::Component::HStack => Component::Hstack,
        pathland_view::Component::Text { .. } => Component::Text,
        pathland_view::Component::Button { .. } => Component::Button,
        pathland_view::Component::Spacer => Component::Spacer,
    }
}

/// Map a protocol property id to the WIT `Property` variant.
fn to_wit_property(pid: u16) -> Option<Property> {
    match pid {
        property_id::SPACING => Some(Property::Spacing),
        property_id::PADDING => Some(Property::Padding),
        property_id::FONT_SIZE => Some(Property::FontSize),
        property_id::COLOR => Some(Property::Color),
        property_id::BACKGROUND_COLOR => Some(Property::BackgroundColor),
        _ => None,
    }
}

/// Walk a DSL `Node` tree into the guest's flat retained tree via WIT builder
/// calls. Pre-order: create each node, then set text/properties, then children.
pub fn import_tree(
    pathland: &mut Pathland,
    store: &mut Store<AppHost>,
    root: &Node,
) -> Result<(), HostError> {
    let builder = pathland.pathland_view_builder();
    import_node(builder, store, root)?;
    Ok(())
}

fn import_node(
    builder: &exports::pathland::view::builder::Guest,
    store: &mut Store<AppHost>,
    node: &Node,
) -> Result<(), HostError> {
    builder.call_create_node(&mut *store, node.id, to_wit_component(&node.component))?;
    match &node.component {
        pathland_view::Component::Text { text } => {
            builder.call_set_text(&mut *store, node.id, text.as_str())?;
        }
        pathland_view::Component::Button { label } => {
            builder.call_set_text(&mut *store, node.id, label.as_str())?;
        }
        _ => {}
    }
    for (pid, value) in &node.properties {
        if let Some(prop) = to_wit_property(*pid) {
            let f = match *pid {
                property_id::COLOR | property_id::BACKGROUND_COLOR => *value as f32,
                _ => f32::from_bits(*value),
            };
            builder.call_set_property(&mut *store, node.id, prop, f)?;
        }
    }
    // Children must exist before insertion (so the guest can link them).
    for child in &node.children {
        import_node(builder, store, child)?;
        builder.call_insert_child(&mut *store, node.id, child.id, u32::MAX)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use pathland_gtk::RenderTree;
    use pathland_core_transport::BatchDecoder;
    use pathland_view::{assign_ids, text, vstack, View};

    /// Build the compiled component bytes (built by `cargo component build`).
    fn component_bytes() -> Vec<u8> {
        let path = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../target/wasm32-wasip1/debug/pathland_wasm.wasm"
        );
        std::fs::read(path).expect("run `cargo component build -p pathland-view-wasm` first")
    }

    #[test]
    fn bridge_to_batch_to_render_tree() {
        let mut tree = vstack![text("hello"), text("world")].build();
        assign_ids(&mut tree, &mut 1);

        let mut host = GuestHost::new(&component_bytes(), NullApp).unwrap();
        host.import_tree(&tree).unwrap();
        let batch = host.emit().unwrap();

        // Decode the batch and feed the renderer's RenderTree.
        let mut decoder = BatchDecoder::new();
        let mut render = RenderTree::default();
        let batch = decoder.decode(&batch).unwrap();
        render.apply_frame(batch.as_frame());
        assert_eq!(render.nodes.len(), 3);
        let child = render.node(2).unwrap();
        assert_eq!(child.text.as_deref(), Some("hello"));
    }

    #[test]
    fn reemit_produces_only_deltas() {
        use pathland_core_transport::BatchDecoder;

        let mut tree = vstack![text("one")].build();
        assign_ids(&mut tree, &mut 1);

        let mut host = GuestHost::new(&component_bytes(), NullApp).unwrap();
        host.import_tree(&tree).unwrap();
        let first = host.emit().unwrap();
        let mut decoder = BatchDecoder::new();
        let first_count;
        {
            let batch = decoder.decode(&first).unwrap();
            first_count = batch.len();
        }
        assert!(first_count > 0);

        // Re-send the identical tree: the guest's engine diffs to zero opcodes.
        host.import_tree(&tree).unwrap();
        let second = host.emit().unwrap();
        {
            let batch = decoder.decode(&second).unwrap();
            assert_eq!(batch.len(), 0, "unchanged tree must emit zero opcodes");
        }
    }

    #[test]
    fn dispatch_routes_event_back_to_host() {
        use std::sync::{Arc, Mutex};

        struct Capture(Arc<Mutex<Option<Event>>>);
        impl AppHandler for Capture {
            fn on_event(&mut self, event: &Event) {
                *self.0.lock().unwrap() = Some(*event);
            }
        }

        let shared = Arc::new(Mutex::new(None));
        let mut host = GuestHost::new(
            &component_bytes(),
            Capture(Arc::clone(&shared)),
        )
        .unwrap();
        let event = Event::PointerDown((
            1,
            types::Point {
                x: 10.0,
                y: 20.0,
                secondary: false,
            },
        ));
        host.dispatch(&event).unwrap();
        let got = shared.lock().unwrap().take();
        assert!(matches!(got, Some(Event::PointerDown(_))));
    }
}
