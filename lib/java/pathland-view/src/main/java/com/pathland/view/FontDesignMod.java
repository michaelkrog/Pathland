package com.pathland.view;

/**
 * font design ({@code FONT_DESIGN}).
 */
public final class FontDesignMod implements ViewModifier {

    private final float design;

    private FontDesignMod(float design) {
        this.design = design;
    }

    public static FontDesignMod of(FontDesign design) {
        return new FontDesignMod((float) design.wire());
    }

    @Override
    public View body(View content) {
        return Modified.props(content, Modified.prop(Properties.FONT_DESIGN, design));
    }
}
