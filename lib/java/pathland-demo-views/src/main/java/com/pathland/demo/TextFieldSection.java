package com.pathland.demo;

import com.pathland.view.Alignment;
import com.pathland.view.View;
import com.pathland.view.signal.Signal;
import com.pathland.view.signal.Signals;
import com.pathland.view.state.State;

/**
 * Text-input section: a single-line {@code TextField} and a multi-line
 * {@code TextEditor}, both bound to one persisted {@code State<String>}, plus a
 * computed greeting.
 */
public final class TextFieldSection implements View {

    State<String> name = new State<>("", "name");
    Signal<String> greeting = Signals.computed(() ->
            "Hello, " + (name.get().isEmpty() ? "stranger" : name.get()) + "!");

    @Override
    public View body() {
        return new SectionCard("Text · TextField + TextEditor",
                View.vstack(
                        View.textField("Your name", name.signal()),
                        View.textEditor(name.signal()).frame(240, 64, Alignment.CENTER),
                        View.text(greeting).padding(4)
                ).padding(4)
        );
    }
}