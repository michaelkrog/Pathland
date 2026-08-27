package com.pathland.demo;

import com.pathland.view.Color;
import com.pathland.view.Environment;
import com.pathland.view.View;
import com.pathland.view.emit.PathlandNode;

/**
 * The application's root view: the {@link CounterControls} and {@link NameField}
 * components plus a footer. Nested views are declared as (package-private) fields so the
 * generated binder can recurse into them and wire their {@code @Persisted} state.
 */
public final class CounterView implements View {

    final CounterControls controls = new CounterControls();
    final NameField nameField = new NameField();

    /** The name field component (the host routes {@code TEXT_CHANGED} events here). */
    public NameField nameField() {
        return nameField;
    }

    @Override
    public PathlandNode render(Environment env) {
        return View.vstack(
                controls,
                nameField,
                View.text("Pathland · per-session · 16-byte deltas")
                        .color(Color.rgb(0x88, 0x88, 0x88))
        ).padding(24).render(env);
    }
}