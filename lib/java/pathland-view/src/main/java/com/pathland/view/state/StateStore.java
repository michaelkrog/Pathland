package com.pathland.view.state;

import java.util.Optional;

/**
 * A cross-platform state store abstraction. The exact same application code runs on a
 * multi-tenant server (Redis), a desktop app (File/SQLite), a browser (LocalStorage),
 * or an embedded ESP32 (NVS Flash) by swapping the {@link StateStore} implementation —
 * component state is decoupled from the storage mechanism.
 *
 * @param <T> the state type
 */
public interface StateStore<T> {

    /** Load state for {@code key}, or empty when absent. */
    Optional<T> load(String key, Class<T> clazz);

    /** Persist {@code state} for {@code key}. */
    void save(String key, T state);

    /** Remove state for {@code key}. */
    void delete(String key);
}