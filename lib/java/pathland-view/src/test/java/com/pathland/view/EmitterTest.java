package com.pathland.view;

import com.pathland.view.emit.Emitter;
import com.pathland.view.emit.Frame;
import com.pathland.view.emit.FrameOpcodeSink;
import com.pathland.view.emit.Opcode;
import com.pathland.view.emit.PathlandNode;
import com.pathland.view.emit.RenderResult;
import com.pathland.view.signal.Signal;
import com.pathland.view.signal.WritableSignal;
import com.pathland.view.signal.Signals;
import com.pathland.view.transport.Event;
import com.pathland.view.transport.FrameCodec;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Full pipeline: view tree -> emitter -> opcodes -> codec -> HTML-ready frame. */
class EmitterTest {

    private static long countOps(Frame frame, int category, int command) {
        return frame.opcodes().stream()
                .filter(o -> o.category() == category && o.command() == command)
                .count();
    }

    @Test
    void mountEmitsStructuralFrame() {
        FrameOpcodeSink sink = new FrameOpcodeSink();
        Emitter emitter = new Emitter(sink);

        View root = View.vstack(
                View.text("Hello"),
                View.button("Tap", () -> { }));

        RenderResult result = emitter.mount(root, Environment.DEFAULT);
        Frame frame = sink.frame();

        assertEquals(1, result.rootId());
        assertTrue(countOps(frame, Categories.TREE, Commands.Tree.CREATE_NODE) >= 3,
                "root + text + button nodes");
        assertTrue(countOps(frame, Categories.TREE, Commands.Tree.INSERT_CHILD) >= 2);
        assertTrue(countOps(frame, Categories.STYLE, Commands.Style.SET_TEXT) >= 2);
        assertTrue(countOps(frame, Categories.STYLE, Commands.Style.SET_PROPERTY) >= 1,
                "button declares EVENT_LISTENERS");
        assertEquals(1, result.tapActions().size(), "the button's tap action is routed");
    }

    @Test
    void signalDrivenDeltaEmitsOnlyTheBoundNodes() {
        FrameOpcodeSink sink = new FrameOpcodeSink();
        Emitter emitter = new Emitter(sink);

        WritableSignal<Integer> count = Signals.signal(0);
        Signal<String> label = Signals.computed(() -> "Count: " + count.get());
        View root = View.vstack(View.text("Static"), View.text(label));
        emitter.mount(root, Environment.DEFAULT);

        // The label's text node is id 3 (root=1, static text=2, reactive text=3).
        Frame initial = sink.frame();
        assertEquals(2, countOps(initial, Categories.STYLE, Commands.Style.SET_TEXT));

        count.set(5);
        Frame delta = sink.frame();
        assertEquals(1, delta.opcodes().size(), "exactly one delta opcode");
        Opcode only = delta.opcodes().get(0);
        assertEquals(Categories.STYLE, only.category());
        assertEquals(Commands.Style.SET_TEXT, only.command());
        assertEquals(3, only.a(), "only node 3 re-emits");
        assertEquals("Count: 5", delta.stringAt(only.b()));
    }

    @Test
    void unchangedSignalEmitsZeroOpcodes() {
        FrameOpcodeSink sink = new FrameOpcodeSink();
        Emitter emitter = new Emitter(sink);
        WritableSignal<String> text = Signals.signal("same");
        emitter.mount(View.vstack(View.text(text)), Environment.DEFAULT);

        text.set("same"); // equality-suppressed: nothing happens
        assertEquals(1, sink.framesProduced(), "unchanged signal must not produce a new frame");
    }

    @Test
    void reactivePropertyReEmitsOnlyThatProperty() {
        FrameOpcodeSink sink = new FrameOpcodeSink();
        Emitter emitter = new Emitter(sink);
        WritableSignal<Integer> count = Signals.signal(0);
        Signal<Color> color = Signals.computed(() -> count.get() % 2 == 0 ? Color.RED : Color.BLUE);
        emitter.mount(View.vstack(View.text("x").foregroundStyle(color)), Environment.DEFAULT);

        count.set(1);
        Frame delta = sink.frame();
        assertEquals(1, delta.opcodes().size());
        Opcode only = delta.opcodes().get(0);
        assertEquals(Categories.STYLE, only.category());
        assertEquals(Commands.Style.SET_PROPERTY, only.command());
        assertEquals(Properties.COLOR, only.b() & 0xFFFF);
        assertEquals(Color.BLUE.argb(), only.c());
    }

    @Test
    void buttonStyleScopesDownTheTree() {
        FrameOpcodeSink sink = new FrameOpcodeSink();
        Emitter emitter = new Emitter(sink);
        View root = View.vstack(
                        View.button("Increment", () -> { }))
                .buttonStyle(BorderedButtonStyle.INSTANCE);
        RenderResult result = emitter.mount(root, Environment.DEFAULT);
        Frame frame = sink.frame();

        // The styled button carries background + border + EVENT_LISTENERS props.
        assertTrue(countOps(frame, Categories.STYLE, Commands.Style.SET_PROPERTY) >= 4,
                "bordered style adds background/border/radius/listeners");
        assertEquals(1, result.tapActions().size());
    }

    @Test
    void textInputRoutesBackIntoTheSignal() {
        FrameOpcodeSink sink = new FrameOpcodeSink();
        Emitter emitter = new Emitter(sink);
        WritableSignal<String> name = Signals.signal("");
        RenderResult result = emitter.mount(View.textField("Your name", name), Environment.DEFAULT);

        assertEquals(1, result.textInputs().size(), "the text field exposes one input sink");
        assertEquals(0, result.valueInputs().size(), "a text field has no value input");

        result.textInputs().values().iterator().next().accept("Ada");
        assertEquals("Ada", name.get(), "TEXT_CHANGED writes straight into the bound signal");
    }

    @Test
    void valueInputRoutesBackIntoTheSignal() {
        FrameOpcodeSink sink = new FrameOpcodeSink();
        Emitter emitter = new Emitter(sink);
        WritableSignal<Float> value = Signals.signal(0f);
        View slider = new View() {
            @Override
            public PathlandNode render(Environment env) {
                PathlandNode node = new PathlandNode(Components.SLIDER);
                node.valueInput = value::set;
                return node;
            }
        };
        RenderResult result = emitter.mount(slider, Environment.DEFAULT);

        assertEquals(1, result.valueInputs().size(), "the value control exposes one input sink");
        result.valueInputs().values().iterator().next().accept(0.75f);
        assertEquals(0.75f, value.get(), "VALUE_CHANGED writes straight into the bound signal");
    }

    @Test
    void frameCodecRoundTrips() {
        FrameOpcodeSink sink = new FrameOpcodeSink();
        Emitter emitter = new Emitter(sink);
        emitter.mount(View.vstack(View.text("Hello Pathland")), Environment.DEFAULT);

        byte[] wire = FrameCodec.encodeFrame(sink.frame());
        Frame decoded = FrameCodec.decodeFrame(wire);
        assertEquals(sink.frame().opcodes(), decoded.opcodes());
        assertTrue(new String(decoded.strings()).contains("Hello Pathland"));
    }

    @Test
    void eventCodecRoundTrips() {
        List<Event> events = List.of(
                Event.pointerUp(4, 10.0f, 20.0f),
                Event.valueChanged(6, 0.75f),
                Event.textChanged(7, "Bob"));
        byte[] wire = FrameCodec.encodeEvents(events);
        List<Event> decoded = FrameCodec.decodeEvents(wire);
        assertEquals(3, decoded.size());
        assertEquals(Event.pointerUp(4, 10f, 20f), decoded.get(0));
        assertEquals(Event.valueChanged(6, 0.75f), decoded.get(1));
        assertEquals(Event.textChanged(7, "Bob"), decoded.get(2));
    }

    @Test
    void opcodeByteLayoutIs16BytesLittleEndian() {
        Opcode op = new Opcode(Categories.TREE, Commands.Tree.CREATE_NODE, 0, 1, Components.VSTACK, 0);
        byte[] bytes = op.toBytes();
        assertEquals(16, bytes.length);
        assertEquals(0x01, bytes[0] & 0xFF);
        assertEquals(0x01, bytes[1] & 0xFF);
        assertEquals(0x01, bytes[4] & 0xFF); // a=1
        assertEquals(0x02, bytes[8] & 0xFF); // b=0x0002 vstack
        assertEquals(op, Opcode.fromBytes(bytes));
    }
}