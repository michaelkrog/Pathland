package com.pathland.demo;

import com.pathland.view.FontWeight;
import com.pathland.view.View;
import com.pathland.view.signal.Signal;
import com.pathland.view.signal.Signals;
import com.pathland.view.state.State;

/**
 * Value-controls section: one persisted {@code State<Float>} driving a {@code Slider},
 * a {@code Stepper}, a read-only {@code Gauge}, and a {@code ProgressView} — all
 * reporting their changes back into the same binding.
 */
public final class ValueControlsSection implements View {

    State<Float> value = new State<>(50f, "value");
    Signal<String> valueLabel = Signals.computed(() -> "Value: " + value.get());

    @Override
    public View body() {
        return new SectionCard("Value controls · Slider / Stepper / Gauge / Progress",
                View.vstack(
                        View.text(valueLabel).fontSize(22).fontWeight(FontWeight.BOLD),
                        View.slider(value.get(), 0f, 100f, value.signal()),
                        View.stepper(value.get(), 0f, 100f, 5f, value.signal()),
                        View.gauge(value.get(), 0f, 100f),
                        View.progressView(value.get() / 100f)
                ).padding(4)
        );
    }
}