package com.pathland.view;

/**
 * The rendering environment. Carries implicit, thread-local values that a parent
 * injects down the entire child tree (e.g. an active {@link ButtonStyle}), plus a
 * generic, hierarchical scope of {@link EnvironmentValues} keyed by
 * {@link EnvironmentKey} (SwiftUI {@code EnvironmentValues} style).
 *
 * <p>A {@code .environment(key, value)} modifier binds a value for the subtree it
 * wraps — nearest wins, so an inner binding overrides an outer one. The mount render
 * is synchronous and single-threaded, so a {@link ThreadLocal} is equivalent to
 * ScopedValue here while keeping the library on every LTS from Java 17.
 *
 * <p>Structural slots re-render their destination outside the container's render
 * path ({@code Emitter.reconcileSlot}); each node captures its incoming scope
 * ({@code PathlandNode.environmentForChildren}) so destinations that read a value
 * keep working on every re-render.
 */
public final class Environment {

    static final ThreadLocal<ButtonStyle> BUTTON_STYLE = new ThreadLocal<>();
    private static final ThreadLocal<EnvironmentValues> VALUES = ThreadLocal.withInitial(EnvironmentValues::empty);

    /** The default environment (no persistent state; buttons render with {@link PlainButtonStyle}). */
    public static final Environment DEFAULT = new Environment(null);

    private final com.pathland.view.state.PersistentState state;

    public Environment(com.pathland.view.state.PersistentState state) {
        this.state = state;
    }

    /** The button style active for the current render, defaulting to {@link PlainButtonStyle}. */
    public ButtonStyle buttonStyle() {
        ButtonStyle style = BUTTON_STYLE.get();
        return style != null ? style : PlainButtonStyle.INSTANCE;
    }

    /** The session's persistent state (null for a stateless environment). */
    public com.pathland.view.state.PersistentState state() {
        return state;
    }

    // --- generic environment values ---

    /** The current scope (empty at the top of a render). */
    public static EnvironmentValues current() {
        return VALUES.get();
    }

    /** Scoped {@code value} for {@code key}, read via the current thread-local scope. */
    public static <T> T value(EnvironmentKey<T> key) {
        return VALUES.get().get(key);
    }

    /** Temporarily set the active scope for a render (save/restore around it). */
    public static void within(EnvironmentValues scope) {
        VALUES.set(scope);
    }

    /** Restore the previous active scope (must pair with a prior {@link #within}). */
    public static void restore(EnvironmentValues previous) {
        VALUES.set(previous);
    }
}