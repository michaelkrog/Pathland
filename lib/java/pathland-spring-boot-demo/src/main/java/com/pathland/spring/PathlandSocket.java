package com.pathland.spring;

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
 * The live-updates WebSocket endpoint (Spring's counterpart to the Quarkus
 * {@code PathlandSocket}). Sessions are 1:1; the session id rides the {@code session}
 * cookie set on the SSR page. The id is resolved <strong>once per connection</strong>
 * and memoized, so every message (events, close) routes to the same session even when
 * the cookie is absent (e.g. an Angular client with no SSR visit).
 */
public class PathlandSocket extends AbstractWebSocketHandler {

    private final PathlandService service;
    private final Map<WebSocketSession, String> sessionIds = new ConcurrentHashMap<>();

    public PathlandSocket(PathlandService service) {
        this.service = service;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String id = resolveSessionId(session);
        sessionIds.put(session, id);
        service.open(id, session);
    }

    @Override
    public void handleMessage(WebSocketSession session, WebSocketMessage<?> message) {
        if (message instanceof BinaryMessage binary) {
            service.dispatch(sessionId(session), toByteArray(binary.getPayload()));
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
            service.close(id);
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