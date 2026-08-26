package com.pathland.demo;

import com.pathland.view.Color;
import com.pathland.view.View;

/**
 * The application's root view: the {@link CounterControls} component, the {@link NameField}
 * component, and a footer — composed from DSL primitives and components. Each component
 * owns its own state ({@code count} in {@link CounterControls}, {@code name} in
 * {@link NameField}), exposed via {@link #controls()} and {@link #nameField()}.
 */
public final class CounterView {

    private final CounterControls controls;
    private final NameField nameField;
    private final View view;

    public CounterView() {
        this.controls = new CounterControls();
        this.nameField = new NameField();

        this.view = View.vstack(
                controls.view(),
                nameField.view(),
                View.text("Pathland · Quarkus · per-session · 16-byte deltas")
                        .color(Color.rgb(0x88, 0x88, 0x88))
        ).padding(24);
    }

    /** The counter controls component (owns the {@code count} signal). */
    public CounterControls controls() {
        return controls;
    }

    /** The name field component (owns the {@code name} signal). */
    public NameField nameField() {
        return nameField;
    }

    /** The composed root view. */
    public View view() {
        return view;
    }
}