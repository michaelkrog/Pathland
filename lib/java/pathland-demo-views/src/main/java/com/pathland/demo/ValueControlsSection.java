package com.pathland.demo;

import com.pathland.view.FontWeight;
import com.pathland.view.Gauge;
import com.pathland.view.ProgressView;
import com.pathland.view.Slider;
import com.pathland.view.Stepper;
import com.pathland.view.Text;
import com.pathland.view.VStack;
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
                VStack.of(
                        Text.of(valueLabel).fontSize(22).fontWeight(FontWeight.BOLD),
                        Slider.of(value.signal(), 0f, 100f),
                        Stepper.of(value.signal(), 0f, 100f, 5f),
                        Gauge.of(value.get(), 0f, 100f),
                        ProgressView.of(value.get() / 100f)
                ).padding(4)
        );
    }
}