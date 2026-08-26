package com.pathland.demo;

import com.pathland.view.View;
import com.pathland.view.signal.Signal;
import com.pathland.view.signal.Signals;
import com.pathland.view.signal.WritableSignal;

/**
 * A view component: the count label plus its increment button.
 *
 * <p>The component owns its {@code count} state signal, derives the {@code "Count: N"}
 * label from it, and wires the button to increment it — a self-contained, stateful
 * component. The DSL's {@link View} hierarchy is sealed, so application-level components
 * like this one compose the library's primitives rather than implementing {@code View}
 * directly; the composed {@link #view()} renders and reacts like any other view.
 */
public final class CounterControls {

    private final WritableSignal<Integer> count;
    private final View view;

    public CounterControls() {
        this.count = Signals.signal("count", 0);
        Signal<String> countLabel = Signals.computed("countLabel", () -> "Count: " + count.get());
        this.view = View.hstack(
                View.text(countLabel),
                View.button("Increment", () -> count.update(v -> v + 1))
        ).padding(16);
    }

    /** The component's count state. */
    public WritableSignal<Integer> count() {
        return count;
    }

    /** The composed view (the label and a button wired to increment {@code count}). */
    public View view() {
        return view;
    }
}