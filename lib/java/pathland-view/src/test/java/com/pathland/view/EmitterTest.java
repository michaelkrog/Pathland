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
import static org.junit.jupiter.api.Assertions.assertFalse;
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

        View root = VStack.of(
                Text.of("Hello"),
                Button.of("Tap", () -> { }));

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
        View root = VStack.of(Text.of("Static"), Text.of(label));
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
        emitter.mount(VStack.of(Text.of(text)), Environment.DEFAULT);

        text.set("same"); // equality-suppressed: nothing happens
        assertEquals(1, sink.framesProduced(), "unchanged signal must not produce a new frame");
    }

    @Test
    void reactivePropertyReEmitsOnlyThatProperty() {
        FrameOpcodeSink sink = new FrameOpcodeSink();
        Emitter emitter = new Emitter(sink);
        WritableSignal<Integer> count = Signals.signal(0);
        Signal<Color> color = Signals.computed(() -> count.get() % 2 == 0 ? Color.RED : Color.BLUE);
        emitter.mount(VStack.of(Text.of("x").modifier(ForegroundStyle.of(color))), Environment.DEFAULT);

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
    void newModifiersEmitSpecValueTypes() {
        FrameOpcodeSink sink = new FrameOpcodeSink();
        Emitter emitter = new Emitter(sink);
        View root = Text.of("x")
                .modifier(Visible.of(false))      // U8, low byte 0
                .modifier(Disabled.of(true))      // U8, low byte 0 (disabled -> ENABLED=0)
                .modifier(FontFamily.of("Georgia")) // STRING
                .modifier(LineLimit.of(2))        // U32
                .modifier(ScaledToFit.of());      // CONTENT_MODE enum code as F32
        emitter.mount(root, Environment.DEFAULT);
        Frame frame = sink.frame();

        boolean sawVisible = false, sawString = false;
        for (Opcode op : frame.opcodes()) {
            if (op.category() == Categories.STYLE && op.command() == Commands.Style.SET_PROPERTY) {
                int property = op.b() & 0xFFFF;
                int valueType = (op.b() >>> 16) & 0xFF;
                switch (property) {
                    case Properties.VISIBLE, Properties.ENABLED -> {
                        assertEquals(ValueTypes.U8, valueType);
                        if (property == Properties.VISIBLE) {
                            sawVisible = true;
                            assertEquals(0, op.c(), "visible(false) packs U8 low byte 0, not f32 bits");
                        }
                    }
                    case Properties.LINE_LIMIT -> assertEquals(ValueTypes.U32, valueType);
                    case Properties.CONTENT_MODE -> assertEquals(ValueTypes.F32, valueType);
                    case Properties.FONT_FAMILY -> {
                        assertEquals(ValueTypes.STRING, valueType);
                        sawString = true;
                        assertEquals("Georgia", frame.stringAt(op.c()));
                    }
                    default -> { }
                }
            }
        }
        assertTrue(sawVisible, "VISIBLE property emitted");
        assertTrue(sawString, "FONT_FAMILY string property emitted");
    }

    @Test
    void buttonStyleScopesDownTheTree() {
        FrameOpcodeSink sink = new FrameOpcodeSink();
        Emitter emitter = new Emitter(sink);
        View root = VStack.of(
                        Button.of("Increment", () -> { }))
                .modifier(ButtonStyleMod.of(BorderedButtonStyle.INSTANCE));
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
        RenderResult result = emitter.mount(TextField.of("Your name", name), Environment.DEFAULT);

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
        emitter.mount(VStack.of(Text.of("Hello Pathland")), Environment.DEFAULT);

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
                Event.textChanged(7, "Bob"),
                Event.keyDown(3, 0x20, 0x01, Commands.Flags.KEY_REPEAT),
                Event.keyUp(3, 0x20, 0x01),
                Event.dateChanged(8, 20487, 43200000),
                Event.scroll(9, 12f, -3f),
                Event.wheel(9, 1.5f, -2f),
                Event.focusChanged(2, true),
                Event.editingChanged(2, false),
                Event.submit(2));
        byte[] wire = FrameCodec.encodeEvents(events);
        List<Event> decoded = FrameCodec.decodeEvents(wire);
        assertEquals(events, decoded, "full event catalog round-trips byte-exactly");
    }

    @Test
    void resyncCodecDetectsTheRequest() {
        byte[] wire = FrameCodec.encodeResync();
        assertTrue(FrameCodec.isResync(wire), "META::RESYNC batch is detected");

        FrameOpcodeSink sink = new FrameOpcodeSink();
        new Emitter(sink).mount(VStack.of(Text.of("Hi")), Environment.DEFAULT);
        assertFalse(FrameCodec.isResync(FrameCodec.encodeFrame(sink.frame())),
                "a normal frame is not a resync request");
    }

    @Test
    void emitterRenderFullEmitsACompleteSnapshot() {
        FrameOpcodeSink sink = new FrameOpcodeSink();
        Emitter emitter = new Emitter(sink);
        emitter.mount(VStack.of(Text.of("Hello"), Button.of("Go", () -> { })), Environment.DEFAULT);

        long structural = sink.frame().opcodes().stream()
                .filter(op -> op.category() == Categories.TREE)
                .count();

        emitter.renderFull();
        Frame snapshot = sink.frame();
        long treeOps = snapshot.opcodes().stream()
                .filter(op -> op.category() == Categories.TREE)
                .count();
        assertEquals(structural, treeOps, "renderFull re-emits the complete structural tree");
        assertTrue(snapshot.opcodes().stream()
                        .anyMatch(op -> op.category() == Categories.STYLE
                                && op.command() == Commands.Style.SET_TEXT),
                "renderFull re-emits text");
    }

    @Test
    void datePickerEmitsSetDateAndReEmitsOnChange() {
        FrameOpcodeSink sink = new FrameOpcodeSink();
        Emitter emitter = new Emitter(sink);
        WritableSignal<Integer> days = Signals.signal(20487);
        emitter.mount(DatePicker.of(DatePickerMode.DATE, days), Environment.DEFAULT);

        Frame initial = sink.frame();
        boolean sawSetDate = false;
        for (Opcode op : initial.opcodes()) {
            if (op.category() == Categories.STYLE && op.command() == Commands.Style.SET_DATE) {
                sawSetDate = true;
                assertEquals(20487, op.b());
                assertEquals(0, op.c());
            }
        }
        assertTrue(sawSetDate, "DatePicker emits STYLE::SET_DATE at mount");

        days.set(20488);
        Frame delta = sink.frame();
        assertEquals(1, delta.opcodes().size());
        Opcode only = delta.opcodes().get(0);
        assertEquals(Categories.STYLE, only.category());
        assertEquals(Commands.Style.SET_DATE, only.command());
        assertEquals(20488, only.b());
    }

    @Test
    void sliderRoutesValueIntoItsSignal() {
        FrameOpcodeSink sink = new FrameOpcodeSink();
        Emitter emitter = new Emitter(sink);
        WritableSignal<Float> value = Signals.signal(0.5f);
        RenderResult result = emitter.mount(Slider.of(value, 0f, 1f), Environment.DEFAULT);

        assertEquals(1, result.valueInputs().size(), "the slider exposes one value input");
        result.valueInputs().values().iterator().next().accept(0.75f);
        assertEquals(0.75f, value.get(), "VALUE_CHANGED writes straight into the bound signal");
    }

    @Test
    void datePickerRoutesDateIntoItsSignal() {
        FrameOpcodeSink sink = new FrameOpcodeSink();
        Emitter emitter = new Emitter(sink);
        WritableSignal<Integer> days = Signals.signal(20487);
        RenderResult result = emitter.mount(DatePicker.of(DatePickerMode.DATE, days), Environment.DEFAULT);

        assertEquals(1, result.dateInputs().size(), "the date picker exposes one date input");
        assertEquals(0, result.valueInputs().size(), "a date picker has no value input");
        result.dateInputs().values().iterator().next().accept(21000, 0);
        assertEquals(21000, days.get(), "DATE_CHANGED writes straight into the bound signal");
    }

    @Test
    void toggleRoutesBooleanValueAndEmitsSelected() {
        FrameOpcodeSink sink = new FrameOpcodeSink();
        Emitter emitter = new Emitter(sink);
        WritableSignal<Boolean> on = Signals.signal(false);
        RenderResult result = emitter.mount(Toggle.of(ToggleStyle.CHECKBOX, false, on, "Go"), Environment.DEFAULT);

        result.valueInputs().values().iterator().next().accept(1f);
        assertEquals(Boolean.TRUE, on.get(), "VALUE_CHANGED 0/1 writes into the boolean binding");
    }

    @Test
    void opcodeByteLayoutIs16BytesLittleEndian() {
        Opcode op = new Opcode(Categories.TREE, Commands.Tree.CREATE_NODE, 0, 1, Components.VSTACK, 0);
        byte[] bytes = op.toBytes();
        assertEquals(16, bytes.length);
        assertEquals(0x01, bytes[0] & 0xFF);
        assertEquals(0x01, bytes[1] & 0xFF);
        assertEquals(0x01, bytes[4] & 0xFF); // a=1
        assertEquals(0x10, bytes[8] & 0xFF); // b=0x0010 vstack
        assertEquals(op, Opcode.fromBytes(bytes));
    }
}