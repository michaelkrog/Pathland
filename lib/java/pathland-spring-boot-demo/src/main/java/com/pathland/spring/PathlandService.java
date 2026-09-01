package com.pathland.spring;

import com.pathland.state.redis.RedisStateStore;
import com.pathland.view.state.InMemoryStateStore;
import com.pathland.view.state.StateStore;
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
    private final StateStore store;

    public PathlandService() {
        this.store = redisOrFallback(new InMemoryStateStore());
    }

    /** Render the SSR HTML for a session's persisted state (request thread). */
    public String renderHtml(String sessionId) {
        SessionApp app = new SessionApp(sessionId, store);
        try {
            return app.renderHtml();
        } finally {
            app.close();
        }
    }

    public void open(String sessionId, WebSocketSession session) {
        actor.execute(() -> {
            SessionApp previous = sessions.remove(sessionId);
            if (previous != null) {
                previous.close();
            }
            SessionApp app = new SessionApp(sessionId, store);
            app.connect(session);
            sessions.put(sessionId, app);
        });
    }

    public void dispatch(String sessionId, byte[] message) {
        if (message.length > MAX_EVENT_BATCH) {
            return;
        }
        actor.execute(() -> {
            SessionApp app = sessions.get(sessionId);
            if (app != null) {
                app.dispatch(message);
            }
        });
    }

    /** Handle a META::RESYNC request: re-send the session's current tree as a snapshot. */
    public void resync(String sessionId) {
        actor.execute(() -> {
            SessionApp app = sessions.get(sessionId);
            if (app != null) {
                app.resync();
            }
        });
    }

    public void close(String sessionId) {
        actor.execute(() -> {
            SessionApp app = sessions.remove(sessionId);
            if (app != null) {
                app.close();
            }
        });
    }

    @PreDestroy
    void shutdown() {
        for (SessionApp app : sessions.values()) {
            app.close();
        }
        sessions.clear();
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