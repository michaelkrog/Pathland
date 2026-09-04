package com.pathland.view.router;

import com.pathland.view.View;
import com.pathland.view.signal.Signal;
import com.pathland.view.signal.Signals;
import com.pathland.view.signal.WritableSignal;
import com.pathland.view.transport.Event;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Objects;

/**
 * App-owned navigation state (spec DSL.md §4.5): a {@code WritableSignal<Route>}
 * plus a **back-stack**. The {@code NavigationContainer} is a structural container
 * over this signal — a route change re-renders the destination subtree and the
 * emitter reconciles it into {@code TREE} deltas; the container's {@code ROUTE}
 * property carries the current path for web URL sync.
 *
 * <p>Navigation never touches a renderer: {@code navigate}/{@code push}/{@code pop}/
 * {@code replace}/{@code back} write the signal; the emitter does the rest. Native
 * back affordances and browser {@code popstate} arrive as raw {@code NAVIGATE} events
 * and are routed through {@link #handleEvent(Event)} (the host forwards them from the
 * {@code RenderResult.navigateHandler} sink).
 *
 * <p>Guards: a {@code RouteTable} guard that fails resolves to a redirect, which this
 * router applies as a {@link #replace(String)} (no back-stack entry).
 */
public final class Router {

    private final RouteTable table;
    private final WritableSignal<Route> current;
    private final Deque<Route> stack = new ArrayDeque<>();

    /** A router over {@code table}, hydrated from {@code location.initial()} at mount. */
    public Router(RouteTable table, Location location) {
        this.table = Objects.requireNonNull(table, "table");
        this.current = Signals.signal(Objects.requireNonNull(location, "location").initial());
    }

    /** The current route signal — the structural container's selector. */
    public Signal<Route> routeSignal() {
        return current.asReadonly();
    }

    /** The current route. */
    public Route current() {
        return current.get();
    }

    /** The current path (query/fragment stripped). */
    public String path() {
        return current().pathOnly();
    }

    /** Set the current route without touching the back-stack. */
    public void navigate(String path) {
        go(Route.of(path));
    }

    /** Push a route onto the back-stack and navigate to it. */
    public void push(String path) {
        stack.push(current());
        go(Route.of(path));
    }

    /** Set the current route, replacing it without touching the back-stack. */
    public void replace(String path) {
        go(Route.of(path));
    }

    /** Step back one entry of the app back-stack (no-op when empty). */
    public void pop() {
        if (!stack.isEmpty()) {
            go(stack.pop());
        }
    }

    /** Alias of {@link #pop()} (native back affordance). */
    public void back() {
        pop();
    }

    /**
     * The platform navigated to a URL — a browser back/forward {@code popstate}, a
     * deep link, or a renderer-originated URL. The app stays authoritative: it routes
     * to that path (the browser history is the web back stack, so no app-stack change).
     */
    public void handlePlatformNavigation(String url) {
        go(Route.of(pathOf(url)));
    }

    /** The pathname of a URL or an absolute path: {@code https://h/u/7?q=1} → {@code /u/7}. */
    static String pathOf(String url) {
        int scheme = url.indexOf("://");
        int start = scheme >= 0 ? url.indexOf('/', scheme + 3) : 0;
        String path = start < 0 ? "/" : url.substring(start);
        int query = path.indexOf('?');
        int fragment = path.indexOf('#');
        int end = path.length();
        if (query >= 0) {
            end = Math.min(end, query);
        }
        if (fragment >= 0) {
            end = Math.min(end, fragment);
        }
        String pathOnly = path.substring(0, end);
        return pathOnly.isEmpty() ? "/" : pathOnly;
    }

    /**
     * Host-facing {@code NAVIGATE} sink: {@code navigateBack()} pops the app stack;
     * a URL navigates to it. Wire this to {@code RenderResult.navigateHandler}.
     */
    public void handleEvent(Event event) {
        if (event.isNavigateBack()) {
            back();
        } else if (event.url() != null) {
            handlePlatformNavigation(event.url());
        }
    }

    /**
     * The destination {@link View} for the current route (the structural container's
     * content function). A guard redirect resolves via {@link #go} before this is
     * reached; here only destinations (or the table's fallback / empty slot) occur.
     */
    public View destination() {
        RouteTable.RouteMatch match = table.match(path()).orElse(null);
        if (match == null || match.isRedirect()) {
            return null; // no match, no fallback → the slot is empty
        }
        return match.handler().destination(match.params());
    }

    private void go(Route route) {
        RouteTable.RouteMatch match = table.match(route.path()).orElse(null);
        if (match != null && match.isRedirect()) {
            current.set(Route.of(match.redirect())); // guard blocked: replace, not mount
            return;
        }
        current.set(route);
    }
}