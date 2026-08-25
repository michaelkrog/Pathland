//! Pathland web demo server.
//!
//! SSRs a WaterUI view to HTML (with `data-pathland-id` for hydration), then
//! streams live opcode deltas to the browser over WebSocket and dispatches
//! inbound input events back into the app. The app state (a counter) is driven
//! by both a server-side timer and button clicks.
//!
//! Deltas are **self-contained**: each WebSocket message is one frame's opcodes
//! plus its own string section, so no aggregation, no snapshot, and nothing is
//! sent on connect — the browser renders the initial state from the SSR HTML.

use std::cell::{Cell, RefCell};
use std::rc::Rc;
use std::time::Duration;

use axum::Router;
use axum::extract::State;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::response::{Html, Response};
use axum::routing::get;
use bytes::Bytes;
use pathland_core::{Event, Opcode};
use pathland_core_transport::{decode_events, encode_frame};
use pathland_render_html::HtmlRenderer;
use pathland_waterui::Emitter;
use waterui_controls::button::button;
use waterui_core::{Binding, Computed, Environment, SignalExt, View, binding};
use waterui_layout::stack::vstack;
use waterui_text::text::text;

/// The application view (shared by the native and web demos).
fn counter_view(count: Binding<i32>) -> impl View {
    let label: Computed<String> = count.map(|c| format!("Count: {c}")).computed();
    vstack((
        text("Pathland web"),
        text(label),
        button("Increment").action({
            let c = count.clone();
            move || {
                c.set(c.get() + 1);
            }
        }),
    ))
}

/// Send + Sync state handed to axum handlers.
#[derive(Clone)]
struct AppState {
    html_rx: tokio::sync::watch::Receiver<String>,
    batch_tx: tokio::sync::broadcast::Sender<Bytes>,
    event_tx: tokio::sync::mpsc::UnboundedSender<Event>,
}

fn main() {
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .expect("runtime");
    let local = tokio::task::LocalSet::new();
    local.block_on(&rt, run());
}

async fn run() {
    let env = Environment::new();
    let count: Binding<i32> = binding(0);
    let view = counter_view(count.clone());

    let (batch_tx, _) = tokio::sync::broadcast::channel::<Bytes>(64);
    let (html_tx, html_rx) = tokio::sync::watch::channel::<String>(String::new());
    let (event_tx, mut event_rx) = tokio::sync::mpsc::unbounded_channel::<Event>();

    // Actor-local retained render state (WaterUI state is `!Send`).
    let html = Rc::new(RefCell::new(HtmlRenderer::new()));
    let root = Rc::new(Cell::new(0u32));

    let sink = {
        let html = Rc::clone(&html);
        let root = Rc::clone(&root);
        let batch_tx = batch_tx.clone();
        let html_tx = html_tx.clone();
        move |opcodes: Vec<Opcode>, strings: Vec<u8>| {
            // 1. apply the frame to the retained HTML tree (SSR state)
            html.borrow_mut().apply(&opcodes, &strings);
            // 2. encode the self-contained frame and broadcast to WS clients
            let batch = encode_frame(&opcodes, &strings);
            let _ = batch_tx.send(Bytes::from(batch));
            // 3. re-render the SSR HTML once the root is known
            let r = root.get();
            if r != 0 {
                let rendered = html.borrow().render(r);
                let _ = html_tx.send(rendered);
            }
        }
    };

    let mut emitter = Emitter::with_sink(sink);
    let root_id = emitter.emit(view, &env);
    root.set(root_id);
    let rendered = html.borrow().render(root_id);
    let _ = html_tx.send(rendered);

    // Single-threaded app actor: server timer + inbound input events.
    tokio::task::spawn_local(async move {
        let mut ticker = tokio::time::interval(Duration::from_secs(1));
        ticker.tick().await; // discard the immediate tick
        loop {
            tokio::select! {
                _ = ticker.tick() => {
                    count.set(count.get() + 1);
                }
                Some(event) = event_rx.recv() => {
                    if let Event::PointerUp { target, .. } = event {
                        emitter.invoke(target, &env);
                    }
                }
            }
        }
    });

    let state = AppState {
        html_rx,
        batch_tx,
        event_tx,
    };
    let app = Router::new()
        .route("/", get(index))
        .route("/app.js", get(app_js))
        .route("/ws", get(ws_handler))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("127.0.0.1:3000")
        .await
        .expect("bind");
    axum::serve(listener, app).await.expect("serve");
}

async fn index(State(state): State<AppState>) -> Html<String> {
    Html(state.html_rx.borrow().clone())
}

async fn app_js() -> &'static str {
    include_str!("../static/app.js")
}

async fn ws_handler(ws: WebSocketUpgrade, State(state): State<AppState>) -> Response {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(mut socket: WebSocket, state: AppState) {
    let mut batch_rx = state.batch_tx.subscribe();
    let event_tx = state.event_tx;

    loop {
        tokio::select! {
            msg = socket.recv() => {
                match msg {
                    Some(Ok(Message::Binary(data))) => {
                        if let Ok((_, events)) = decode_events(&data) {
                            for event in events {
                                let _ = event_tx.send(event);
                            }
                        }
                    }
                    Some(Ok(Message::Close(_))) | None => break,
                    _ => {}
                }
            }
            batch = batch_rx.recv() => {
                match batch {
                    Ok(bytes) => {
                        if socket.send(Message::Binary(bytes)).await.is_err() {
                            break;
                        }
                    }
                    Err(_) => break,
                }
            }
        }
    }
}
