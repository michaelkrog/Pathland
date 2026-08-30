package com.pathland.demo;

import com.pathland.view.Alignment;
import com.pathland.view.Button;
import com.pathland.view.Color;
import com.pathland.view.FontWeight;
import com.pathland.view.HStack;
import com.pathland.view.Stepper;
import com.pathland.view.Text;
import com.pathland.view.VStack;
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
                VStack.of(
                        Text.of(countLabel).fontSize(28).fontWeight(FontWeight.BOLD),
                        HStack.of(Alignment.LEADING, 4,
                                Button.of("−", () -> count.update(v -> v - step.get().intValue())),
                                Button.of("+", () -> count.update(v -> v + step.get().intValue())),
                                Button.of("Reset", () -> count.set(0))
                        ).padding(4),
                        Text.of("Step size").foregroundStyle(Color.rgb(0x88, 0x88, 0x88)),
                        Stepper.of(step.signal(), 1, 10, 1)
                ).padding(4)
        );
    }
}