package com.pathland.view;

import com.pathland.view.router.Route;

/**
 * The rendering environment. Carries implicit, thread-local values that a parent
 * injects down the entire child tree (e.g. an active {@link ButtonStyle}).
 *
 * <p>A {@code .buttonStyle(style)} modifier binds the style for the subtree it wraps, so a
 * {@code VStack} can style every {@code Button} below it without threading a parameter
 * through each view's render method. The mount render is synchronous and single-threaded,
 * so a {@link ThreadLocal} is equivalent to ScopedValue here while keeping the library on
 * every LTS from Java 17.
 *
 * <p>The environment also carries the session's <b>initial route</b> — the host injects
 * it (a request URL on SSR; a configured route or platform deep-link on native) and the
 * router hydrates from it at mount. The app never models the platform's location handling.
 */
public final class Environment {

    static final ThreadLocal<ButtonStyle> BUTTON_STYLE = new ThreadLocal<>();

    /** The default environment (no persistent state; buttons render with {@link PlainButtonStyle}). */
    public static final Environment DEFAULT = new Environment(null, null);

    private final com.pathland.view.state.PersistentState state;
    private final Route initialRoute;

    public Environment(com.pathland.view.state.PersistentState state) {
        this(state, null);
    }

    public Environment(com.pathland.view.state.PersistentState state, Route initialRoute) {
        this.state = state;
        this.initialRoute = initialRoute;
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

    /**
     * The session's initial route (null when the host did not provide one — the router
     * falls back to {@code /}). A request URL on SSR; a configured route or platform
     * deep-link on native.
     */
    public Route initialRoute() {
        return initialRoute;
    }
}