package com.pathland.render.html;

import com.pathland.view.Color;
import com.pathland.view.Environment;
import com.pathland.view.View;
import com.pathland.view.emit.Emitter;
import com.pathland.view.emit.FrameOpcodeSink;
import com.pathland.view.signal.Signal;
import com.pathland.view.signal.Signals;
import com.pathland.view.signal.WritableSignal;
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
        View root = View.vstack(
                View.text("Hello Pathland"),
                View.button("Increment", () -> { }));
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
        View root = View.vstack(View.text("Static"), View.text(label));

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
        View root = View.vstack(View.button("Go", () -> { }))
                .buttonStyle(com.pathland.view.BorderedButtonStyle.INSTANCE);
        String html = render(root).render(1);
        assertTrue(html.contains("border-radius:6px"));
        assertTrue(html.contains("data-pathland-id=\"2\""), "styled button keeps its node id");
    }

    @Test
    void escapesText() {
        String html = render(View.vstack(View.text("<a & b>"))).renderFragment(1);
        assertTrue(html.contains("&lt;a &amp; b&gt;"));
    }
}