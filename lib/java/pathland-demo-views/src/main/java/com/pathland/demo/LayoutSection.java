package com.pathland.demo;

import com.pathland.view.Alignment;
import com.pathland.view.Color;
import com.pathland.view.Divider;
import com.pathland.view.Grid;
import com.pathland.view.HStack;
import com.pathland.view.LazyVStack;
import com.pathland.view.Rectangle;
import com.pathland.view.Spacer;
import com.pathland.view.Text;
import com.pathland.view.VStack;
import com.pathland.view.View;
import com.pathland.view.ZStack;

/**
 * Layout section: the container primitives — {@code Grid}, {@code LazyVStack},
 * {@code HStack} + {@code Spacer}, {@code ZStack}, and {@code Divider}.
 */
public final class LayoutSection implements View {

    @Override
    public View body() {
        return new SectionCard("Layout · Grid / Lazy / HStack+Spacer / ZStack / Divider",
                VStack.of(
                        Grid.of(
                                cell("1"), cell("2"), cell("3"),
                                cell("4"), cell("5"), cell("6")),
                        LazyVStack.of(
                                Text.of("Lazy row A"),
                                Text.of("Lazy row B"),
                                Text.of("Lazy row C")).padding(4),
                        HStack.of(
                                Text.of("Left"),
                                Spacer.of(),
                                Text.of("Right"))
                                .frame(260, Float.NaN, Alignment.CENTER),
                        ZStack.of(
                                Rectangle.of().frame(180, 80, Alignment.CENTER)
                                        .background(Color.rgb(0xE3, 0xF2, 0xFD)).cornerRadius(8),
                                Text.of("badge").fontSize(12).padding(4)
                                        .background(Color.rgb(0xFF, 0xC1, 0x07)).cornerRadius(4)
                                        .offset(0, 28)
                        ).padding(4),
                        Divider.of()
                ).padding(4)
        );
    }

    private static View cell(String label) {
        return Text.of(label).padding(12)
                .background(Color.rgb(0xF3, 0xF4, 0xF6)).cornerRadius(6);
    }
}