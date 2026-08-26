package com.pathland.view;

/** Truncation mode for multi-line text (protocol ENUM values). */
public enum Truncation {

    HEAD(0),
    MIDDLE(1),
    TAIL(2),
    NONE(3);

    private final int wire;

    Truncation(int wire) {
        this.wire = wire;
    }

    public int wire() {
        return wire;
    }
}