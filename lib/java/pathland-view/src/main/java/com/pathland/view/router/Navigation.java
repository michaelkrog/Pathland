package com.pathland.view.router;

import com.pathland.view.View;
import com.pathland.view.signal.Signal;
import com.pathland.view.signal.Signals;

import java.util.function.Predicate;

/**
 * The ergonomic facade for routing and navigation (spec DSL.md §4.5) — the primary
 * authoring surface on top of the lower-level {@link Router}/{@link RouteTable}/
 * {@link NavigationContainer} primitives. Builds a seeded {@link Router} from a
 * fluent route list, wraps it in a {@link NavigationContainer}, and offers helpers
 * for active-route styling:
 *
 * <pre>{@code
 * Router router = Navigation.navigator("/kitchen")        // seeds the initial path
 *     .route("/",           new HomeView())
 *     .route("/kitchen",    new KitchenSinkView())
 *     .route("/settings",   new SettingsView())
 *     .route("/users/:id",  params -> new UserDetailView(params.intValue("id")))
 *     .fallback(new NotFoundView())
 *     .build();
 *
 * View shell = Navigation.of(router);                     // the navigation slot
 * Signal<Boolean> onKitchen = Navigation.isActive(router, "/kitchen");
 * }</pre>
 */
public final class Navigation {

    private Navigation() {}

    /** The navigation container over {@code router} ({@code NavigationContainer.of}). */
    public static NavigationContainer of(Router router) {
        return NavigationContainer.of(router);
    }

    /** The navigation container over {@code router} with an explicit chrome mode. */
    public static NavigationContainer of(Router router, Chrome chrome) {
        return NavigationContainer.of(router, chrome);
    }

    /** A route list builder for a router seeded at {@code /}. */
    public static Builder navigator() {
        return new Builder("/");
    }

    /** A route list builder for a router seeded at {@code initialPath} (deep link). */
    public static Builder navigator(String initialPath) {
        return new Builder(initialPath);
    }

    /**
     * A reactive "is this the active route" signal derived from the router's route
     * signal ({@code true} when {@code router.path() == path}). Tracks the route, so
     * it re-emits when navigation changes it — use it to style an active menu row or
     * gate conditional content.
     */
    public static Signal<Boolean> isActive(Router router, String path) {
        return Signals.computed(() -> router.path().equals(path));
    }

    /** A fluent route list → seeded {@link Router} builder. */
    public static final class Builder {

        private final RouteTable.Builder table = RouteTable.builder();
        private final String initialPath;

        private Builder(String initialPath) {
            this.initialPath = initialPath;
        }

        /** A path → destination (no params). */
        public Builder route(String pattern, View view) {
            table.route(pattern, view);
            return this;
        }

        /** A path → destination (with params). */
        public Builder route(String pattern, RouteHandler handler) {
            table.route(pattern, handler);
            return this;
        }

        /** A path → destination gated by a guard; on failure it redirects to {@code redirect}. */
        public Builder route(String pattern, Predicate<Params> guard, String redirect, View view) {
            table.route(pattern, guard, redirect, view);
            return this;
        }

        /** A path → destination gated by a guard (params destination). */
        public Builder route(String pattern, Predicate<Params> guard, String redirect, RouteHandler handler) {
            table.route(pattern, guard, redirect, handler);
            return this;
        }

        /** The catch-all handler (404). */
        public Builder fallback(View view) {
            table.fallback(view);
            return this;
        }

        /** The catch-all handler (404). */
        public Builder fallback(RouteHandler handler) {
            table.fallback(handler);
            return this;
        }

        /** Build the router over the route list and seed it with the initial path. */
        public Router build() {
            Router router = new Router(table.build());
            router.navigate(initialPath);
            return router;
        }
    }
}