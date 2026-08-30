package com.pathland.view;

/**
 * declares raw input listeners ({@code EVENT_LISTENERS} bitmask, OR-in).
 */
public final class PointerEvents implements ViewModifier {

    private final int mask;

    private PointerEvents(int mask) {
        this.mask = mask;
    }

    public static PointerEvents of(int mask) {
        return new PointerEvents(mask);
    }

    @Override
    public View body(View content) {
        return new PointerEventsView(content, mask);
    }
}
