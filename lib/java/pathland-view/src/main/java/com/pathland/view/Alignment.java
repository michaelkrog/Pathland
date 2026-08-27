package com.pathland.view;

/** Cross-axis alignment for stacks and the {@code frame} modifier (protocol ENUM values). */
public enum Alignment {

    LEADING(0),
    CENTER(1),
    TRAILING(2),
    FILL(3);

    private final int wire;

    Alignment(int wire) {
        this.wire = wire;
    }

    public int wire() {
        return wire;
    }
}