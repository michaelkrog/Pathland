package com.pathland.view;

/**
 * The rendering environment. Carries implicit, ScopedValue-propagated values that a
 * parent injects down the entire child tree (e.g. an active {@link ButtonStyle}).
 *
 * <p>Uses Java 21+ {@link java.lang.ScopedValue}: a
 * {@code .buttonStyle(style)} modifier binds the style for the subtree it wraps, so a
 * {@code VStack} can style every {@code Button} below it without threading a parameter
 * through each view's render method.
 */
public final class Environment {

    static final ScopedValue<ButtonStyle> BUTTON_STYLE = ScopedValue.newInstance();

    /** The default environment (no persistent state; buttons render with {@link PlainButtonStyle}). */
    public static final Environment DEFAULT = new Environment(null);

    private final com.pathland.view.state.PersistentState state;

    public Environment(com.pathland.view.state.PersistentState state) {
        this.state = state;
    }

    /** The button style active for the current render, defaulting to {@link PlainButtonStyle}. */
    public ButtonStyle buttonStyle() {
        return BUTTON_STYLE.orElse(PlainButtonStyle.INSTANCE);
    }

    /** The session's persistent state (null for a stateless environment). */
    public com.pathland.view.state.PersistentState state() {
        return state;
    }
}