package com.pathland.view.emit;

import java.util.Map;
import java.util.function.Consumer;

/**
 * The result of mounting a view tree: the root node id and the event-routing maps. The
 * host forwards raw input events into these maps — it never reaches into view internals.
 *
 * @param rootId      the retained tree's root node id
 * @param tapActions  node id → pointer-up action
 * @param textInputs  node id → text-input sink (TEXT_CHANGED)
 * @param valueInputs node id → value-input sink (VALUE_CHANGED)
 * @param dateInputs  node id → date-input sink (DATE_CHANGED)
 */
public record RenderResult(
        int rootId,
        Map<Integer, Runnable> tapActions,
        Map<Integer, Consumer<String>> textInputs,
        Map<Integer, Consumer<Float>> valueInputs,
        Map<Integer, DateInput> dateInputs) {}