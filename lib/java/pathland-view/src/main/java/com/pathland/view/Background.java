package com.pathland.view;

/**
 * background color ({@code BACKGROUND_COLOR}).
 */
public final class Background implements ViewModifier {

    private final Color value;
    private final com.pathland.view.signal.Signal<Color> signal;

    private Background(Color value, com.pathland.view.signal.Signal<Color> signal) {
        this.value = value;
        this.signal = signal;
    }

    public static Background of(Color value) {
        return new Background(value, null);
    }

    public static Background of(com.pathland.view.signal.Signal<Color> signal) {
        return new Background(null, signal);
    }

    @Override
    public View body(View content) {
        return signal != null
                ? Modified.props(content, Modified.prop(Properties.BACKGROUND_COLOR, signal))
                : Modified.props(content, Modified.prop(Properties.BACKGROUND_COLOR, value));
    }
}
