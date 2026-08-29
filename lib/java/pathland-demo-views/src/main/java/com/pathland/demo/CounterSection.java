package com.pathland.demo;

import com.pathland.view.Color;
import com.pathland.view.FontWeight;
import com.pathland.view.View;
import com.pathland.view.signal.Signal;
import com.pathland.view.signal.Signals;
import com.pathland.view.state.State;

/**
 * Counter section: a persisted {@code State<Integer>} mutated by buttons and a
 * {@code Stepper} that sizes the increment step. Demonstrates {@code Button},
 * {@code Stepper}, and a computed label.
 */
public final class CounterSection implements View {

    State<Integer> count = new State<>(0, "count");
    State<Float> step = new State<>(1f, "step");
    Signal<String> countLabel = Signals.computed(() -> "Count: " + count.get());

    @Override
    public View body() {
        return new SectionCard("Counter · State + Button + Stepper",
                View.vstack(
                        View.text(countLabel).fontSize(28).fontWeight(FontWeight.BOLD),
                        View.hstack(
                                View.button("−", () -> count.update(v -> v - step.get().intValue())),
                                View.button("+", () -> count.update(v -> v + step.get().intValue())),
                                View.button("Reset", () -> count.set(0))
                        ).padding(4),
                        View.text("Step size").foregroundStyle(Color.rgb(0x88, 0x88, 0x88)),
                        View.stepper(step.get(), 1, 10, 1, step.signal())
                ).padding(4)
        );
    }
}