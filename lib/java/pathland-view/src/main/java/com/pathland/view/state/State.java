package com.pathland.view.state;

import com.pathland.view.signal.WritableSignal;

import java.util.function.UnaryOperator;

/**
 * A field-holder for a persisted signal (the Java realization of a SwiftUI-style
 * {@code @State} field, wired by the {@code pathland-view-processor} annotation
 * processor). Declared as a {@code @Persisted} field in a view and populated by the
 * generated binder before the first render.
 *
 * <pre>{@code
 * @Persisted State<Integer> count = new State<>(0);
 * count.get();              // current value
 * count.update(v -> v + 1); // mutate (persisted automatically)
 * }</pre>
 *
 * @param <T> the state type
 */
public final class State<T> {

    private final T initial;
    private WritableSignal<T> signal;

    public State(T initial) {
        this.initial = initial;
    }

    /** Called by the generated binder to connect this state to the store under {@code name}. */
    public void bind(PersistentState state, String name) {
        this.signal = state.signal(name, initial);
    }

    /** The underlying signal (for {@code TextField}, {@code View.text(Signal)}, …). */
    public WritableSignal<T> signal() {
        return signal;
    }

    /** The current value. */
    public T get() {
        return signal.get();
    }

    /** Replace the value. */
    public void set(T value) {
        signal.set(value);
    }

    /** Derive a new value from the current one and set it. */
    public void update(UnaryOperator<T> fn) {
        signal.update(fn);
    }
}