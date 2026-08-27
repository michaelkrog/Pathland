package com.pathland.demo;

import com.pathland.view.View;
import com.pathland.view.signal.Signal;
import com.pathland.view.signal.Signals;
import com.pathland.view.state.State;

/**
 * A view component: the count label plus its increment button. The {@code count} state is
 * a {@link State} field — the annotation processor wires it to the session's store
 * automatically (keyed {@code "count"}).
 */
public final class CounterControls implements View {

    State<Integer> count = new State<>(0);
    Signal<String> countLabel = Signals.computed(() -> "Count: " + count.get());

    @Override
    public View body() {
        return View.hstack(
                View.text(countLabel),
                View.button("Increment", () -> count.update(v -> v + 1))
        ).padding(16);
    }
}