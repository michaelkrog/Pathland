package com.pathland.quarkus;

import io.quarkus.arc.Arc;
import io.quarkus.arc.ClientProxy;
import io.quarkus.websockets.next.OnBinaryMessage;
import io.quarkus.websockets.next.OnClose;
import io.quarkus.websockets.next.OnOpen;
import io.quarkus.websockets.next.WebSocket;
import io.quarkus.websockets.next.WebSocketConnection;
import jakarta.inject.Inject;

import java.util.UUID;

/**
 * The live-updates WebSocket endpoint. Sessions are <strong>1:1</strong>: the session id
 * is carried by the {@code session} cookie set on the SSR page (the browser sends it
 * automatically on the handshake), and each connection owns its own {@link SessionApp}.
 * The server pushes deltas only to that one connection; the client sends binary
 * {@code EVENT} batches back into the same session's reactive state.
 */
@WebSocket(path = "/ws")
public class PathlandSocket {

    @Inject
    WebSocketConnection connection;

    @Inject
    PathlandApp app;

    @OnOpen
    void open() {
        // Resolve the concrete connection while the session context is active: the CDI
        // bean is session-scoped, so its client proxy would fail off-thread. ClientProxy
        // unwraps it to the real WebSocketConnectionBase, whose send methods work from
        // any thread.
        WebSocketConnection resolved =
                ClientProxy.unwrap(Arc.container().instance(WebSocketConnection.class).get());
        app.open(sessionId(), resolved);
    }

    @OnClose
    void close() {
        app.close(sessionId());
    }

    @OnBinaryMessage
    void onBinary(byte[] message) {
        app.dispatch(sessionId(), message);
    }

    /** The session id from the {@code session} cookie sent on the handshake. */
    private String sessionId() {
        String cookie = connection.handshakeRequest().header("Cookie");
        if (cookie == null) {
            return UUID.randomUUID().toString();
        }
        for (String part : cookie.split(";")) {
            String[] kv = part.trim().split("=", 2);
            if (kv.length == 2 && "session".equals(kv[0]) && !kv[1].isBlank()) {
                return kv[1];
            }
        }
        return UUID.randomUUID().toString();
    }
}