package com.pathland.view.emit;

import com.pathland.view.signal.Signal;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

/**
 * A node in the retained view tree — the app's canonical tree, produced by
 * {@code View.render(Environment)}. The {@link Emitter} assigns stable ids,
 * walks this tree to emit the structural opcodes, and registers fine-grained
 * binding effects for reactive text/properties.
 *
 * <p>Property values are stored typed:
 * {@link Float} (f32), {@link Integer} (raw u32/u8 bits), {@link com.pathland.view.Color},
 * or {@link String} (STRING-typed properties). The emitter derives the wire value
 * type from the property id.
 */
public final class PathlandNode {

    /** Stable node id, assigned by {@link Emitter} (pre-order from 1). */
    public int id;

    /** Protocol component type id (see {@code com.pathland.view.Components}). */
    public int component;

    /** Static text content (text node value / button label). Null when bound. */
    public String text;

    /** property id → typed value. */
    public final Map<Integer, Object> properties = new LinkedHashMap<>();

    /** property id → reactive signal (re-emits only that property on change). */
    public final Map<Integer, Signal<?>> propertyBindings = new LinkedHashMap<>();

    /** Reactive text binding (re-emits only {@code SET_TEXT} on change). */
    public Signal<String> textBinding;

    /** Reactive date binding for a {@code DATE_PICKER} (days since epoch; re-emits {@code SET_DATE}). */
    public Signal<Integer> dateBinding;

    /** Current date value: days since epoch. */
    public int days;

    /** Current date value: millis of day (0..86,400,000). */
    public int millisOfDay;

    /** Ordered children. */
    public final List<PathlandNode> children = new ArrayList<>();

    /** App-side tap callbacks (resolved by node id after the emitter assigns ids). */
    public final List<Runnable> tapActions = new ArrayList<>();

    /** Writable text-input sink (text fields); the emitter routes TEXT_CHANGED into it. */
    public Consumer<String> textInput;

    /** Writable value-input sink (sliders/switches); the emitter routes VALUE_CHANGED into it. */
    public Consumer<Float> valueInput;

    public PathlandNode(int component) {
        this.component = component;
    }

    /** Whether this node carries reactive (signal-backed) text. */
    public boolean hasReactiveText() {
        return textBinding != null;
    }

    /** Current text value: the bound signal's value when reactive, else the static text. */
    public String textValue() {
        return textBinding != null ? textBinding.get() : text;
    }
}