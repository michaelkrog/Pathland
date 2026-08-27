package com.pathland.view;

/** Text alignment (protocol ENUM values). */
public enum TextAlignment {

    LEADING(0),
    CENTER(1),
    TRAILING(2);

    private final int wire;

    TextAlignment(int wire) {
        this.wire = wire;
    }

    public int wire() {
        return wire;
    }
}