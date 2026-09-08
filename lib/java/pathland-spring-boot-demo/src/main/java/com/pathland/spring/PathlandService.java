package com.pathland.spring;

import com.pathland.state.redis.RedisStateStore;
import com.pathland.view.state.InMemoryStateStore;
import com.pathland.view.state.StateStore;
import com.pathland.view.transport.EnvironmentData;
import jakarta.annotation.PreDestroy;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.WebSocketSession;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * The application registry (Spring's counterpart to the Quarkus {@code PathlandApp}).
 * Sessions are 1:1 — each WebSocket connection owns a {@link SessionApp}; deltas flow
 * only to that client. The view/state code is shared with the Quarkus demo.
 *
 * <p>Sessions are created **lazily on the first inbound message**: the platform
 * environment (`META::ENVIRONMENT`, spec/OPCODE.md) arrives as the DOM client's first
 * message, and its {@code ROUTE} field seeds the router before mount — so a deep-linked
 * URL renders the right destination and the WebSocket tree stays consistent with the SSR
 * HTML. {@code open} only registers the pending connection; later environment messages
 * **enrich** the session via {@code applyEnvironment}.
 */
@Service
public class PathlandService {

    private static final int MAX_EVENT_BATCH = 1 << 16;

    private final ExecutorService actor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "pathland-actor");
        t.setDaemon(true);
        return t;
    });

    private final Map<String, SessionApp> sessions = new ConcurrentHashMap<>();
    private final Map<String, WebSocketSession> pending = new ConcurrentHashMap<>();
    private final StateStore store;

    public PathlandService() {
        this.store = redisOrFallback(new InMemoryStateStore());
    }

    /** Render the SSR HTML for a session (request thread), seeding the router from the request path. */
    public String renderHtml(String sessionId, String route) {
        SessionApp app = new SessionApp(sessionId, store, EnvironmentData.of(route));
        try {
            return app.renderHtml();
        } finally {
            app.close();
        }
    }

    /** Register the connection for a session id; the session is created on its first message. */
    public void open(String sessionId, WebSocketSession session) {
        actor.execute(() -> {
            SessionApp previous = sessions.remove(sessionId);
            if (previous != null) {
                previous.close();
            }
            pending.put(sessionId, session);
        });
    }

    /** Apply the platform environment: creates the session (seeded from its ROUTE field) on first contact, or enriches it after mount. */
    public void environment(String sessionId, EnvironmentData env) {
        actor.execute(() -> {
            session(sessionId, env).applyEnvironment(env);
        });
    }

    public void dispatch(String sessionId, byte[] message) {
        if (message.length > MAX_EVENT_BATCH) {
            return;
        }
        actor.execute(() -> {
            session(sessionId, EnvironmentData.of("/")).dispatch(message);
        });
    }

    /** Handle a META::RESYNC request: re-send the session's current tree as a snapshot. */
    public void resync(String sessionId) {
        actor.execute(() -> {
            session(sessionId, EnvironmentData.of("/")).resync();
        });
    }

    public void close(String sessionId) {
        actor.execute(() -> {
            pending.remove(sessionId);
            SessionApp app = sessions.remove(sessionId);
            if (app != null) {
                app.close();
            }
        });
    }

    /** Create the session on first contact, wired to its pending connection. */
    private SessionApp session(String sessionId, EnvironmentData env) {
        SessionApp app = sessions.get(sessionId);
        if (app == null) {
            WebSocketSession connection = pending.remove(sessionId);
            app = new SessionApp(sessionId, store, env);
            if (connection != null) {
                app.connect(connection);
            }
            sessions.put(sessionId, app);
        }
        return app;
    }

    @PreDestroy
    void shutdown() {
        for (SessionApp app : sessions.values()) {
            app.close();
        }
        sessions.clear();
        pending.clear();
        actor.shutdown();
    }

    private StateStore redisOrFallback(StateStore fallback) {
        try {
            StateStore redis = new RedisStateStore.Provider().store();
            redis.load("probe", Object.class);
            log("state store: redis");
            return redis;
        } catch (RuntimeException e) {
            log("state store: in-memory (Redis unavailable: " + e.getMessage() + ")");
            return fallback;
        }
    }

    private static void log(String message) {
        System.out.println("[pathland] " + message);
    }
}