package com.pathland.view.emit;

import com.pathland.view.Environment;
import com.pathland.view.ValueTypes;
import com.pathland.view.View;
import com.pathland.view.signal.EffectRef;
import com.pathland.view.signal.Signal;
import com.pathland.view.signal.Signals;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Consumer;

/**
 * The fine-grained emitter. Mounts a {@link View} tree once: assigns stable node ids,
 * emits the structural frame (TREE + STYLE), and registers a node-level binding effect
 * per reactive text/property. A signal change re-emits only that binding's
 * {@code SET_TEXT} / {@code SET_PROPERTY} — an unchanged signal emits zero opcodes.
 *
 * <p>This mirrors the Rust engine's signal dependency graph in Java: the retained tree
 * and its signal bindings live here, and the {@link OpcodeSink} (frame or ring) carries
 * only the delta opcodes.
 */
public final class Emitter {

    private final OpcodeSink sink;
    private final Map<Integer, Runnable> tapActions = new LinkedHashMap<>();
    private final Map<Integer, Consumer<String>> textInputs = new LinkedHashMap<>();
    private final Map<Integer, Consumer<Float>> valueInputs = new LinkedHashMap<>();
    private final List<EffectRef> bindings = new ArrayList<>();
    private int nextId = 1;
    private int rootId;
    private boolean mounted;

    public Emitter(OpcodeSink sink) {
        this.sink = Objects.requireNonNull(sink, "sink");
    }

    /** Mount the view tree: assign ids, emit the structural frame, register bindings. */
    public RenderResult mount(View root, Environment env) {
        if (mounted) {
            throw new IllegalStateException("Emitter already mounted; create a new Emitter per tree");
        }
        mounted = true;

        // Wire State fields before rendering (no-op for a stateless environment).
        com.pathland.view.state.PersistentState state = env.state();
        if (state != null) {
            state.connect(root);
        }

        PathlandNode tree = root.render(env);
        nextId = 1;
        assignIds(tree);
        tapActions.clear();
        textInputs.clear();
        valueInputs.clear();
        collectInputs(tree);

        sink.beginFrame();
        emitNode(tree);
        sink.endFrame();

        bindings.clear();
        registerBindings(tree);
        rootId = tree.id;
        return new RenderResult(rootId, Map.copyOf(tapActions), Map.copyOf(textInputs), Map.copyOf(valueInputs));
    }

    /** The root node id (0 until mounted). */
    public int rootId() {
        return rootId;
    }

    /** Stop all registered binding effects (e.g. when tearing down the tree). */
    public void destroy() {
        for (EffectRef effect : bindings) {
            effect.destroy();
        }
        bindings.clear();
    }

    private void assignIds(PathlandNode node) {
        node.id = nextId++;
        for (PathlandNode child : node.children) {
            assignIds(child);
        }
    }

    /** Collect tap actions + input sinks, keyed by node id, for the host's event routing. */
    private void collectInputs(PathlandNode node) {
        for (Runnable action : node.tapActions) {
            tapActions.put(node.id, action);
        }
        if (node.textInput != null) {
            textInputs.put(node.id, node.textInput);
        }
        if (node.valueInput != null) {
            valueInputs.put(node.id, node.valueInput);
        }
        for (PathlandNode child : node.children) {
            collectInputs(child);
        }
    }

    private void emitNode(PathlandNode node) {
        sink.createNode(node.id, node.component);

        String text = node.textValue();
        if (text != null && !text.isEmpty()) {
            sink.setText(node.id, text);
        }
        for (Map.Entry<Integer, Object> entry : node.properties.entrySet()) {
            emitProperty(node.id, entry.getKey(), entry.getValue());
        }
        for (PathlandNode child : node.children) {
            emitNode(child);
            sink.insertChild(node.id, child.id, -1);
        }
    }

    private void emitProperty(int nodeId, int property, Object value) {
        int valueType = ValueTypes.forProperty(property);
        sink.setProperty(nodeId, property, valueType, value);
    }

    /**
     * Register a node-level binding effect for every reactive text/property in the
     * tree. When the bound signal changes, only that node's delta opcode is emitted.
     * The effect's first (immediate) run reads the current value and finds it equal to
     * the node's value already emitted at mount, so no duplicate opcode is produced.
     */
    private void registerBindings(PathlandNode node) {
        if (node.textBinding != null) {
            bindings.add(Signals.effect(() -> {
                String value = node.textBinding.get();
                if (!Objects.equals(value, node.text)) {
                    node.text = value;
                    sink.beginFrame();
                    sink.setText(node.id, value);
                    sink.endFrame();
                }
            }));
        }
        for (Map.Entry<Integer, Signal<?>> entry : node.propertyBindings.entrySet()) {
            int property = entry.getKey();
            Signal<?> signal = entry.getValue();
            bindings.add(Signals.effect(() -> {
                Object value = ReactiveValues.from(property, signal);
                if (!Objects.equals(value, node.properties.get(property))) {
                    node.properties.put(property, value);
                    sink.beginFrame();
                    emitProperty(node.id, property, value);
                    sink.endFrame();
                }
            }));
        }
        for (PathlandNode child : node.children) {
            registerBindings(child);
        }
    }
}