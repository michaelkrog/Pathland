package com.pathland.view;

/**
 * shows/hides the view ({@code VISIBLE}).
 */
public final class Visible implements ViewModifier {

    private final boolean visible;

    private Visible(boolean visible) {
        this.visible = visible;
    }

    /** Show ({@code visible} = shown). */
    public static Visible of(boolean visible) {
        return new Visible(visible);
    }

    @Override
    public View body(View content) {
        return Modified.props(content, Modified.prop(Properties.VISIBLE, visible ? 1 : 0));
    }
}
