package com.pathland.demo;

import com.pathland.view.Text;
import com.pathland.view.VStack;
import com.pathland.view.View;
import com.pathland.view.router.NavigationContainer;
import com.pathland.view.router.NavigationLink;
import com.pathland.view.router.RouteTable;
import com.pathland.view.router.Router;

/**
 * The shared routing demo (spec DSL.md §4.5): Home → Users → UserDetail({@code :id})
 * with {@code NavigationLink}s, a guarded route (admin redirects home), and a 404
 * fallback. Consumed by both SSR demos. The router is app state — the host seeds it
 * with the initial path before mount; browser back/forward arrive as {@code NAVIGATE}
 * events through the session's {@code RenderResult.navigateHandler}.
 */
public final class RouterDemo implements View {

    private final Router router;

    private RouterDemo(Router router) {
        this.router = router;
    }

    /** The demo view over a router. */
    public static RouterDemo of(Router router) {
        return new RouterDemo(router);
    }

    /**
     * A router over the demo table, seeded with the host's initial path (a request URL
     * on SSR). The initial path flows through the same route-table/guard matching as
     * any navigation, so a guarded request redirects on the first frame.
     */
    public static Router router(String initialPath) {
        Router[] link = new Router[1]; // destinations capture the router (built below)
        Router router = new Router(RouteTable.builder()
                .route("/", p -> home(link[0]))
                .route("/users", p -> users(link[0]))
                .route("/users/:id", p -> userDetail(link[0], p.get("id")))
                .route("/admin", p -> false, "/", p -> Text.of("Admin")) // guard always redirects home
                .fallback(p -> Text.of("Not Found"))
                .build());
        link[0] = router;
        router.navigate(initialPath);
        return router;
    }

    @Override
    public View body() {
        return NavigationContainer.of(router);
    }

    private static View home(Router router) {
        return VStack.of(
                Text.of("Home"),
                NavigationLink.of("Users", router, "/users"),
                NavigationLink.of("User 1", router, "/users/1"),
                NavigationLink.of("User 2", router, "/users/2"),
                NavigationLink.of("Admin (guarded)", router, "/admin"));
    }

    private static View users(Router router) {
        return VStack.of(
                Text.of("Users"),
                NavigationLink.of("User 1", router, "/users/1"),
                NavigationLink.of("User 2", router, "/users/2"),
                NavigationLink.of("Home", router, "/"));
    }

    private static View userDetail(Router router, String id) {
        return VStack.of(
                Text.of("User " + id),
                NavigationLink.of("Back to users", router, "/users"));
    }
}