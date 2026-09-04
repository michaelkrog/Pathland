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

    private NavigationContainer(Router router) {
        this.router = Objects.requireNonNull(router, "router");
    }

    /** A navigation slot over {@code router}. */
    public static NavigationContainer of(Router router) {
        return new NavigationContainer(router);
    }

    @Override
    public PathlandNode render(Environment env) {
        router.hydrate(env.initialRoute()); // seed from the host-injected route (idempotent)
        PathlandNode node = new PathlandNode(Components.VSTACK); // Group-backed slot
        node.structuralContent = router::destination; // reads the route signal (tracked)
        View selected = router.destination();
        if (selected != null) {
            node.children.add(selected.render(env));
        }
        // ROUTE: the current path, re-emitted by the structural effect in the same frame
        // as a destination swap (spec DSL.md §4.5 URL sync).
        node.properties.put(Properties.ROUTE, router.path());
        node.structuralStringProperty = Properties.ROUTE;
        node.structuralStringValue = router::path;
        node.navigateHandler = router::handleEvent;
        return node;
    }
}