package com.pathland.quarkus;

import com.pathland.demo.DemoTheme;
import com.pathland.demo.KitchenSinkView;
import com.pathland.render.html.HtmlRenderer;
import com.pathland.view.Environment;
import com.pathland.view.emit.DateInput;
import com.pathland.view.emit.Emitter;
import com.pathland.view.emit.Frame;
import com.pathland.view.emit.FrameOpcodeSink;
import com.pathland.view.emit.RenderResult;
import com.pathland.view.state.PersistentState;
import com.pathland.view.state.StateStore;
import com.pathland.view.transport.Event;
import com.pathland.view.transport.FrameCodec;
import io.quarkus.websockets.next.WebSocketConnection;

import java.util.Map;
import java.util.function.Consumer;

/**
 * One Pathland application instance per WebSocket connection (1:1). Owns the session's
 * {@link PersistentState}, retained tree, fine-grained emitter, HTML renderer, and the
 * single connection it sends deltas to.
 *
 * <p>State wiring is automatic: {@code State} fields in the shared views are connected
 * to the store at mount time (see {@link Emitter#mount}). The same class is also used
 * (throwaway) for per-session SSR. The connection is wired only for the live (WebSocket)
 * path, and only <em>after</em> mount, so the mount's full frame is never re-sent.
 */
final class SessionApp {

    private final PersistentState state;
    private final KitchenSinkView root;

    private final FrameOpcodeSink sink;
    private final Emitter emitter;
    private final Map<Integer, Runnable> tapActions;
    private final Map<Integer, Consumer<String>> textInputs;
    private final Map<Integer, Consumer<Float>> valueInputs;
    private final Map<Integer, DateInput> dateInputs;
    private final Consumer<Event> navigateHandler;
    private final int rootId;

    private volatile WebSocketConnection connection;

    SessionApp(String sessionId, StateStore store) {
        this.state = new PersistentState(store, sessionId);
        this.root = new KitchenSinkView();

        // Every completed frame is applied to the session's HTML renderer (for SSR) and,
        // when connected, sent as a delta to THIS session's single client. No broadcast.
        // The mount frame (emitted in the constructor, before the connection attaches) is
        // NOT sent — the client already has the whole UI from the HTML.
        this.sink = new FrameOpcodeSink() {
            @Override
            public void endFrame() {
                super.endFrame();
                Frame frame = frame();
                if (!frame.opcodes().isEmpty()) {
                    send(frame);
                }
            }
        };
        this.emitter = new Emitter(sink, DemoTheme.adaptive());

        // Mount wires State fields, then renders and emits the structural frame.
        RenderResult result = emitter.mount(root, new Environment(state));
        this.tapActions = result.tapActions();
        this.textInputs = result.textInputs();
        this.valueInputs = result.valueInputs();
        this.dateInputs = result.dateInputs();
        this.navigateHandler = result.navigateHandler();
        this.rootId = result.rootId();
    }

    /** Wire the live connection AFTER mount (the initial frame was already SSR'd). */
    void connect(WebSocketConnection connection) {
        this.connection = connection;
    }

    /** Re-send the current tree as a full snapshot (META::RESYNC). */
    void resync() {
        emitter.renderFull();
    }

    /** Send a delta frame to this session's single client (no broadcast). */
    private void send(Frame frame) {
        WebSocketConnection conn = connection;
        if (conn == null) {
            return;
        }
        byte[] bytes = FrameCodec.encodeFrame(frame);
        try {
            conn.sendBinary(bytes)
                    .subscribe()
                    .with(ignored -> { }, failure -> connection = null);
        } catch (RuntimeException e) {
            connection = null;
        }
    }

    /** Dispatch a binary EVENT batch (called on the app-actor thread). */
    void dispatch(byte[] message) {
        try {
            for (Event event : FrameCodec.decodeEvents(message)) {
                if (event.isPointerUp()) {
                    Runnable action = tapActions.get(event.target());
                    if (action != null) {
                        action.run();
                    }
                } else if (event.isTextChanged()) {
                    Consumer<String> sink = textInputs.get(event.target());
                    if (sink != null) {
                        sink.accept(event.text());
                    }
                } else if (event.isValueChanged()) {
                    Consumer<Float> sink = valueInputs.get(event.target());
                    if (sink != null) {
                        sink.accept(event.value());
                    }
                } else if (event.isDateChanged()) {
                    DateInput sink = dateInputs.get(event.target());
                    if (sink != null) {
                        sink.accept(event.days(), event.millisOfDay());
                    }
                } else if (event.isNavigate()) {
                    // Global (no target): route it into the mounted router's NAVIGATE sink.
                    Consumer<Event> sink = navigateHandler;
                    if (sink != null) {
                        sink.accept(event);
                    }
                }
            }
        } catch (RuntimeException e) {
            log("dropping event batch: " + e.getMessage());
        }
    }

    /** The session's current SSR HTML (with the client script injected). */
    String renderHtml() {
        HtmlRenderer renderer = HtmlRenderer.tryInstance();
        if (renderer == null) {
            return "<!DOCTYPE html><html><body><h1>Pathland renderer unavailable</h1>"
                    + "<p>Build the Rust crate so libpathland_render_html is embedded in the "
                    + "pathland-render-html jar.</p></body></html>";
        }
        return renderer.render(sink.frame(), rootId)
                .replace("</body>", "<script src=\"/pathland-dom-renderer.js\" defer></script></body>");
    }

    /** Tear down: close the persistent state, unsubscribe the emitter, drop the connection. */
    void close() {
        state.close();
        emitter.destroy();
        connection = null;
    }

    private static void log(String message) {
        System.out.println("[pathland] " + message);
    }
}