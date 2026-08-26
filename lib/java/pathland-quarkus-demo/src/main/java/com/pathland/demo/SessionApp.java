package com.pathland.demo;

import com.pathland.render.html.HtmlRenderer;
import com.pathland.view.Color;
import com.pathland.view.Environment;
import com.pathland.view.View;
import com.pathland.view.emit.Emitter;
import com.pathland.view.emit.Frame;
import com.pathland.view.emit.FrameOpcodeSink;
import com.pathland.view.emit.RenderResult;
import com.pathland.view.signal.EffectRef;
import com.pathland.view.signal.Signal;
import com.pathland.view.signal.Signals;
import com.pathland.view.signal.WritableSignal;
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

    // --- reactive state (per session) ---
    private final WritableSignal<Integer> count;
    private final WritableSignal<String> name;
    private final Signal<String> countLabel;
    private final Signal<String> nameLabel;

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

        this.count = Signals.signal("count", countStore.load(key("count"), Integer.class).orElse(0));
        this.name = Signals.signal("name", nameStore.load(key("name"), String.class).orElse(""));
        this.countLabel = Signals.computed("countLabel", () -> "Count: " + count.get());
        this.nameLabel = Signals.computed("nameLabel", () -> "Name: " + name.get());

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

        RenderResult result = emitter.mount(rootView(), Environment.DEFAULT);
        this.tapActions = result.tapActions();
        this.rootId = result.rootId();

        // Persist the session's state on change (cross-platform, multi-tenant keying).
        effects.add(Signals.effect(() -> {
            try {
                countStore.save(key("count"), count.get());
            } catch (RuntimeException e) {
                log("persist count failed: " + e.getMessage());
            }
        }));
        effects.add(Signals.effect(() -> {
            try {
                nameStore.save(key("name"), name.get());
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
                    name.set(event.text());
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

    /** The demo view — the exact same DSL a desktop or Spring Boot app would use. */
    private View rootView() {
        return View.vstack(
                View.hstack(
                        View.text(countLabel),
                        View.button("Increment", () -> count.update(v -> v + 1))
                ).padding(16),
                View.textField("Your name", name),
                View.text(nameLabel),
                View.text("Pathland · Quarkus · per-session · 16-byte deltas")
                        .color(Color.rgb(0x88, 0x88, 0x88))
        ).padding(24);
    }

    private static void log(String message) {
        System.out.println("[pathland] " + message);
    }
}