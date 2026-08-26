package com.pathland.view.state;

import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * An in-memory {@link StateStore}. Thread-safe ({@link ConcurrentHashMap}), so server
 * apps can read state from request threads while a session actor writes it. Zero
 * dependencies; the fallback when no durable backend is configured.
 */
public final class InMemoryStateStore<T> implements StateStore<T> {

    private final ConcurrentMap<String, T> states = new ConcurrentHashMap<>();

    @Override
    public Optional<T> load(String key, Class<T> clazz) {
        T value = states.get(key);
        if (value != null && clazz.isInstance(value)) {
            return Optional.of(value);
        }
        return Optional.empty();
    }

    @Override
    public void save(String key, T state) {
        states.put(key, state);
    }

    @Override
    public void delete(String key) {
        states.remove(key);
    }

    @Override
    public String toString() {
        return "InMemoryStateStore(" + states.size() + " keys)";
    }
}