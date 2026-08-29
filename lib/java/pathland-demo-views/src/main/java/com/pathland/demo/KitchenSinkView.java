package com.pathland.demo;

import com.pathland.view.Color;
import com.pathland.view.FontWeight;
import com.pathland.view.View;

/**
 * The kitchen-sink application root: every demo section stacked in a scrollable
 * column. Children are instantiated inline — each section connects its own
 * {@code State} during render.
 */
public final class KitchenSinkView implements View {

    @Override
    public View body() {
        return View.scrollView(View.vstack(
                View.text("Pathland Kitchensink").fontSize(24).fontWeight(FontWeight.BOLD).padding(8),
                View.text("Every protocol primitive, control, modifier, and state binding")
                        .foregroundStyle(Color.rgb(0x88, 0x88, 0x88)),
                new CounterSection(),
                new TextFieldSection(),
                new ToggleSection(),
                new ValueControlsSection(),
                new PickerSection(),
                new ColorSection(),
                new DateSection(),
                new LayoutSection(),
                new TextStylesSection(),
                new AppearanceSection(),
                View.text("Pathland · per-session · 16-byte deltas")
                        .foregroundStyle(Color.rgb(0x88, 0x88, 0x88))
                        .padding(16)
        ).padding(24));
    }
}