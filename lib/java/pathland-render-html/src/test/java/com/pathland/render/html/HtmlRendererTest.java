package com.pathland.render.html;

import com.pathland.view.Button;
import com.pathland.view.Color;
import com.pathland.view.DatePicker;
import com.pathland.view.DatePickerMode;
import com.pathland.view.Divider;
import com.pathland.view.Environment;
import com.pathland.view.Picker;
import com.pathland.view.PickerStyle;
import com.pathland.view.ProgressView;
import com.pathland.view.Slider;
import com.pathland.view.Text;
import com.pathland.view.TextEditor;
import com.pathland.view.Toggle;
import com.pathland.view.ToggleStyle;
import com.pathland.view.VStack;
import com.pathland.view.View;
import com.pathland.view.emit.Emitter;
import com.pathland.view.emit.FrameOpcodeSink;
import com.pathland.view.signal.Signal;
import com.pathland.view.signal.Signals;
import com.pathland.view.signal.WritableSignal;
import com.pathland.view.ButtonStyleMod;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** DSL -> emitter -> frame -> HtmlRenderer (the SSR round-trip). */
class HtmlRendererTest {

    private static HtmlRenderer render(View root) {
        FrameOpcodeSink sink = new FrameOpcodeSink();
        Emitter emitter = new Emitter(sink);
        emitter.mount(root, Environment.DEFAULT);
        HtmlRenderer renderer = new HtmlRenderer();
        renderer.applyFrame(sink.frame());
        return renderer;
    }

    @Test
    void rendersVStackOfTextAndButton() {
        View root = VStack.of(
                Text.of("Hello Pathland"),
                Button.of("Increment", () -> { }));
        HtmlRenderer renderer = render(root);
        String html = renderer.render(1);

        assertTrue(html.contains("<!DOCTYPE html>"));
        assertTrue(html.contains("flex-direction:column"));
        assertTrue(html.contains("<span data-pathland-id=\"2\">Hello Pathland</span>"));
        assertTrue(html.contains("<button data-pathland-id=\"3\">Increment</button>"));
    }

    @Test
    void appliesLiveDeltaInPlace() {
        WritableSignal<Integer> count = Signals.signal(0);
        Signal<String> label = Signals.computed(() -> "Count: " + count.get());
        View root = VStack.of(Text.of("Static"), Text.of(label));

        FrameOpcodeSink sink = new FrameOpcodeSink();
        Emitter emitter = new Emitter(sink);
        emitter.mount(root, Environment.DEFAULT);

        HtmlRenderer renderer = new HtmlRenderer();
        renderer.applyFrame(sink.frame());
        assertTrue(renderer.renderFragment(1).contains("Count: 0"));

        count.set(9);
        renderer.applyFrame(sink.frame()); // the delta (one SET_TEXT)
        String html = renderer.renderFragment(1);
        assertTrue(html.contains("Count: 9"));
        assertFalse(html.contains("Count: 0"));
    }

    @Test
    void rendersBorderedStyledButton() {
        View root = VStack.of(Button.of("Go", () -> { }))
                .modifier(ButtonStyleMod.of(com.pathland.view.BorderedButtonStyle.INSTANCE));
        String html = render(root).render(1);
        assertTrue(html.contains("border-radius:6px"));
        assertTrue(html.contains("data-pathland-id=\"2\""), "styled button keeps its node id");
    }

    @Test
    void rendersControls() {
        WritableSignal<Float> value = Signals.signal(0.5f);
        WritableSignal<Boolean> on = Signals.signal(true);
        WritableSignal<Integer> choice = Signals.signal(0);
        View root = VStack.of(
                Toggle.of(ToggleStyle.CHECKBOX, true, on, "Go"),
                Slider.of(value, 0f, 1f),
                Picker.of(PickerStyle.MENU, choice, Text.of("A"), Text.of("B")),
                ProgressView.of(0.4f),
                Divider.of(),
                TextEditor.of(Signals.signal("hello")),
                DatePicker.of(DatePickerMode.DATE, Signals.signal(20487)));
        String html = render(root).render(1);

        assertTrue(html.contains("type=\"checkbox\""), "toggle checkbox");
        assertTrue(html.contains("type=\"range\""), "slider");
        assertTrue(html.contains("<option selected>A</option>"), "picker options");
        assertTrue(html.contains("<option>B</option>"), "picker options");
        assertTrue(html.contains("<progress"), "progress bar");
        assertTrue(html.contains("<hr"), "divider");
        assertTrue(html.contains("<textarea"), "text editor");
        assertTrue(html.contains("type=\"date\""), "date picker");
    }

    @Test
    void escapesText() {
        String html = render(VStack.of(Text.of("<a & b>"))).renderFragment(1);
        assertTrue(html.contains("&lt;a &amp; b&gt;"));
    }
}