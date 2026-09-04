package com.pathland.spring;

import com.pathland.demo.DemoTheme;
import com.pathland.demo.RouterDemo;
import com.pathland.render.html.HtmlRenderer;
import com.pathland.view.Environment;
import com.pathland.view.emit.DateInput;
import com.pathland.view.emit.Emitter;
import com.pathland.view.emit.Frame;
import com.pathland.view.emit.FrameOpcodeSink;
import com.pathland.view.emit.RenderResult;
import com.pathland.view.router.Router;
import com.pathland.view.state.PersistentState;
import com.pathland.view.state.StateStore;
import com.pathland.view.transport.EnvironmentData;
import com.pathland.view.transport.Event;
import com.pathland.view.transport.FrameCodec;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.WebSocketSession;

import java.util.Map;
import java.util.function.Consumer;

/**
 * One Pathland application instance per WebSocket connection (1:1). Identical to the
 * Quarkus {@code SessionApp} except for the WebSocket transport type ({@link WebSocketSession}
 * instead of {@code WebSocketConnection}) — the view, state, and emitter code is shared.
 *
 * <p>The platform environment (spec/OPCODE.md §Environment fields) seeds the app: the
 * router hydrates from its {@code ROUTE} field before mount (a request URL on SSR; the
 * DOM client's first message over the WebSocket), so a deep-linked URL renders the
 * right destination on the first frame. Later environment messages **enrich** the
 * session (viewport resizes, future fields) via {@link #applyEnvironment}.
 */
final class SessionApp {

    private final PersistentState state;
    private final Router router;
    private final RouterDemo root;

    private final FrameOpcodeSink sink;
    private final Emitter emitter;
    private final Map<Integer, Runnable> tapActions;
    private final Map<Integer, Consumer<String>> textInputs;
    private final Map<Integer, Consumer<Float>> valueInputs;
    private final Map<Integer, DateInput> dateInputs;
    private final Consumer<Event> navigateHandler;
    private final int rootId;

    private float viewportWidth = -1f;
    private float viewportHeight = -1f;

    private volatile WebSocketSession session;

    SessionApp(String sessionId, StateStore store, EnvironmentData env) {
        this.state = new PersistentState(store, sessionId);
        this.router = RouterDemo.router(env.route());
        this.root = RouterDemo.of(router);

        this.sink = new FrameOpcodeSink() {
            @Override
            public void endFrame() {
                super.endFrame();
                Frame frame = frame();
                if (!frame.opcodes().isEmpty()) {
                    // The mount frame (emitted in the constructor, before the session
                    // attaches) is NOT sent — the client already has the whole UI from
                    // the HTML. Only deltas + resync snapshots go out.
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
        applyEnvironment(env); // records viewport; the router already seeded from env.route()
    }

    /** Apply (or enrich) the platform environment after mount (viewport resizes, …). */
    void applyEnvironment(EnvironmentData env) {
        if (!env.route().equals(router.path())) {
            router.navigate(env.route()); // re-route if the platform moved (idempotent)
        }
        if (env.viewportWidth() > 0) {
            viewportWidth = env.viewportWidth();
        }
        if (env.viewportHeight() > 0) {
            viewportHeight = env.viewportHeight();
        }
    }

    void connect(WebSocketSession session) {
        this.session = session;
    }

    /** Re-send the current tree as a full snapshot (META::RESYNC). */
    void resync() {
        emitter.renderFull();
    }

    private void send(Frame frame) {
        WebSocketSession s = session;
        if (s == null || !s.isOpen()) {
            session = null;
            return;
        }
        byte[] bytes = FrameCodec.encodeFrame(frame);
        try {
            s.sendMessage(new BinaryMessage(bytes));
        } catch (Exception e) {
            session = null;
        }
    }

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

    void close() {
        state.close();
        emitter.destroy();
        session = null;
    }

    private static void log(String message) {
        System.out.println("[pathland] " + message);
    }
}