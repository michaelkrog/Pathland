package com.pathland.view;

/**
 * A bordered, tinted button style: the label padded onto a colored background with a
 * rounded border, wired to the action on tap.
 */
public final class BorderedButtonStyle implements ButtonStyle {

    public static final BorderedButtonStyle INSTANCE = new BorderedButtonStyle();

    private final float padding;
    private final Color background;
    private final Color borderColor;
    private final float radius;

    public BorderedButtonStyle() {
        this(10f, Color.rgb(33, 150, 243), Color.rgb(25, 118, 210), 6f);
    }

    public BorderedButtonStyle(float padding, Color background, Color borderColor, float radius) {
        this.padding = padding;
        this.background = background;
        this.borderColor = borderColor;
        this.radius = radius;
    }

    @Override
    public View makeBody(Configuration config) {
        return config.label()
                .foregroundStyle(Color.WHITE)
                .padding(padding)
                .background(background)
                .border(1f, borderColor, radius)
                .onTapGesture(config.action());
    }
}