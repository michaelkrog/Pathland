package com.pathland.view;

import com.pathland.view.emit.PathlandNode;

/**
 * An sRGB color packed as {@code 0xAARRGGBB} (the protocol's literal color encoding,
 * D65 white point). Renderers resolve the exact visual appearance.
 *
 * <p>{@code Color} doubles as a leaf view: placing it in a stack draws a solid-color
 * fill (an {@code IMAGE} node with {@code BACKGROUND_COLOR}).
 */
public record Color(int argb) implements View {

    public static final Color CLEAR = new Color(0x00000000);
    public static final Color BLACK = new Color(0xFF000000);
    public static final Color WHITE = new Color(0xFFFFFFFF);
    public static final Color RED = new Color(0xFFFF0000);
    public static final Color BLUE = new Color(0xFF2196F3);

    /** A fully opaque sRGB color. */
    public static Color rgb(int r, int g, int b) {
        return new Color(0xFF000000 | (r << 16) | (g << 8) | b);
    }

    /** An sRGB color with explicit alpha ({@code 0..255}). */
    public static Color argb(int a, int r, int g, int b) {
        return new Color((a << 24) | (r << 16) | (g << 8) | b);
    }

    @Override
    public PathlandNode render(Environment env) {
        PathlandNode node = new PathlandNode(Components.IMAGE);
        node.properties.put(Properties.BACKGROUND_COLOR, this);
        return node;
    }
}