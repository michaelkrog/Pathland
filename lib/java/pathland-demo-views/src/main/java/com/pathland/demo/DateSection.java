package com.pathland.demo;

import com.pathland.view.DatePickerMode;
import com.pathland.view.View;
import com.pathland.view.signal.Signal;
import com.pathland.view.signal.Signals;
import com.pathland.view.state.State;

/**
 * Date section: a {@code DatePicker} bound to a persisted {@code State<Integer>}
 * holding days since epoch (the {@code STYLE::SET_DATE} value), with a computed
 * human-readable date label.
 */
public final class DateSection implements View {

    State<Integer> days = new State<>(20487, "days");
    Signal<String> dateLabel = Signals.computed(() ->
            java.time.LocalDate.ofEpochDay(days.get()).toString());

    @Override
    public View body() {
        return new SectionCard("DatePicker · STYLE::SET_DATE",
                View.vstack(
                        View.datePicker(DatePickerMode.DATE, days.signal()),
                        View.text(dateLabel).padding(4)
                ).padding(4)
        );
    }
}