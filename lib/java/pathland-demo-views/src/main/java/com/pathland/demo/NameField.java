package com.pathland.demo;

import com.pathland.view.Environment;
import com.pathland.view.View;
import com.pathland.view.emit.PathlandNode;
import com.pathland.view.signal.Signal;
import com.pathland.view.signal.Signals;
import com.pathland.view.state.State;

/**
 * A view component: the name text field plus its reactive label. The {@code name} state is
 * a {@link State} field — the annotation processor wires it to the session's store
 * automatically (keyed {@code "name"}).
 */
public final class NameField implements View {

    State<String> name = new State<>("");

    /** The underlying name state (the host routes {@code TEXT_CHANGED} events here). */
    public State<String> name() {
        return name;
    }

    @Override
    public PathlandNode render(Environment env) {
        Signal<String> nameLabel = Signals.computed("nameLabel", () -> "Name: " + name.get());
        return View.vstack(
                View.textField("Your name", name.signal()),
                View.text(nameLabel)
        ).render(env);
    }
}