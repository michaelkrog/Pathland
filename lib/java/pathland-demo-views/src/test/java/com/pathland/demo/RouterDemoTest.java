package com.pathland.demo;

import com.pathland.view.Categories;
import com.pathland.view.Commands;
import com.pathland.view.Environment;
import com.pathland.view.Properties;
import com.pathland.view.emit.Emitter;
import com.pathland.view.emit.Frame;
import com.pathland.view.emit.FrameOpcodeSink;
import com.pathland.view.emit.Opcode;
import com.pathland.view.emit.RenderResult;
import com.pathland.view.router.Router;
import com.pathland.view.transport.Event;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The shared routing demo end-to-end: the router seeds from the host's initial path,
 * NavigationLinks push through the tap registry, params reach the destination, a guard
 * redirects on the first frame, the fallback serves unknown paths, and raw NAVIGATE
 * events (browser back/forward) route straight into the router.
 */
class RouterDemoTest {

    @Test
    void hostSeedRendersTheRightFirstFrame() {
        FrameOpcodeSink sink = new FrameOpcodeSink();
        new Emitter(sink).mount(RouterDemo.of(RouterDemo.router("/users/42")), Environment.DEFAULT);

        Frame frame = sink.frame();
        assertTrue(anySetText(frame, "User 42"), "the seeded :id destination rendered first");
        assertEquals("/users/42", routeOf(frame));
    }

    @Test
    void guardedInitialUrlRedirectsOnTheFirstFrame() {
        FrameOpcodeSink sink = new FrameOpcodeSink();
        new Emitter(sink).mount(RouterDemo.of(RouterDemo.router("/admin")), Environment.DEFAULT);

        Frame frame = sink.frame();
        assertTrue(anySetText(frame, "Home"), "a failing guard on the initial URL redirects home");
        assertEquals("/", routeOf(frame));
    }

    @Test
    void navigationLinkPushesThroughTheTapRegistry() {
        FrameOpcodeSink sink = new FrameOpcodeSink();
        Router router = RouterDemo.router("/");
        RenderResult result =
                new Emitter(sink).mount(RouterDemo.of(router), Environment.DEFAULT);

        assertTrue(result.tapActions().size() >= 4, "the home links are routed");
        result.tapActions().values().iterator().next().run();
        assertEquals("/users", router.current().path(), "the first link pushes to /users");
    }

    @Test
    void navigateEventPopsAndRoutes() {
        FrameOpcodeSink sink = new FrameOpcodeSink();
        Router router = RouterDemo.router("/");
        RenderResult result =
                new Emitter(sink).mount(RouterDemo.of(router), Environment.DEFAULT);
        assertNotNull(result.navigateHandler(), "the demo exposes its router's NAVIGATE sink");

        result.navigateHandler().accept(Event.navigate("https://example.com/users/7"));
        assertEquals("/users/7", router.current().path());

        router.push("/users");
        result.navigateHandler().accept(Event.navigateBack());
        assertEquals("/users/7", router.current().path(), "a no-URL NAVIGATE pops the back-stack");
    }

    private static String routeOf(Frame frame) {
        for (Opcode op : frame.opcodes()) {
            if (op.category() == Categories.STYLE && op.command() == Commands.Style.SET_PROPERTY
                    && (op.b() & 0xFFFF) == Properties.ROUTE) {
                return frame.stringAt(op.c());
            }
        }
        throw new AssertionError("no ROUTE property in frame");
    }

    private static boolean anySetText(Frame frame, String text) {
        for (Opcode op : frame.opcodes()) {
            if (op.category() == Categories.STYLE && op.command() == Commands.Style.SET_TEXT
                    && text.equals(frame.stringAt(op.b()))) {
                return true;
            }
        }
        return false;
    }
}