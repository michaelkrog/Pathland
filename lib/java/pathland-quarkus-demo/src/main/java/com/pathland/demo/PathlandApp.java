package com.pathland.demo;

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
 * by contract). Per-session SSR runs on the request thread against thread-safe
 * {@link StateStore}s (a throwaway {@link SessionApp}).
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
    private StateStore<Integer> countStore;
    private StateStore<String> nameStore;

    @PostConstruct
    void init() {
        countStore = redisOrFallback("count", Integer.class, new InMemoryStateStore<>());
        nameStore = redisOrFallback("name", String.class, new InMemoryStateStore<>());
    }

    // ------------------------------------------------------------------
    // SSR
    // ------------------------------------------------------------------

    /** Render the SSR HTML for a session's persisted state (request thread). */
    public String renderHtml(String sessionId) {
        SessionApp app = new SessionApp(sessionId, countStore, nameStore);
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
            SessionApp app = new SessionApp(sessionId, countStore, nameStore);
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

    private <T> StateStore<T> redisOrFallback(String label, Class<T> clazz, StateStore<T> fallback) {
        try {
            StateStore<T> redis = new RedisStateStore.Provider().store(clazz);
            redis.load("probe:" + label, clazz); // probe connectivity
            log("state store: redis (" + label + ")");
            return redis;
        } catch (RuntimeException e) {
            log("state store: in-memory (" + label + ", Redis unavailable: " + e.getMessage() + ")");
            return fallback;
        }
    }

    private static void log(String message) {
        System.out.println("[pathland] " + message);
    }
}