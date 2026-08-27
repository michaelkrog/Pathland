package com.pathland.spring;

import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.AbstractWebSocketHandler;

import java.util.List;
import java.util.UUID;

/**
 * The live-updates WebSocket endpoint (Spring's counterpart to the Quarkus
 * {@code PathlandSocket}). Sessions are 1:1; the session id rides the {@code session}
 * cookie set on the SSR page.
 */
public class PathlandSocket extends AbstractWebSocketHandler {

    private final PathlandService service;

    public PathlandSocket(PathlandService service) {
        this.service = service;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        service.open(sessionId(session), session);
    }

    @Override
    public void handleMessage(WebSocketSession session, WebSocketMessage<?> message) {
        if (message instanceof BinaryMessage binary) {
            service.dispatch(sessionId(session), binary.getPayload().array());
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        service.close(sessionId(session));
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        service.close(sessionId(session));
    }

    private String sessionId(WebSocketSession session) {
        List<String> cookies = session.getHandshakeHeaders().get("cookie");
        if (cookies != null) {
            for (String header : cookies) {
                for (String part : header.split(";")) {
                    String[] kv = part.trim().split("=", 2);
                    if (kv.length == 2 && "session".equals(kv[0]) && !kv[1].isBlank()) {
                        return kv[1];
                    }
                }
            }
        }
        return UUID.randomUUID().toString();
    }
}