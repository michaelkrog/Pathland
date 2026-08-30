package com.pathland.view;

/**
 * text font size in points.
 */
public final class FontSize implements ViewModifier {

    private final Float size;
    private final com.pathland.view.signal.Signal<Float> signal;

    private FontSize(Float size, com.pathland.view.signal.Signal<Float> signal) {
        this.size = size;
        this.signal = signal;
    }

    public static FontSize of(float size) {
        return new FontSize(size, null);
    }

    public static FontSize of(com.pathland.view.signal.Signal<Float> signal) {
        return new FontSize(null, signal);
    }

    @Override
    public View body(View content) {
        return signal != null
                ? Modified.props(content, Modified.prop(Properties.FONT_SIZE, signal))
                : Modified.props(content, Modified.prop(Properties.FONT_SIZE, size));
    }
}
