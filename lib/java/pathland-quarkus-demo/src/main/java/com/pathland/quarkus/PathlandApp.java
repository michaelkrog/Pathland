package com.pathland.quarkus;

import com.pathland.state.redis.RedisStateStore;
import com.pathland.view.state.InMemoryStateStore;
import com.pathland.view.state.StateStore;
import io.quarkus.websockets.next.WebSocketConnection;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * The application registry. Sessions are <strong>1:1</strong> — each WebSocket connection
 * owns a {@link SessionApp} with its own reactive state; deltas flow only to that client
 * (never broadcast). The registry routes inbound events and tears sessions down.
 *
 * <p>All session work is serialized on a single actor thread (signals are single-threaded
 * by contract). Per-session SSR runs on the request thread against the thread-safe
 * {@link StateStore} (a throwaway {@link SessionApp}).
 *
 * <p>State is persisted through {@link StateStore} keyed by session id — Redis when
 * reachable, with an in-memory fallback — so the identical view code runs unchanged on a
 * server, a desktop app, a browser, or an embedded device by swapping the store.
 */
@ApplicationScoped
public class PathlandApp {

    private static final int MAX_EVENT_BATCH = 1 << 16;

    private final ExecutorService actor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "pathland-actor");
        t.setDaemon(true);
        return t;
    });

    private final Map<String, SessionApp> sessions = new ConcurrentHashMap<>();
    private StateStore store;

    @PostConstruct
    void init() {
        store = redisOrFallback(new InMemoryStateStore());
    }

    // ------------------------------------------------------------------
    // SSR
    // ------------------------------------------------------------------

    /** Render the SSR HTML for a session's persisted state (request thread). */
    public String renderHtml(String sessionId) {
        SessionApp app = new SessionApp(sessionId, store);
        try {
            return app.renderHtml();
        } finally {
            app.close();
        }
    }

    // ------------------------------------------------------------------
    // WebSocket (1:1 sessions)
    // ------------------------------------------------------------------

    /** Create (or replace) the session for a connection; wires deltas to it only. */
    public void open(String sessionId, WebSocketConnection connection) {
        actor.execute(() -> {
            SessionApp previous = sessions.remove(sessionId);
            if (previous != null) {
                previous.close();
            }
            SessionApp app = new SessionApp(sessionId, store);
            app.connect(connection);
            sessions.put(sessionId, app);
        });
    }

    /** Route an inbound event batch to the owning session. */
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

    /** Close and remove a session. */
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
            redis.load("probe", Object.class); // probe connectivity
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