package com.pathland.view;

import com.pathland.view.emit.PathlandNode;

/** A read-only value shown against a scale (SwiftUI {@code Gauge}). */
public final class Gauge implements View {

    private final float value;
    private final float min;
    private final float max;

    public Gauge(float value, float min, float max) {
        this.value = value;
        this.min = min;
        this.max = max;
    }

    @Override
    public PathlandNode render(Environment env) {
        PathlandNode node = new PathlandNode(Components.GAUGE);
        node.properties.put(Properties.VALUE, value);
        node.properties.put(Properties.MIN_VALUE, min);
        node.properties.put(Properties.MAX_VALUE, max);
        return node;
    }
}