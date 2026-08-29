package com.pathland.demo;

import com.pathland.view.Color;
import com.pathland.view.PickerStyle;
import com.pathland.view.View;
import com.pathland.view.signal.Signal;
import com.pathland.view.signal.Signals;
import com.pathland.view.state.State;

/**
 * Selection section: a {@code Picker} in two styles ({@code Segmented} and
 * {@code Menu}) bound to a persisted {@code State<Integer>} (the chosen option index),
 * plus a {@code Menu} whose action items are {@code Button}s.
 */
public final class PickerSection implements View {

    State<Integer> choice = new State<>(1, "choice");
    Signal<String> choiceLabel = Signals.computed(() -> "Choice: " + choice.get());

    @Override
    public View body() {
        return new SectionCard("Picker + Menu",
                View.vstack(
                        View.text(choiceLabel).padding(4),
                        View.picker(PickerStyle.SEGMENTED, choice.signal(),
                                View.text("One"), View.text("Two"), View.text("Three")),
                        View.picker(PickerStyle.MENU, choice.signal(),
                                View.text("One"), View.text("Two"), View.text("Three")),
                        View.menu(View.button("Actions ▾", () -> { }),
                                View.button("Item 1", () -> { }),
                                View.button("Item 2", () -> { })),
                        View.text("Menu action items are Buttons; choices route via VALUE_CHANGED")
                                .foregroundStyle(Color.rgb(0x88, 0x88, 0x88))
                ).padding(4)
        );
    }
}