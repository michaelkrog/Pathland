package com.pathland.demo;

import com.pathland.view.Alignment;
import com.pathland.view.Color;
import com.pathland.view.View;

/**
 * Layout section: the container primitives — {@code Grid}, {@code LazyVStack},
 * {@code HStack} + {@code Spacer}, {@code ZStack}, and {@code Divider}.
 */
public final class LayoutSection implements View {

    @Override
    public View body() {
        return new SectionCard("Layout · Grid / Lazy / HStack+Spacer / ZStack / Divider",
                View.vstack(
                        View.grid(
                                cell("1"), cell("2"), cell("3"),
                                cell("4"), cell("5"), cell("6")),
                        View.lazyVStack(
                                View.text("Lazy row A"),
                                View.text("Lazy row B"),
                                View.text("Lazy row C")).padding(4),
                        View.hstack(
                                View.text("Left"),
                                View.spacer(),
                                View.text("Right"))
                                .frame(260, Float.NaN, Alignment.CENTER),
                        View.zstack(
                                View.rectangle().frame(180, 80, Alignment.CENTER)
                                        .background(Color.rgb(0xE3, 0xF2, 0xFD)).cornerRadius(8),
                                View.text("badge").fontSize(12).padding(4)
                                        .background(Color.rgb(0xFF, 0xC1, 0x07)).cornerRadius(4)
                                        .offset(0, 28)
                        ).padding(4),
                        View.divider()
                ).padding(4)
        );
    }

    private static View cell(String label) {
        return View.text(label).padding(12)
                .background(Color.rgb(0xF3, 0xF4, 0xF6)).cornerRadius(6);
    }
}