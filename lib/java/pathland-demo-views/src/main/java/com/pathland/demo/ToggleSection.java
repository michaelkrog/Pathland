package com.pathland.demo;

import com.pathland.view.ToggleStyle;
import com.pathland.view.View;
import com.pathland.view.signal.Signal;
import com.pathland.view.signal.Signals;
import com.pathland.view.state.State;

/**
 * Toggle section: the same {@code Toggle} control in all three {@code ToggleStyle}
 * variants ({@code Switch}, {@code Checkbox}, {@code Button}), each bound to a
 * persisted {@code State<Boolean>}, with a computed summary line.
 */
public final class ToggleSection implements View {

    State<Boolean> dark = new State<>(false, "dark");
    State<Boolean> notify = new State<>(true, "notify");
    State<Boolean> bold = new State<>(false, "bold");
    Signal<String> summary = Signals.computed(() ->
            "Dark: " + dark.get() + " · Notify: " + notify.get() + " · Bold: " + bold.get());

    @Override
    public View body() {
        return new SectionCard("Toggle · Switch / Checkbox / Button",
                View.vstack(
                        View.toggle(ToggleStyle.SWITCH, dark.get(), dark.signal(), "Dark mode"),
                        View.toggle(ToggleStyle.CHECKBOX, notify.get(), notify.signal(), "Notify me"),
                        View.toggle(ToggleStyle.BUTTON, bold.get(), bold.signal(), "Bold toggle"),
                        View.text(summary).padding(4)
                ).padding(4)
        );
    }
}