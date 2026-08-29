package com.pathland.demo;

import com.pathland.view.Alignment;
import com.pathland.view.Color;
import com.pathland.view.View;
import com.pathland.view.signal.Signal;
import com.pathland.view.signal.Signals;
import com.pathland.view.state.State;

/**
 * Color section: a {@code ColorPicker} bound to a persisted {@code State<Color>}, a
 * {@code Color} used directly as a View (dual identity), and a reactive
 * {@code Rectangle} (a {@code SHAPE} node) that follows the picked color.
 */
public final class ColorSection implements View {

    State<Color> accent = new State<>(Color.BLUE, "accent");
    Signal<String> accentLabel = Signals.computed(() -> {
        int rgb = accent.get().argb() & 0xFFFFFF;
        return String.format("Accent #%06x", rgb);
    });

    @Override
    public View body() {
        return new SectionCard("Color · ColorPicker + Color view + Rectangle",
                View.vstack(
                        View.colorPicker(accent.signal()),
                        View.hstack(
                                accent.get().frame(120, 60, Alignment.CENTER),
                                View.rectangle().frame(120, 60, Alignment.CENTER)
                                        .background(accent.signal())
                        ).padding(4),
                        View.text(accentLabel).padding(4)
                ).padding(4)
        );
    }
}