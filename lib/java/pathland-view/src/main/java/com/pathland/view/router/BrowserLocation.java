package com.pathland.view.router;

import java.util.Objects;

/**
 * The web {@link Location}: the browser's URL at request time (spec DSL.md §4.5).
 * On SSR the app hydrates the router from this URL, so the first frame renders the
 * right destination and the initial document already carries the correct URL (no
 * {@code pushState}). The browser stays a mirror of the app afterwards: the DOM
 * client pushes on the {@code ROUTE} property and reports {@code popstate} back as
 * a {@code NAVIGATE} event.
 *
 * @param url the browser URL at request time (may carry query/fragment)
 */
public record BrowserLocation(String url) implements Location {

    public static BrowserLocation of(String url) {
        return new BrowserLocation(url);
    }

    public BrowserLocation {
        Objects.requireNonNull(url, "url");
    }

    @Override
    public Route initial() {
        return Route.of(url);
    }
}