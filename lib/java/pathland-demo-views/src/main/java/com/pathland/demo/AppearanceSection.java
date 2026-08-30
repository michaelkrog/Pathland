package com.pathland.demo;

import com.pathland.view.Alignment;
import com.pathland.view.Color;
import com.pathland.view.HStack;
import com.pathland.view.Rectangle;
import com.pathland.view.ShapeKind;
import com.pathland.view.Text;
import com.pathland.view.VStack;
import com.pathland.view.View;

/**
 * Appearance section: the appearance and transform modifiers — border, shadow,
 * opacity, rotation, scale, hidden, clip shape, corner radius, and z-index.
 */
public final class AppearanceSection implements View {

    private static final Color BLUE_200 = Color.rgb(0x90, 0xCA, 0xF9);
    private static final Color RED_50 = Color.rgb(0xFD, 0xE2, 0xE4);
    private static final Color GREEN_50 = Color.rgb(0xD1, 0xE7, 0xDD);

    @Override
    public View body() {
        return new SectionCard("Appearance · border / shadow / opacity / transform",
                VStack.of(
                        Text.of("Card with shadow").padding(20).background(Color.WHITE)
                                .border(2, BLUE_200, 12).cornerRadius(12)
                                .shadow(Color.rgb(0, 0, 0), 6, 2, 4),
                        Text.of("Rotated 6°").rotation(6).padding(8)
                                .background(RED_50).cornerRadius(6),
                        Text.of("Scaled 1.2×").scaleEffect(1.2f).padding(8)
                                .background(GREEN_50).cornerRadius(6),
                        Text.of("This text is hidden").hidden(),
                        HStack.of(
                                Rectangle.of().frame(90, 60, Alignment.CENTER)
                                        .background(Color.RED).clipShape(ShapeKind.CIRCLE),
                                Rectangle.of().frame(90, 60, Alignment.CENTER)
                                        .background(Color.BLUE).cornerRadius(12)
                        ).padding(4),
                        Text.of("zIndex above").zIndex(3)
                ).padding(4)
        );
    }
}