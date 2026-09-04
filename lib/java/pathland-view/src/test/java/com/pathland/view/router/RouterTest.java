package com.pathland.view.router;

import com.pathland.view.Categories;
import com.pathland.view.Commands;
import com.pathland.view.Environment;
import com.pathland.view.Properties;
import com.pathland.view.Text;
import com.pathland.view.ValueTypes;
import com.pathland.view.View;
import com.pathland.view.emit.Emitter;
import com.pathland.view.emit.Frame;
import com.pathland.view.emit.FrameOpcodeSink;
import com.pathland.view.emit.Opcode;
import com.pathland.view.emit.RenderResult;
import com.pathland.view.transport.Event;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The router (spec DSL.md §4.5): a {@code NavigationContainer} is a structural
 * container over the router's route signal — a navigation emits destination
 * {@code TREE} deltas plus the {@code ROUTE} property for web URL sync, params and
 * guards resolve through the {@code RouteTable}, and raw {@code NAVIGATE} events
 * (native back / browser {@code popstate}) route straight into the router.
 */
class RouterTest {

    private static String lastText(Frame frame) {
        Opcode text = frame.opcodes().stream()
                .filter(o -> o.category() == Categories.STYLE && o.command() == Commands.Style.SET_TEXT)
                .reduce((a, b) -> b)
                .orElseThrow();
        return frame.stringAt(text.b());
    }

    private static long countOps(Frame frame, int category, int command) {
        return frame.opcodes().stream()
                .filter(o -> o.category() == category && o.command() == command)
                .count();
    }

    private static FrameOpcodeSink sink() {
        return new FrameOpcodeSink();
    }

    /** The router seeded the way a host seeds it before mount: {@code navigate(initialPath)}. */
    private static Router seeded(String path) {
        Router router = new Router(table());
        router.navigate(path);
        return router;
    }

    private static RouteTable table() {
        return RouteTable.builder()
                .route("/", params -> ViewStack.of(Text.of("Home")))
                .route("/users", params -> ViewStack.of(Text.of("Users")))
                .route("/users/:id", params -> Text.of("User " + params.get("id")))
                .route("/admin", params -> false, "/", params -> ViewStack.of(Text.of("Admin")))
                .fallback(params -> Text.of("Not Found"))
                .build();
    }

    /** A VSTACK-rooted destination (distinct component type from a plain Text root). */
    private record ViewStack(View child) implements View {
        static ViewStack of(View child) {
            return new ViewStack(child);
        }

        @Override
        public com.pathland.view.emit.PathlandNode render(Environment env) {
            com.pathland.view.emit.PathlandNode node =
                    new com.pathland.view.emit.PathlandNode(com.pathland.view.Components.VSTACK);
            node.children.add(child.render(env));
            return node;
        }
    }

    @Test
    void mountRendersInitialDestinationAndEmitsRoute() {
        Router router = new Router(table());
        FrameOpcodeSink sink = sink();
        RenderResult result = new Emitter(sink).mount(NavigationContainer.of(router), Environment.DEFAULT);

        Frame frame = sink.frame();
        Opcode route = frame.opcodes().stream()
                .filter(o -> o.category() == Categories.STYLE
                        && o.command() == Commands.Style.SET_PROPERTY
                        && (o.b() & 0xFFFF) == Properties.ROUTE)
                .findFirst().orElseThrow();
        assertEquals(ValueTypes.STRING, (route.b() >>> 16) & 0xFF, "ROUTE is a STRING property");
        assertEquals("/", frame.stringAt(route.c()), "the initial path is emitted");
        assertNotNull(result.navigateHandler(), "the container exposes its router's NAVIGATE sink");
    }

    @Test
    void hostSeedsTheInitialRouteBeforeMount() {
        // On SSR the host seeds the router with the request URL before mount, so the
        // first frame renders the right destination with no spurious navigation.
        FrameOpcodeSink sink = sink();
        new Emitter(sink).mount(NavigationContainer.of(seeded("/users")), Environment.DEFAULT);

        Frame frame = sink.frame();
        assertEquals("Users", lastText(frame), "the host-seeded initial route rendered");
        Opcode route = frame.opcodes().stream()
                .filter(o -> o.category() == Categories.STYLE
                        && o.command() == Commands.Style.SET_PROPERTY
                        && (o.b() & 0xFFFF) == Properties.ROUTE)
                .findFirst().orElseThrow();
        assertEquals("/users", frame.stringAt(route.c()));
    }

    @Test
    void initialUrlGuardRedirectsOnTheFirstFrame() {
        // The host seeds through navigate(...), so a request to a guarded URL resolves
        // its redirect BEFORE mount — the first frame shows the redirect target, not the
        // guarded destination.
        FrameOpcodeSink sink = sink();
        new Emitter(sink).mount(NavigationContainer.of(seeded("/admin")), Environment.DEFAULT);

        Frame frame = sink.frame();
        assertEquals("Home", lastText(frame), "a failing guard on the initial URL redirects");
        Opcode route = frame.opcodes().stream()
                .filter(o -> o.category() == Categories.STYLE
                        && o.command() == Commands.Style.SET_PROPERTY
                        && (o.b() & 0xFFFF) == Properties.ROUTE)
                .findFirst().orElseThrow();
        assertEquals("/", frame.stringAt(route.c()), "ROUTE carries the redirect target");
    }

    @Test
    void navigateSwapsDestinationAndEmitsTheRouteProperty() {
        Router router = new Router(table());
        FrameOpcodeSink sink = sink();
        new Emitter(sink).mount(NavigationContainer.of(router), Environment.DEFAULT);

        router.navigate("/users");
        Frame delta = sink.frame();

        // Structural swap (VSTACK home -> VSTACK users; the text child differs) plus ROUTE.
        assertTrue(countOps(delta, Categories.STYLE, Commands.Style.SET_PROPERTY) >= 1);
        boolean sawRoute = false;
        for (Opcode op : delta.opcodes()) {
            if (op.category() == Categories.STYLE && op.command() == Commands.Style.SET_PROPERTY
                    && (op.b() & 0xFFFF) == Properties.ROUTE) {
                assertEquals("/users", delta.stringAt(op.c()));
                sawRoute = true;
            }
        }
        assertTrue(sawRoute, "navigating re-emits the ROUTE property");
        assertTrue(countOps(delta, Categories.STYLE, Commands.Style.SET_TEXT) >= 1,
                "the destination text is re-emitted");
    }

    @Test
    void navigateToDifferentComponentEmitsTreeDeltas() {
        RouteTable table = RouteTable.builder()
                .route("/", params -> ViewStack.of(Text.of("Home")))
                .route("/plain", params -> Text.of("Plain"))
                .build();
        Router router = new Router(table);
        FrameOpcodeSink sink = sink();
        new Emitter(sink).mount(NavigationContainer.of(router), Environment.DEFAULT);

        router.navigate("/plain"); // VSTACK destination -> TEXT destination
        Frame delta = sink.frame();
        assertEquals(1, countOps(delta, Categories.TREE, Commands.Tree.REMOVE_CHILD));
        assertEquals(1, countOps(delta, Categories.TREE, Commands.Tree.DELETE_NODE));
        assertEquals(1, countOps(delta, Categories.TREE, Commands.Tree.CREATE_NODE));
        assertEquals(1, countOps(delta, Categories.TREE, Commands.Tree.INSERT_CHILD));
    }

    @Test
    void pushAndPopManageTheBackStack() {
        Router router = new Router(table());
        FrameOpcodeSink sink = sink();
        new Emitter(sink).mount(NavigationContainer.of(router), Environment.DEFAULT);

        router.push("/users");
        router.push("/users/42");
        assertEquals("/users/42", router.current().path());

        router.pop();
        assertEquals("/users", router.current().path());
        router.back();
        assertEquals("/", router.current().path());
        router.pop(); // empty stack: no-op, stays on the initial route
        assertEquals("/", router.current().path());
    }

    @Test
    void routeParamsReachTheDestination() {
        Router router = new Router(table());
        FrameOpcodeSink sink = sink();
        new Emitter(sink).mount(NavigationContainer.of(router), Environment.DEFAULT);

        router.navigate("/users/42");
        Frame delta = sink.frame();
        boolean sawUser = false;
        for (Opcode op : delta.opcodes()) {
            if (op.category() == Categories.STYLE && op.command() == Commands.Style.SET_TEXT
                    && "User 42".equals(delta.stringAt(op.b()))) {
                sawUser = true;
            }
        }
        assertTrue(sawUser, "the :id param reached the destination factory");
    }

    @Test
    void guardRedirectsInsteadOfMounting() {
        Router router = new Router(table());
        new Emitter(sink()).mount(NavigationContainer.of(router), Environment.DEFAULT);

        router.navigate("/admin"); // guard always fails -> redirect "/"
        assertEquals("/", router.current().path(), "a failing guard replaces to the redirect target");
    }

    @Test
    void fallbackServesUnknownPaths() {
        Router router = new Router(table());
        FrameOpcodeSink sink = sink();
        new Emitter(sink).mount(NavigationContainer.of(router), Environment.DEFAULT);

        router.navigate("/no-such-path");
        Frame delta = sink.frame();
        boolean sawNotFound = false;
        for (Opcode op : delta.opcodes()) {
            if (op.category() == Categories.STYLE && op.command() == Commands.Style.SET_TEXT
                    && "Not Found".equals(delta.stringAt(op.b()))) {
                sawNotFound = true;
            }
        }
        assertTrue(sawNotFound, "the fallback handler serves unmatched paths");
    }

    @Test
    void navigateEventRoutesIntoTheRouter() {
        Router router = new Router(table());
        FrameOpcodeSink sink = sink();
        RenderResult result = new Emitter(sink).mount(NavigationContainer.of(router), Environment.DEFAULT);

        assertNotNull(result.navigateHandler(), "NAVIGATE sink exposed on RenderResult");

        result.navigateHandler().accept(Event.navigate("https://example.com/users/7"));
        assertEquals("/users/7", router.current().path(), "a URL NAVIGATE routes to the path");

        router.push("/users");
        assertEquals("/users", router.current().path());
        result.navigateHandler().accept(Event.navigateBack());
        assertEquals("/users/7", router.current().path(), "a no-URL NAVIGATE pops the back-stack");
    }

    @Test
    void navigationLinkPushesThroughTheTapRegistry() {
        Router router = new Router(table());
        FrameOpcodeSink sink = sink();
        View root = new View() {
            @Override
            public com.pathland.view.emit.PathlandNode render(Environment env) {
                com.pathland.view.emit.PathlandNode node =
                        new com.pathland.view.emit.PathlandNode(com.pathland.view.Components.VSTACK);
                node.children.add(NavigationLink.of("Users", router, "/users").render(env));
                node.children.add(NavigationContainer.of(router).render(env));
                return node;
            }
        };
        RenderResult result = new Emitter(sink).mount(root, Environment.DEFAULT);

        assertTrue(result.tapActions().size() >= 1, "the link exposes a tap action");
        result.tapActions().values().iterator().next().run();
        assertEquals("/users", router.current().path(), "the link pushed the route");
    }

    @Test
    void navigatingToTheCurrentPathIsEqualitySuppressed() {
        Router router = new Router(table());
        FrameOpcodeSink sink = sink();
        new Emitter(sink).mount(NavigationContainer.of(router), Environment.DEFAULT);
        int frames = sink.framesProduced();

        router.navigate("/");
        assertEquals(frames, sink.framesProduced(), "navigating to the same route emits nothing");
    }

    @Test
    void pathOnlyStripsQueryAndFragment() {
        assertEquals("/users/42", Route.of("/users/42?tab=profile#top").pathOnly());
    }
}