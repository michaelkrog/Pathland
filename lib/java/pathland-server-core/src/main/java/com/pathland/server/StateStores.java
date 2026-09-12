package com.pathland.server;

import com.pathland.state.redis.RedisStateStore;
import com.pathland.view.state.StateStore;

/**
 * Default {@link StateStore} selection: Redis when reachable, otherwise the supplied
 * fallback (typically an in-memory store). The app may override with its own
 * {@code StateStore} bean.
 */
public final class StateStores {

    private StateStores() {}

    /** A Redis store when reachable, else {@code fallback}. */
    public static StateStore redisOrFallback(StateStore fallback) {
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