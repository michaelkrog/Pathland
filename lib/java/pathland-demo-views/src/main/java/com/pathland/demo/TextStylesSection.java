package com.pathland.demo;

import com.pathland.view.Alignment;
import com.pathland.view.FontDesign;
import com.pathland.view.FontWeight;
import com.pathland.view.TextAlignment;
import com.pathland.view.TextCase;
import com.pathland.view.Truncation;
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
                View.vstack(
                        View.text("Regular").fontWeight(FontWeight.REGULAR),
                        View.text("Bold").fontWeight(FontWeight.BOLD),
                        View.text("Italic").italic(),
                        View.text("Underline").underline(),
                        View.text("Strikethrough").strikethrough(),
                        View.text("UPPERCASE").textCase(TextCase.UPPERCASE),
                        View.text("Monospaced").fontDesign(FontDesign.MONOSPACED),
                        View.text("Serif").fontDesign(FontDesign.SERIF),
                        View.text("K e r n e d").kerning(2),
                        View.text("Tracking").tracking(3),
                        View.text("A very long line of text that must be truncated to a single line.")
                                .lineLimit(1).truncationMode(Truncation.TAIL)
                                .frame(280, Float.NaN, Alignment.CENTER),
                        View.text("Centered").multilineTextAlignment(TextAlignment.CENTER)
                                .frame(180, Float.NaN, Alignment.CENTER)
                ).padding(4)
        );
    }
}