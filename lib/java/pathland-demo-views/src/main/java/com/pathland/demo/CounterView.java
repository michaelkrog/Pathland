package com.pathland.demo;

import com.pathland.view.Color;
import com.pathland.view.View;

/**
 * The application's root view: the {@link CounterControls} and {@link NameField}
 * components plus a footer. Nested views are declared as (package-private) fields so the
 * generated binder can recurse into them and wire their {@code State} state.
 */
public final class CounterView implements View {

    final CounterControls controls = new CounterControls();
    final NameField nameField = new NameField();

    @Override
    public View body() {
        return View.vstack(
                controls,
                nameField,
                View.text("Pathland · per-session · 16-byte deltas")
                        .color(Color.rgb(0x88, 0x88, 0x88))
        ).padding(24);
    }
}
