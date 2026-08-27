package com.pathland.spring;

import com.pathland.demo.CounterView;
import com.pathland.demo.NameField;
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
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.WebSocketSession;

import java.util.Map;

/**
 * One Pathland application instance per WebSocket connection (1:1). Identical to the
 * Quarkus {@code SessionApp} except for the WebSocket transport type ({@link WebSocketSession}
 * instead of {@code WebSocketConnection}) — the view, state, and emitter code is shared.
 */
final class SessionApp {

    private final PersistentState state;
    private final CounterView root;
    private final NameField nameField;

    private final HtmlRenderer html = new HtmlRenderer();
    private final FrameOpcodeSink sink;
    private final Emitter emitter;
    private final Map<Integer, Runnable> tapActions;
    private final int rootId;

    private volatile WebSocketSession session;

    SessionApp(String sessionId, StateStore store) {
        this.state = new PersistentState(store, sessionId);
        this.root = new CounterView();
        this.nameField = root.nameField();

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

        // Mount wires State fields, then renders and emits the structural frame.
        RenderResult result = emitter.mount(root, new Environment(state));
        this.tapActions = result.tapActions();
        this.rootId = result.rootId();
    }

    void connect(WebSocketSession session) {
        this.session = session;
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
                    nameField.name().set(event.text());
                }
            }
        } catch (RuntimeException e) {
            log("dropping event batch: " + e.getMessage());
        }
    }

    String renderHtml() {
        return html.render(rootId)
                .replace("</body>", "<script src=\"/app.js\" defer></script></body>");
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