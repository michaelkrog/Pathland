package com.pathland.quarkus;

import com.pathland.server.PathlandConnection;
import io.quarkus.websockets.next.WebSocketConnection;

/** Adapts a Quarkus {@link WebSocketConnection} to the transport-agnostic {@link PathlandConnection}. */
final class QuarkusConnection implements PathlandConnection {

    private final WebSocketConnection connection;

    QuarkusConnection(WebSocketConnection connection) {
        this.connection = connection;
    }

    @Override
    public void send(byte[] bytes) {
        connection.sendBinary(bytes).subscribe().with(ignored -> {}, failure -> {});
    }

    @Override
    public boolean isOpen() {
        return connection.isOpen();
    }
}