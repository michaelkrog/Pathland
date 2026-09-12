package com.pathland.spring;

import com.pathland.server.PathlandRegistry;
import com.pathland.view.transport.FrameCodec;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.AbstractWebSocketHandler;

import java.nio.ByteBuffer;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * The live-updates WebSocket endpoint at {@code /ws}. Sessions are 1:1; the session id
 * rides the {@code session} cookie set on the SSR page. The id is resolved
 * <strong>once per connection</strong> and memoized, so every message (events, close)
 * routes to the same session even when the cookie is absent (e.g. a client with no SSR
 * visit). The actual session logic lives in the framework-agnostic {@link PathlandRegistry}.
 */
public class PathlandSocket extends AbstractWebSocketHandler {

    private final PathlandRegistry registry;
    private final Map<WebSocketSession, String> sessionIds = new ConcurrentHashMap<>();

    public PathlandSocket(PathlandRegistry registry) {
        this.registry = registry;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String id = resolveSessionId(session);
        sessionIds.put(session, id);
        registry.open(id, new SpringConnection(session));
    }

    @Override
    public void handleMessage(WebSocketSession session, WebSocketMessage<?> message) {
        if (message instanceof BinaryMessage binary) {
            byte[] bytes = toByteArray(binary.getPayload());
            if (FrameCodec.isResync(bytes)) {
                registry.resync(sessionId(session));
            } else if (FrameCodec.isEnvironment(bytes)) {
                // The DOM client's FIRST message: seeds the session (created lazily) from
                // the ROUTE field; later messages enrich the environment (viewport, …).
                registry.environment(sessionId(session), FrameCodec.decodeEnvironment(bytes));
            } else {
                registry.dispatch(sessionId(session), bytes);
            }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        close(session);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        close(session);
    }

    private void close(WebSocketSession session) {
        String id = sessionIds.remove(session);
        if (id != null) {
            registry.close(id);
        }
    }

    /** The memoized session id for the connection (falling back to a fresh resolve). */
    private String sessionId(WebSocketSession session) {
        String id = sessionIds.get(session);
        if (id == null) {
            id = resolveSessionId(session);
            sessionIds.put(session, id);
        }
        return id;
    }

    /** The session id from the {@code session} cookie (case-insensitive), else a fresh id. */
    private String resolveSessionId(WebSocketSession session) {
        for (Map.Entry<String, List<String>> header : session.getHandshakeHeaders().entrySet()) {
            if (!"cookie".equalsIgnoreCase(header.getKey())) {
                continue;
            }
            for (String value : header.getValue()) {
                for (String part : value.split(";")) {
                    String[] kv = part.trim().split("=", 2);
                    if (kv.length == 2
                            && "session".equalsIgnoreCase(kv[0].trim())
                            && !kv[1].isBlank()) {
                        return kv[1].trim();
                    }
                }
            }
        }
        return UUID.randomUUID().toString();
    }

    /** Copy a {@link ByteBuffer} into a {@code byte[]} regardless of backing array. */
    private static byte[] toByteArray(ByteBuffer buffer) {
        ByteBuffer duplicate = buffer.duplicate();
        byte[] bytes = new byte[duplicate.remaining()];
        duplicate.get(bytes);
        return bytes;
    }
}