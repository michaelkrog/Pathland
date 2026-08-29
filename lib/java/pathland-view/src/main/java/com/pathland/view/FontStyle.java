package com.pathland.view;

/** Font style (the {@code FONT_STYLE} enum: {@code Normal}=0, {@code Italic}=1). */
public enum FontStyle {

    NORMAL(0),
    ITALIC(1);

    private final int wire;

    FontStyle(int wire) {
        this.wire = wire;
    }

    public int wire() {
        return wire;
    }
}