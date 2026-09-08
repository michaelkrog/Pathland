package com.pathland.view.router;

import com.pathland.view.View;

import java.util.Map;

/**
 * Builds the {@link View} for a matched route (spec DSL.md §4.5). The params
 * map holds the path parameters captured from the pattern (`/users/:id` →
 * {@code {id: "42"}}). Factories are lazy: the client only ever receives the
 * chosen destination's deltas.
 */
@FunctionalInterface
public interface RouteHandler {

    /** The destination view for a matched route, given its captured path params. */
    View destination(Map<String, String> params);
}