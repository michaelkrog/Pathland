package com.pathland.view;

/** Font weight (protocol ENUM values). */
public enum FontWeight {

    LIGHT(0),
    REGULAR(1),
    MEDIUM(2),
    SEMIBOLD(3),
    BOLD(4);

    private final int wire;

    FontWeight(int wire) {
        this.wire = wire;
    }

    public int wire() {
        return wire;
    }
}