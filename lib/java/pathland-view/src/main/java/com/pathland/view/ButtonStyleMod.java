package com.pathland.view;

/**
 * A {@link ViewModifier} that scopes a {@link ButtonStyle} down the wrapped subtree
 * (SwiftUI {@code .buttonStyle}). Applied via {@code view.modifier(ButtonStyleMod.of(style))}.
 */
public final class ButtonStyleMod implements ViewModifier {

    private final ButtonStyle style;

    private ButtonStyleMod(ButtonStyle style) {
        this.style = style;
    }

    /** Scope {@code style} down the wrapped subtree. */
    public static ButtonStyleMod of(ButtonStyle style) {
        return new ButtonStyleMod(style);
    }

    @Override
    public View body(View content) {
        return new ButtonStyleView(content, style);
    }
}