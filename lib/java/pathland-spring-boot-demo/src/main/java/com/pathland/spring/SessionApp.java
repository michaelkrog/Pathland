package com.pathland.spring;

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
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.WebSocketSession;

import java.util.Map;
import java.util.function.Consumer;

/**
 * One Pathland application instance per WebSocket connection (1:1). Identical to the
 * Quarkus {@code SessionApp} except for the WebSocket transport type ({@link WebSocketSession}
 * instead of {@code WebSocketConnection}) — the view, state, and emitter code is shared.
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
    private final int rootId;

    private volatile WebSocketSession session;

    SessionApp(String sessionId, StateStore store) {
        this.state = new PersistentState(store, sessionId);
        this.root = new KitchenSinkView();

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
        this.rootId = result.rootId();
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