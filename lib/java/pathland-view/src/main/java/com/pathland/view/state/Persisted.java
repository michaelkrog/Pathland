package com.pathland.view.state;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks a {@link State} field for automatic persistence. The {@code pathland-view-processor}
 * annotation processor generates a binder that connects the field to the session's
 * {@link PersistentState} at mount time, keyed by the field's name (scoped to the
 * declaring view class).
 *
 * <p>The field must be of type {@link State}{@code <T>} and be package-private (so the
 * generated binder, in the same package, can reach it). Example:
 *
 * <pre>{@code
 * public final class Counter implements View {
 *     @Persisted State<Integer> count = new State<>(0);
 *     ...
 * }
 * }</pre>
 */
@Retention(RetentionPolicy.SOURCE)
@Target(ElementType.FIELD)
public @interface Persisted {

    /** Optional explicit store key; defaults to the field name. */
    String value() default "";
}