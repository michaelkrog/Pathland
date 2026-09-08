package com.pathland.view.router;

import com.pathland.view.Components;
import com.pathland.view.Environment;
import com.pathland.view.Properties;
import com.pathland.view.View;
import com.pathland.view.emit.PathlandNode;

import java.util.Objects;

/**
 * The navigation slot (spec DSL.md §4.5): a structural container
 * (spec DSL.md §3.4) whose single child is the current route's destination. On a
 * route change the emitter reconciles the slot — emitting only {@code TREE} deltas
 * plus the {@code ROUTE} property in the same frame (the DOM client reacts with
 * {@code history.pushState}). The slot materializes as a {@code Group} (a bare
 * {@code VSTACK} node with no spacing/alignment).
 *
 * <p>The container also registers its router's {@code NAVIGATE} handler, which the
 * emitter surfaces on {@code RenderResult.navigateHandler} so a host can forward raw
 * {@code NAVIGATE} events (native back, browser {@code popstate}) straight into the
 * router.
 */
public final class NavigationContainer implements View {

    private final Router router;
    private final Chrome chrome;

    private NavigationContainer(Router router, Chrome chrome) {
        this.router = Objects.requireNonNull(router, "router");
        this.chrome = Objects.requireNonNull(chrome, "chrome");
    }

    /** A navigation slot over {@code router}, with the renderer's default chrome. */
    public static NavigationContainer of(Router router) {
        return new NavigationContainer(router, Chrome.PLATFORM_DEFAULT);
    }

    /** A navigation slot over {@code router} with an explicit chrome mode. */
    public static NavigationContainer of(Router router, Chrome chrome) {
        return new NavigationContainer(router, chrome);
    }

    @Override
    public PathlandNode render(Environment env) {
        PathlandNode node = new PathlandNode(Components.VSTACK); // Group-backed slot
        node.structuralContent = router::destination; // reads the route signal (tracked)
        View selected = router.destination();
        if (selected != null) {
            node.children.add(selected.render(env));
        }
        // ROUTE: the current path, re-emitted by the structural effect in the same frame
        // as a destination swap (spec DSL.md §4.5 URL sync). NAV_DEPTH: the back-stack
        // depth, so native navigation adapters reconcile their page stack by depth.
        // TRANSITION: a presentation hint (PlatformDefault) so renderers may animate
        // the swap — never state.
        node.properties.put(Properties.ROUTE, router.path());
        node.structuralStringProperty = Properties.ROUTE;
        node.structuralStringValue = router::path;
        node.properties.put(Properties.NAV_DEPTH, router.depth());
        node.structuralU32Property = Properties.NAV_DEPTH;
        node.structuralU32Value = router::depth;
        // Chrome mode: a static property (never varies per destination) — the
        // renderer supplies default chrome, or the developer owns all nav UI.
        node.properties.put(Properties.NAV_CHROME, (float) chrome.wire());
        node.properties.put(Properties.TRANSITION, 1f); // PlatformDefault
        node.navigateHandler = router::handleEvent;
        node.router = router; // the nearest-enclosing router for declarative route intents
        return node;
    }
}