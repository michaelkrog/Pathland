package com.pathland.view.router;

import java.util.Objects;

/**
 * A configured/native initial route — the desktop/native {@link Location}
 * (spec DSL.md §4.5). The app's back-stack is app-owned; the platform's back
 * affordance arrives as a {@code NAVIGATE} event without a URL.
 *
 * @param initial the initial route
 */
public record InMemoryLocation(Route initial) implements Location {

    public static InMemoryLocation of(String path) {
        return new InMemoryLocation(Route.of(path));
    }

    public InMemoryLocation {
        Objects.requireNonNull(initial, "initial");
    }
}