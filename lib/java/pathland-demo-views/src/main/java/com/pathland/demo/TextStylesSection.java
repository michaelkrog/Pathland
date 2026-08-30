package com.pathland.demo;

import com.pathland.view.Alignment;
import com.pathland.view.FontDesign;
import com.pathland.view.FontWeight;
import com.pathland.view.Text;
import com.pathland.view.TextAlignment;
import com.pathland.view.TextCase;
import com.pathland.view.Truncation;
import com.pathland.view.VStack;
import com.pathland.view.View;

/**
 * Text-styles section: one row per text-formatting modifier — weight, italic,
 * underline, strikethrough, case, design, kerning, tracking, and line-limit +
 * truncation.
 */
public final class TextStylesSection implements View {

    @Override
    public View body() {
        return new SectionCard("Text styles · text modifiers",
                VStack.of(
                        Text.of("Regular").fontWeight(FontWeight.REGULAR),
                        Text.of("Bold").fontWeight(FontWeight.BOLD),
                        Text.of("Italic").italic(),
                        Text.of("Underline").underline(),
                        Text.of("Strikethrough").strikethrough(),
                        Text.of("UPPERCASE").textCase(TextCase.UPPERCASE),
                        Text.of("Monospaced").fontDesign(FontDesign.MONOSPACED),
                        Text.of("Serif").fontDesign(FontDesign.SERIF),
                        Text.of("K e r n e d").kerning(2),
                        Text.of("Tracking").tracking(3),
                        Text.of("A very long line of text that must be truncated to a single line.")
                                .lineLimit(1).truncationMode(Truncation.TAIL)
                                .frame(280, Float.NaN, Alignment.CENTER),
                        Text.of("Centered").multilineTextAlignment(TextAlignment.CENTER)
                                .frame(180, Float.NaN, Alignment.CENTER)
                ).padding(4)
        );
    }
}