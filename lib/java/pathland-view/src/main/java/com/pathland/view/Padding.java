package com.pathland.view;

/**
 * uniform or per-edge padding.
 */
public final class Padding implements ViewModifier {

    private final Float uniform;
    private final float[] edges;

    private Padding(Float uniform, float[] edges) {
        this.uniform = uniform;
        this.edges = edges;
    }

    /** Uniform padding. */
    public static Padding of(float value) {
        return new Padding(value, null);
    }

    /** Per-edge padding (top, right, bottom, left). */
    public static Padding of(float top, float right, float bottom, float left) {
        return new Padding(null, new float[] { top, right, bottom, left });
    }

    @Override
    public View body(View content) {
        if (edges == null) {
            return Modified.props(content, Modified.prop(Properties.PADDING, uniform));
        }
        return Modified.props(content,
                Modified.prop(Properties.PADDING_TOP, edges[0]),
                Modified.prop(Properties.PADDING_RIGHT, edges[1]),
                Modified.prop(Properties.PADDING_BOTTOM, edges[2]),
                Modified.prop(Properties.PADDING_LEFT, edges[3]));
    }
}
