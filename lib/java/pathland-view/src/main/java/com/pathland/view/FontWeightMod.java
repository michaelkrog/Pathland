package com.pathland.view;

/**
 * font weight (100–900 scale, {@code FONT_WEIGHT}).
 */
public final class FontWeightMod implements ViewModifier {

    private final float weight;

    private FontWeightMod(float weight) {
        this.weight = weight;
    }

    public static FontWeightMod of(FontWeight weight) {
        return new FontWeightMod((float) weight.wire());
    }

    @Override
    public View body(View content) {
        return Modified.props(content, Modified.prop(Properties.FONT_WEIGHT, weight));
    }
}
