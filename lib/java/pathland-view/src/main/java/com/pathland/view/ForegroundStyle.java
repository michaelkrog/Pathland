package com.pathland.view;

/**
 * foreground style/color ({@code COLOR}); never a {@code .color()} modifier.
 */
public final class ForegroundStyle implements ViewModifier {

    private final Color value;
    private final com.pathland.view.signal.Signal<Color> signal;

    private ForegroundStyle(Color value, com.pathland.view.signal.Signal<Color> signal) {
        this.value = value;
        this.signal = signal;
    }

    public static ForegroundStyle of(Color value) {
        return new ForegroundStyle(value, null);
    }

    public static ForegroundStyle of(com.pathland.view.signal.Signal<Color> signal) {
        return new ForegroundStyle(null, signal);
    }

    @Override
    public View body(View content) {
        return signal != null
                ? Modified.props(content, Modified.prop(Properties.COLOR, signal))
                : Modified.props(content, Modified.prop(Properties.COLOR, value));
    }
}
