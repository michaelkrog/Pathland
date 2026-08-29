package com.pathland.demo;

import com.pathland.view.Alignment;
import com.pathland.view.Color;
import com.pathland.view.Commands;
import com.pathland.view.FontWeight;
import com.pathland.view.View;

/**
 * A reusable kitchen-sink section card: a titled, bordered, rounded container that
 * hosts one section's controls. Demonstrates composition — a custom {@code View}
 * wrapping arbitrary content with style modifiers.
 */
public final class SectionCard implements View {

    private static final Color TITLE_COLOR = Color.rgb(0x55, 0x64, 0x6D);
    private static final Color BORDER = Color.rgb(0xE2, 0xE8, 0xF0);

    private final String title;
    private final View content;

    public SectionCard(String title, View content) {
        this.title = title;
        this.content = content;
    }

    @Override
    public View body() {
        return View.vstack(
                View.text(title).fontSize(14).fontWeight(FontWeight.SEMIBOLD).foregroundStyle(TITLE_COLOR),
                View.divider().padding(0, 0, 8, 0),
                content
        ).padding(16)
                .background(Color.WHITE)
                .border(1, BORDER, 10)
                .cornerRadius(10)
                .frame(Commands.Size.FILL, Float.NaN, Alignment.FILL);
    }
}