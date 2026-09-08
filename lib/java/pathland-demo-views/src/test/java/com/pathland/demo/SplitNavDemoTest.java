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
import com.pathland.view.state.InMemoryStateStore;
import com.pathland.view.state.PersistentState;
import com.pathland.view.state.StateStore;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The split navigation demo (spec PRIMITIVES.md — `NavigationSplitView` → `HStack`
 * sidebar + detail): a fixed menu column on the left with three items and a
 * `NavigationContainer` content area on the right. Menu clicks navigate the router
 * (direct selection — no back-stack growth), the `/kitchen` content is the full
 * `KitchenSinkView`, and the active menu row is highlighted reactively.
 */
class SplitNavDemoTest {

    private static final int ACTIVE_BG = 0xFF_DCE4FF; // SplitNavDemo.ACTIVE_BG

    /** A session environment so the kitchen-sink content's `State` fields wire up. */
    private static Environment env() {
        StateStore store = new InMemoryStateStore();
        return new Environment(new PersistentState(store, "session-1"));
    }

    @Test
    void hostSeedRendersTheSidebarAndTheContent() {
        FrameOpcodeSink sink = new FrameOpcodeSink();
        new Emitter(sink).mount(SplitNavDemo.of(SplitNavDemo.router("/home")), env());

        Frame frame = sink.frame();
        assertTrue(anySetText(frame, "Home"), "the home menu row is rendered");
        assertTrue(anySetText(frame, "Kitchen sink"), "the kitchen sink menu row is rendered");
        assertTrue(anySetText(frame, "Settings"), "the settings menu row is rendered");
        assertTrue(anySetText(frame,
                "A master-detail (split) navigation demo: the menu on the left drives the content area on the right."),
                "the home content area rendered on the right");
        assertEquals("/home", routeOf(frame));
    }

    @Test
    void kitchenSinkRendersAsAContentArea() {
        FrameOpcodeSink sink = new FrameOpcodeSink();
        new Emitter(sink).mount(SplitNavDemo.of(SplitNavDemo.router("/kitchen")), env());

        Frame frame = sink.frame();
        assertTrue(anySetText(frame, "Pathland Kitchensink"),
                "the /kitchen content area is the full KitchenSinkView");
        assertEquals("/kitchen", routeOf(frame));
    }

    @Test
    void declarativeNavButtonInsideAContentAreaChangesTheRoute() {
        // HomeView's "Open kitchen sink" button declares `.navigate("/kitchen")` — a
        // component *inside* the NavigationContainer, so the emitter resolves it to the
        // nearest enclosing router and registers it in navigateActions (spec DSL.md §4.5).
        FrameOpcodeSink sink = new FrameOpcodeSink();
        Router router = SplitNavDemo.router("/home");
        RenderResult result = new Emitter(sink).mount(SplitNavDemo.of(router), env());

        assertTrue(result.navigateActions().size() >= 1,
                "the declarative button inside the content area registers a nav intent");
        result.navigateActions().values().iterator().next().run();
        assertEquals("/kitchen", router.current().path(),
                "the declarative .navigate button changed the route via the enclosing router");
        assertTrue(anySetText(sink.frame(), "Pathland Kitchensink"),
                "the content area swapped to the kitchen sink");
    }

    @Test
    void menuClickSwapsTheContentArea() {
        FrameOpcodeSink sink = new FrameOpcodeSink();
        Router router = SplitNavDemo.router("/home");
        RenderResult result =
                new Emitter(sink).mount(SplitNavDemo.of(router), env());

        // The menu rows capture the router explicitly (the sidebar sits outside the
        // NavigationContainer), so they navigate via the tap registry — clicking them in
        // order reaches /kitchen on the second row. Snapshot the live map first (a tap
        // re-renders and repopulates it).
        boolean reachedKitchen = false;
        for (Map.Entry<Integer, Runnable> tap : new ArrayList<>(result.tapActions().entrySet())) {
            tap.getValue().run();
            if ("/kitchen".equals(router.current().path())) {
                reachedKitchen = true;
                break;
            }
        }
        assertTrue(reachedKitchen, "clicking the Kitchen sink menu row navigates the content area");
        Frame delta = sink.frame();
        assertTrue(anySetText(delta, "Pathland Kitchensink"),
                "the kitchen sink content swap is emitted as deltas");
        assertEquals("/kitchen", routeOf(delta));
    }

    @Test
    void activeRowHighlightTracksTheRoute() {
        FrameOpcodeSink sink = new FrameOpcodeSink();
        Router router = SplitNavDemo.router("/home");
        RenderResult result =
                new Emitter(sink).mount(SplitNavDemo.of(router), env());

        // Seeded at /home: the Home row carries the active background color.
        assertTrue(anySetPropertyBits(sink.frame(), Properties.BACKGROUND_COLOR, ACTIVE_BG),
                "the active menu row emits the highlight color");

        // Selecting a menu row moves the highlight — the row's reactive background
        // re-emits. The swap and each binding effect produce their own frame, so
        // capture across taps rather than relying on the last frame.
        List<Frame> frames = new ArrayList<>();
        for (Map.Entry<Integer, Runnable> tap : new ArrayList<>(result.tapActions().entrySet())) {
            tap.getValue().run();
            frames.add(sink.frame());
            if ("/settings".equals(router.current().path())) {
                break;
            }
        }
        assertEquals("/settings", router.current().path());
        assertTrue(frames.stream().anyMatch(f -> anySetPropertyBits(f, Properties.BACKGROUND_COLOR, ACTIVE_BG)),
                "the highlight re-emits for the newly active row");
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

    private static boolean anySetPropertyBits(Frame frame, int property, int bits) {
        for (Opcode op : frame.opcodes()) {
            if (op.category() == Categories.STYLE && op.command() == Commands.Style.SET_PROPERTY
                    && (op.b() & 0xFFFF) == property && (int) op.c() == bits) {
                return true;
            }
        }
        return false;
    }
}