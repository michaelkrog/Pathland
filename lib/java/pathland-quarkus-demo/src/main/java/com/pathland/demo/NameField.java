package com.pathland.demo;

import com.pathland.view.View;
import com.pathland.view.signal.Signal;
import com.pathland.view.signal.Signals;
import com.pathland.view.signal.WritableSignal;

/**
 * A view component: the name text field plus its reactive label.
 *
 * <p>The component owns its {@code name} state signal, binds the {@link com.pathland.view.TextField}
 * to it, and derives the {@code "Name: …"} label from it — a self-contained, stateful
 * component. The DSL's {@link View} hierarchy is sealed, so application-level components
 * compose the library's primitives rather than implementing {@code View} directly.
 */
public final class NameField {

    private final WritableSignal<String> name;
    private final View view;

    public NameField() {
        this.name = Signals.signal("name", "");
        Signal<String> nameLabel = Signals.computed("nameLabel", () -> "Name: " + name.get());
        this.view = View.vstack(
                View.textField("Your name", name),
                View.text(nameLabel)
        );
    }

    /** The component's name state. */
    public WritableSignal<String> name() {
        return name;
    }

    /** The composed view (the text field and its reactive label). */
    public View view() {
        return view;
    }
}