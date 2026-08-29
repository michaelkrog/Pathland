package com.pathland.quarkus;

import com.pathland.demo.KitchenSinkView;
import com.pathland.render.html.HtmlRenderer;
import com.pathland.view.Environment;
import com.pathland.view.emit.Emitter;
import com.pathland.view.emit.Frame;
import com.pathland.view.emit.FrameOpcodeSink;
import com.pathland.view.emit.RenderResult;
import com.pathland.view.state.PersistentState;
import com.pathland.view.state.StateStore;
import com.pathland.view.transport.Event;
import com.pathland.view.transport.FrameCodec;
import io.quarkus.websockets.next.WebSocketConnection;

import java.util.ArrayList;
import java.util.List;
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

    private final HtmlRenderer html = new HtmlRenderer();
    private final FrameOpcodeSink sink;
    private final Emitter emitter;
    private final Map<Integer, Runnable> tapActions;
    private final Map<Integer, Consumer<String>> textInputs;
    private final Map<Integer, Consumer<Float>> valueInputs;
    private final int rootId;

    /** Frames emitted before the connection attaches, replayed to it on connect. */
    private final List<Frame> pending = new ArrayList<>();

    private volatile WebSocketConnection connection;

    SessionApp(String sessionId, StateStore store) {
        this.state = new PersistentState(store, sessionId);
        this.root = new KitchenSinkView();

        // Every completed frame is applied to the session's HTML renderer (for SSR) and,
        // when connected, sent as a delta to THIS session's single client. No broadcast.
        this.sink = new FrameOpcodeSink() {
            @Override
            public void endFrame() {
                super.endFrame();
                Frame frame = frame();
                if (!frame.opcodes().isEmpty()) {
                    html.applyFrame(frame);
                    WebSocketConnection conn = connection;
                    if (conn == null || !conn.isOpen()) {
                        pending.add(frame);
                    } else {
                        send(frame);
                    }
                }
            }
        };
        this.emitter = new Emitter(sink);

        // Mount wires State fields, then renders and emits the structural frame.
        RenderResult result = emitter.mount(root, new Environment(state));
        this.tapActions = result.tapActions();
        this.textInputs = result.textInputs();
        this.valueInputs = result.valueInputs();
        this.rootId = result.rootId();
    }

    /** Wire the live connection AFTER mount (the initial frame was already SSR'd). */
    void connect(WebSocketConnection connection) {
        this.connection = connection;
        for (Frame frame : pending) {
            send(frame);
        }
        pending.clear();
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
                }
            }
        } catch (RuntimeException e) {
            log("dropping event batch: " + e.getMessage());
        }
    }

    /** The session's current SSR HTML (with the client script injected). */
    String renderHtml() {
        return html.render(rootId)
                .replace("</body>", "<script src=\"/app.js\" defer></script></body>");
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