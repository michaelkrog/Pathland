package com.pathland.view;

/** Control size (the {@code CONTROL_SIZE} enum: {@code Small}=0, {@code Regular}=1, {@code Large}=2). */
public enum ControlSize {

    SMALL(0),
    REGULAR(1),
    LARGE(2);

    private final int wire;

    ControlSize(int wire) {
        this.wire = wire;
    }

    public int wire() {
        return wire;
    }
}