package com.pathland.demo;

import com.pathland.view.Color;
import com.pathland.view.Text;
import com.pathland.view.VStack;
import com.pathland.view.View;

/**
 * The application's root view: the {@link CounterControls} and {@link NameField}
 * components plus a footer. Children are instantiated inline — each view connects its own
 * {@code State} during render, so they need not be declared as fields.
 */
public final class CounterView implements View {

    @Override
    public View body() {
        return VStack.of(
                new CounterControls(),
                new NameField(),
                Text.of("Pathland · per-session · 16-byte deltas")
                        .foregroundStyle(Color.rgb(0x88, 0x88, 0x88))
        ).padding(24);
    }
}
