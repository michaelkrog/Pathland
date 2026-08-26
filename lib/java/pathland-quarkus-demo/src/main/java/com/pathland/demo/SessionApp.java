package com.pathland.demo;

import com.pathland.render.html.HtmlRenderer;
import com.pathland.view.Environment;
import com.pathland.view.emit.Emitter;
import com.pathland.view.emit.Frame;
import com.pathland.view.emit.FrameOpcodeSink;
import com.pathland.view.emit.RenderResult;
import com.pathland.view.signal.EffectRef;
import com.pathland.view.signal.Signals;
import com.pathland.view.state.StateStore;
import com.pathland.view.transport.Event;
import com.pathland.view.transport.FrameCodec;
import io.quarkus.websockets.next.WebSocketConnection;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * One Pathland application instance per WebSocket connection (1:1). Owns the session's
 * reactive state, retained tree, fine-grained emitter, HTML renderer, and the single
 * connection it sends deltas to.
 *
 * <p>The same class is also used (throwaway) for per-session SSR: it loads the session's
 * persisted state from the {@link StateStore} and renders the initial HTML. The
 * connection is wired only for the live (WebSocket) path, and only <em>after</em> mount,
 * so the mount's full frame is never re-sent — the SSR HTML already shows that state and
 * only subsequent deltas flow over the socket.
 */
final class SessionApp {

    private final String sessionId;
    private final StateStore<Integer> countStore;
    private final StateStore<String> nameStore;

    // --- reactive state (per session, owned by the view components) ---
    private final CounterView root;
    private final CounterControls controls;
    private final NameField nameField;

    private final HtmlRenderer html = new HtmlRenderer();
    private final FrameOpcodeSink sink;
    private final Emitter emitter;
    private final Map<Integer, Runnable> tapActions;
    private final int rootId;
    private final List<EffectRef> effects = new ArrayList<>();

    private volatile WebSocketConnection connection;

    SessionApp(String sessionId, StateStore<Integer> countStore, StateStore<String> nameStore) {
        this.sessionId = sessionId;
        this.countStore = countStore;
        this.nameStore = nameStore;

        this.root = new CounterView();
        this.controls = root.controls();
        this.nameField = root.nameField();
        // Restore the persisted state into the component-owned signals (before mount, so
        // the initial render/SSR already shows it).
        countStore.load(key("count"), Integer.class).ifPresent(controls.count()::set);
        nameStore.load(key("name"), String.class).ifPresent(nameField.name()::set);

        // Every completed frame is applied to the session's HTML renderer (for SSR) and,
        // when connected, sent as a delta to THIS session's single client. No broadcast.
        this.sink = new FrameOpcodeSink() {
            @Override
            public void endFrame() {
                super.endFrame();
                Frame frame = frame();
                if (!frame.opcodes().isEmpty()) {
                    html.applyFrame(frame);
                    send(frame);
                }
            }
        };
        this.emitter = new Emitter(sink);

        RenderResult result = emitter.mount(root.view(), Environment.DEFAULT);
        this.tapActions = result.tapActions();
        this.rootId = result.rootId();

        // Persist the session's state on change (cross-platform, multi-tenant keying).
        effects.add(Signals.effect(() -> {
            try {
                countStore.save(key("count"), controls.count().get());
            } catch (RuntimeException e) {
                log("persist count failed: " + e.getMessage());
            }
        }));
        effects.add(Signals.effect(() -> {
            try {
                nameStore.save(key("name"), nameField.name().get());
            } catch (RuntimeException e) {
                log("persist name failed: " + e.getMessage());
            }
        }));
    }

    private String key(String base) {
        return base + ":" + sessionId;
    }

    /** Wire the live connection AFTER mount (the initial frame was already SSR'd). */
    void connect(WebSocketConnection connection) {
        this.connection = connection;
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
                    nameField.name().set(event.text());
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

    /** Tear down: stop effects, unsubscribe the emitter, drop the connection. */
    void close() {
        for (EffectRef effect : effects) {
            effect.destroy();
        }
        emitter.destroy();
        connection = null;
    }

    private static void log(String message) {
        System.out.println("[pathland] " + message);
    }
}