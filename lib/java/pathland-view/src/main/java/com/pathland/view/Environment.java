package com.pathland.view;

/**
 * The rendering environment. Carries implicit, thread-local values that a parent
 * injects down the entire child tree (e.g. an active {@link ButtonStyle}).
 *
 * <p>A {@code .buttonStyle(style)} modifier binds the style for the subtree it wraps, so a
 * {@code VStack} can style every {@code Button} below it without threading a parameter
 * through each view's render method. The mount render is synchronous and single-threaded,
 * so a {@link ThreadLocal} is equivalent to ScopedValue here while keeping the library on
 * every LTS from Java 17.
 */
public final class Environment {

    static final ThreadLocal<ButtonStyle> BUTTON_STYLE = new ThreadLocal<>();

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
}