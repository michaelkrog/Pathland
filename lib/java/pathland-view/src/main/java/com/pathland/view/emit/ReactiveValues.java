package com.pathland.view.emit;

import com.pathland.view.Color;
import com.pathland.view.signal.Signal;

/**
 * Converts a reactive signal's value into the typed property value stored on a
 * {@link PathlandNode}. Booleans become raw {@code 1}/{@code 0}; other values pass
 * through (the property's wire value type drives the final encoding).
 */
public final class ReactiveValues {

    private ReactiveValues() {}

    /** Read the signal and normalize its value for storage as a node property. */
    public static Object from(int property, Signal<?> signal) {
        Object value = signal.get();
        if (value instanceof Boolean b) {
            return b ? 1 : 0;
        }
        if (value instanceof Color) {
            return value;
        }
        if (value instanceof Float || value instanceof Integer) {
            return value;
        }
        if (value instanceof String) {
            return value;
        }
        throw new IllegalArgumentException(
                "Unsupported reactive property value " + value + " for property 0x"
                        + Integer.toHexString(property));
    }
}