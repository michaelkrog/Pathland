package com.pathland.demo;

import com.pathland.view.Categories;
import com.pathland.view.Commands;
import com.pathland.view.Components;
import com.pathland.view.Environment;
import com.pathland.view.emit.Emitter;
import com.pathland.view.emit.Frame;
import com.pathland.view.emit.FrameOpcodeSink;
import com.pathland.view.emit.Opcode;
import com.pathland.view.emit.RenderResult;
import com.pathland.view.state.InMemoryStateStore;
import com.pathland.view.state.PersistentState;
import com.pathland.view.state.StateStore;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * End-to-end: the kitchen-sink root mounts, wires every section's {@code State}
 * fields into the store, emits all the protocol component types, and routes
 * events back into the bound signals.
 */
class KitchenSinkViewTest {

    @Test
    void mountsEverySectionAndReflectsPersistedState() {
        StateStore store = new InMemoryStateStore();
        store.save("count:session-1", 5);
        store.save("name:session-1", "Ada");
        store.save("value:session-1", 75f);
        store.save("dark:session-1", true);
        store.save("choice:session-1", 2);

        PersistentState state = new PersistentState(store, "session-1");
        FrameOpcodeSink sink = new FrameOpcodeSink();
        Emitter emitter = new Emitter(sink);

        emitter.mount(new KitchenSinkView(), new Environment(state));

        Frame frame = sink.frame();
        assertTrue(anySetText(frame, "Count: 5"), "counter section reflects the persisted count");
        assertTrue(anySetText(frame, "Hello, Ada!"), "text section reflects the persisted name");
        assertTrue(anySetText(frame, "Value: 75.0"), "value controls reflect the persisted value");
        assertTrue(allSetText(frame).contains("Dark: true"), "toggle summary reflects the persisted state");
        assertTrue(anySetText(frame, "Choice: 2"), "picker section reflects the persisted choice");

        for (int component : new int[] {
                Components.SCROLLVIEW, Components.GRID, Components.DIVIDER,
                Components.TOGGLE, Components.SLIDER, Components.STEPPER,
                Components.PROGRESS_VIEW, Components.GAUGE, Components.TEXT_EDITOR,
                Components.PICKER, Components.MENU, Components.COLOR_PICKER,
                Components.DATE_PICKER, Components.ZSTACK, Components.SHAPE, Components.COLOR}) {
            assertTrue(anyCreateNode(frame, component), "frame contains component 0x"
                    + Integer.toHexString(component));
        }

        state.close();
        emitter.destroy();
    }

    @Test
    void textAndValueInputsRouteIntoTheStore() {
        StateStore store = new InMemoryStateStore();
        PersistentState state = new PersistentState(store, "session-1");
        FrameOpcodeSink sink = new FrameOpcodeSink();
        Emitter emitter = new Emitter(sink);

        RenderResult result = emitter.mount(new KitchenSinkView(), new Environment(state));

        // TextField + TextEditor share the "name" binding; either edit persists it.
        assertTrue(result.textInputs().size() >= 2, "text inputs (TextField + TextEditor)");
        result.textInputs().values().iterator().next().accept("Bob");
        assertEquals(Optional.of("Bob"), store.load("name:session-1", String.class));

        // Every value control (toggles, slider, steppers, pickers, menu, color picker)
        // exposes a value input the host routes VALUE_CHANGED into.
        assertTrue(result.valueInputs().size() >= 8, "value controls expose value inputs");

        state.close();
        emitter.destroy();
    }

    private static String allSetText(Frame frame) {
        StringBuilder sb = new StringBuilder();
        for (Opcode op : frame.opcodes()) {
            if (op.category() == Categories.STYLE && op.command() == Commands.Style.SET_TEXT) {
                sb.append(frame.stringAt(op.b())).append('\n');
            }
        }
        return sb.toString();
    }

    private static boolean anySetText(Frame frame, String text) {
        for (Opcode op : frame.opcodes()) {
            if (op.category() == Categories.STYLE && op.command() == Commands.Style.SET_TEXT) {
                if (text.equals(frame.stringAt(op.b()))) {
                    return true;
                }
            }
        }
        return false;
    }

    private static boolean anyCreateNode(Frame frame, int component) {
        for (Opcode op : frame.opcodes()) {
            if (op.category() == Categories.TREE && op.command() == Commands.Tree.CREATE_NODE) {
                if (op.b() == component) {
                    return true;
                }
            }
        }
        return false;
    }
}