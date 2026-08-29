package com.pathland.demo;

import com.pathland.view.Color;
import com.pathland.view.View;

/**
 * The application's root view: the {@link CounterControls} and {@link NameField}
 * components plus a footer. Children are instantiated inline — each view connects its own
 * {@code State} during render, so they need not be declared as fields.
 */
public final class CounterView implements View {

    @Override
    public View body() {
        return View.vstack(
                new CounterControls(),
                new NameField(),
                View.text("Pathland · per-session · 16-byte deltas")
                        .foregroundStyle(Color.rgb(0x88, 0x88, 0x88))
        ).padding(24);
    }
}
