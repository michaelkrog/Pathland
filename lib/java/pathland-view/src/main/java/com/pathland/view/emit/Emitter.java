package com.pathland.view.emit;

import com.pathland.view.Color;
import com.pathland.view.Environment;
import com.pathland.view.ThemeData;
import com.pathland.view.ValueTypes;
import com.pathland.view.View;
import com.pathland.view.signal.EffectRef;
import com.pathland.view.signal.Signal;
import com.pathland.view.signal.Signals;

import java.util.ArrayList;
import java.util.Collections;
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
 * <p><b>Structural reactivity</b> (spec DSL.md §3.4): a node with a
 * {@link PathlandNode#structuralContent} slot is a <em>structural container</em> —
 * its single child subtree is selected by a signal and reconciled by a structural
 * effect. On selector change the emitter re-evaluates the content, diffs the retained
 * subtree, and emits only {@code TREE} deltas (CREATE/DELETE/INSERT); an identical
 * recompute emits zero opcodes. The slot's own subtree bindings are owned by that
 * effect, so nested structural containers work.
 *
 * <p>This mirrors the Rust engine's signal dependency graph in Java: the retained tree
 * and its signal bindings live here, and the {@link OpcodeSink} (frame or ring) carries
 * only the delta opcodes.
 */
public final class Emitter {

    private final OpcodeSink sink;
    private final ThemeData theme;
    private final Map<Integer, Runnable> tapActions = new LinkedHashMap<>();
    private final Map<Integer, Consumer<String>> textInputs = new LinkedHashMap<>();
    private final Map<Integer, Consumer<Float>> valueInputs = new LinkedHashMap<>();
    private final Map<Integer, DateInput> dateInputs = new LinkedHashMap<>();
    private final List<EffectRef> bindings = new ArrayList<>();
    private final Map<Integer, List<EffectRef>> nodeBindings = new LinkedHashMap<>();
    private int nextId = 1;
    private int rootId;
    private boolean mounted;
    private PathlandNode tree;
    private Environment env;

    public Emitter(OpcodeSink sink) {
        this(sink, null);
    }

    /**
     * Create an emitter with a global theme ({@link ThemeData}: a single
     * {@link Theme} or an {@link AdaptiveTheme} light+dark pair). The theme's
     * {@code STYLE::SET_DESIGN_TOKEN} overrides are emitted at the start of the
     * **mount** and **renderFull** (resync) frames, so the SSR document and the
     * first client frame both carry them. Overrides are renderer-global and
     * never re-emit nodes; deltas are unaffected.
     */
    public Emitter(OpcodeSink sink, ThemeData theme) {
        this.sink = Objects.requireNonNull(sink, "sink");
        this.theme = theme;
    }

    /** Mount the view tree: assign ids, emit the structural frame, register bindings. */
    public RenderResult mount(View root, Environment env) {
        if (mounted) {
            throw new IllegalStateException("Emitter already mounted; create a new Emitter per tree");
        }
        mounted = true;
        this.env = env;

        PathlandNode tree = root.render(env);
        this.tree = tree;
        nextId = 1;
        assignIds(tree);
        tapActions.clear();
        textInputs.clear();
        valueInputs.clear();
        dateInputs.clear();
        collectInputs(tree);

        sink.beginFrame();
        emitTheme();
        emitNode(tree);
        sink.endFrame();

        bindings.clear();
        nodeBindings.clear();
        registerBindings(tree);
        rootId = tree.id;
        return new RenderResult(
                rootId,
                Collections.unmodifiableMap(tapActions),
                Collections.unmodifiableMap(textInputs),
                Collections.unmodifiableMap(valueInputs),
                Collections.unmodifiableMap(dateInputs));
    }

    /** The root node id (0 until mounted). */
    public int rootId() {
        return rootId;
    }

    /**
     * Re-emit the complete retained tree as one full-snapshot frame (TREE + STYLE).
     * Used for {@code META::RESYNC} (reconnect/gap recovery) and no-JS refresh. Does
     * not re-mount or re-wire state — it replays the current tree through the sink.
     */
    public void renderFull() {
        if (!mounted) {
            throw new IllegalStateException("Emitter not mounted");
        }
        sink.beginFrame();
        emitTheme();
        emitNode(tree);
        sink.endFrame();
    }

    /** Emit the global theme overrides at the start of a full frame. */
    private void emitTheme() {
        if (theme != null) {
            theme.emitInto(sink);
        }
    }

    /** Stop all registered binding effects (e.g. when tearing down the tree). */
    public void destroy() {
        for (EffectRef effect : bindings) {
            effect.destroy();
        }
        bindings.clear();
        nodeBindings.clear();
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
        if (node.dateInput != null) {
            dateInputs.put(node.id, node.dateInput);
        }
        for (PathlandNode child : node.children) {
            collectInputs(child);
        }
    }

    /** Drop input routing entries for a subtree being removed (ids stay for reused nodes). */
    private void forgetInputs(List<PathlandNode> nodes) {
        for (PathlandNode node : nodes) {
            forgetInputs(node);
        }
    }

    private void forgetInputs(PathlandNode node) {
        tapActions.remove(node.id);
        textInputs.remove(node.id);
        valueInputs.remove(node.id);
        dateInputs.remove(node.id);
        for (PathlandNode child : node.children) {
            forgetInputs(child);
        }
    }

    private void emitNode(PathlandNode node) {
        sink.createNode(node.id, node.component);

        String text = node.textValue();
        if (text != null && !text.isEmpty()) {
            sink.setText(node.id, text);
        }
        if (node.dateBinding != null) {
            sink.setDate(node.id, node.days, node.millisOfDay);
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
        int valueType = value instanceof Color c && c.isToken()
                ? ValueTypes.DESIGN_TOKEN
                : ValueTypes.forProperty(property);
        sink.setProperty(nodeId, property, valueType, value);
    }

    /**
     * Register a node-level binding effect for every reactive text/property in the
     * tree. When the bound signal changes, only that node's delta opcode is emitted.
     * The effect's first (immediate) run reads the current value and finds it equal to
     * the node's value already emitted at mount, so no duplicate opcode is produced.
     *
     * <p>A structural slot ({@link PathlandNode#structuralContent}) does not recurse
     * into its child subtree here: its structural effect owns that subtree entirely
     * (it re-registers bindings after each reconcile), which keeps nested structural
     * containers correct.
     */
    private void registerBindings(PathlandNode node) {
        registerNodeBindings(node);
        if (node.structuralContent != null) {
            EffectRef structural = Signals.effect(() -> reconcileSlot(node));
            bindings.add(structural);
            nodeBindings.computeIfAbsent(node.id, k -> new ArrayList<>()).add(structural);
        } else {
            for (PathlandNode child : node.children) {
                registerBindings(child);
            }
        }
    }

    private void registerNodeBindings(PathlandNode node) {
        if (node.textBinding != null) {
            EffectRef effect = Signals.effect(() -> {
                String value = node.textBinding.get();
                if (!Objects.equals(value, node.text)) {
                    node.text = value;
                    sink.beginFrame();
                    sink.setText(node.id, value);
                    sink.endFrame();
                }
            });
            bindings.add(effect);
            nodeBindings.computeIfAbsent(node.id, k -> new ArrayList<>()).add(effect);
        }
        if (node.dateBinding != null) {
            EffectRef effect = Signals.effect(() -> {
                int days = node.dateBinding.get();
                if (days != node.days) {
                    node.days = days;
                    sink.beginFrame();
                    sink.setDate(node.id, days, node.millisOfDay);
                    sink.endFrame();
                }
            });
            bindings.add(effect);
            nodeBindings.computeIfAbsent(node.id, k -> new ArrayList<>()).add(effect);
        }
        for (Map.Entry<Integer, Signal<?>> entry : node.propertyBindings.entrySet()) {
            int property = entry.getKey();
            Signal<?> signal = entry.getValue();
            EffectRef effect = Signals.effect(() -> {
                Object value = ReactiveValues.from(property, signal);
                if (!Objects.equals(value, node.properties.get(property))) {
                    node.properties.put(property, value);
                    sink.beginFrame();
                    emitProperty(node.id, property, value);
                    sink.endFrame();
                }
            });
            bindings.add(effect);
            nodeBindings.computeIfAbsent(node.id, k -> new ArrayList<>()).add(effect);
        }
    }

    /**
     * Reconcile a structural slot's child subtree against the retained one. Runs inside
     * a {@code Signals.effect}: the content supplier reads the selector signal (the
     * tracked dependency), then renders the new content <em>untracked</em> so reactive
     * values inside it stay fine-grained (owned by their own node-level binding effects).
     */
    private void reconcileSlot(PathlandNode slot) {
        View content = slot.structuralContent.get(); // tracked: subscribes to the selector
        PathlandNode fresh = content == null ? null : Signals.untracked(() -> content.render(env));
        List<PathlandNode> oldChildren = slot.children;
        List<PathlandNode> newChildren = fresh == null ? List.of() : List.of(fresh);

        destroySubtreeBindings(oldChildren);
        forgetInputs(oldChildren);

        List<Runnable> ops = new ArrayList<>();
        reconcileChildren(slot, oldChildren, newChildren, ops);
        slot.children.clear();
        slot.children.addAll(newChildren);

        if (!ops.isEmpty()) {
            sink.beginFrame();
            for (Runnable op : ops) {
                op.run();
            }
            sink.endFrame();
        }

        if (fresh != null) {
            collectInputs(fresh);
            registerBindings(fresh);
        }
    }

    /**
     * Diff a parent's old child list against a new one, assigning stable ids by
     * position + component type and recording the emission operations. Identical
     * structure produces no operations (zero opcodes).
     */
    private void reconcileChildren(
            PathlandNode parent, List<PathlandNode> oldList, List<PathlandNode> newList, List<Runnable> ops) {
        int n = Math.max(oldList.size(), newList.size());
        for (int i = 0; i < n; i++) {
            PathlandNode old = i < oldList.size() ? oldList.get(i) : null;
            PathlandNode fresh = i < newList.size() ? newList.get(i) : null;
            if (old != null && fresh != null && old.component == fresh.component) {
                fresh.id = old.id; // stable id: reused across the swap
                reconcileNode(old, fresh, ops);
            } else {
                if (old != null) {
                    int parentId = parent.id, oldId = old.id;
                    ops.add(() -> {
                        sink.removeChild(parentId, oldId);
                        sink.deleteNode(oldId);
                    });
                }
                if (fresh != null) {
                    fresh.id = nextId++;
                    int id = fresh.id, component = fresh.component, index = i;
                    ops.add(() -> sink.createNode(id, component));
                    emitSubtreeInto(ops, fresh);
                    int parentId = parent.id;
                    ops.add(() -> sink.insertChild(parentId, id, index));
                }
            }
        }
    }

    /** Content diff for a matched (same component, same position) node pair. */
    private void reconcileNode(PathlandNode old, PathlandNode fresh, List<Runnable> ops) {
        String oldText = old.text; // last-emitted text (kept current by bindings)
        String freshText = currentText(fresh);
        if (!Objects.equals(oldText, freshText)) {
            int id = fresh.id;
            String text = freshText;
            ops.add(() -> sink.setText(id, text));
        }
        for (Map.Entry<Integer, Object> entry : fresh.properties.entrySet()) {
            if (!Objects.equals(entry.getValue(), old.properties.get(entry.getKey()))) {
                int id = fresh.id, property = entry.getKey();
                Object value = entry.getValue();
                ops.add(() -> emitProperty(id, property, value));
            }
        }
        if (old.days != fresh.days || old.millisOfDay != fresh.millisOfDay) {
            int id = fresh.id, days = fresh.days, millis = fresh.millisOfDay;
            ops.add(() -> sink.setDate(id, days, millis));
        }
        reconcileChildren(fresh, old.children, fresh.children, ops);
    }

    /** Emit a newly created node's content + its whole child subtree (children get fresh ids). */
    private void emitSubtreeInto(List<Runnable> ops, PathlandNode node) {
        String text = currentText(node);
        if (text != null && !text.isEmpty()) {
            int id = node.id;
            String t = text;
            ops.add(() -> sink.setText(id, t));
        }
        if (node.dateBinding != null) {
            int id = node.id, days = node.days, millis = node.millisOfDay;
            ops.add(() -> sink.setDate(id, days, millis));
        }
        for (Map.Entry<Integer, Object> entry : node.properties.entrySet()) {
            int id = node.id, property = entry.getKey();
            Object value = entry.getValue();
            ops.add(() -> emitProperty(id, property, value));
        }
        for (PathlandNode child : node.children) {
            child.id = nextId++;
            int id = child.id, component = child.component;
            ops.add(() -> sink.createNode(id, component));
            emitSubtreeInto(ops, child);
            int parentId = node.id;
            ops.add(() -> sink.insertChild(parentId, id, -1));
        }
    }

    /** Destroy the binding effects owned by a subtree (before it is replaced). */
    private void destroySubtreeBindings(List<PathlandNode> nodes) {
        for (PathlandNode node : nodes) {
            destroySubtreeBindings(node);
        }
    }

    private void destroySubtreeBindings(PathlandNode node) {
        List<EffectRef> refs = nodeBindings.remove(node.id);
        if (refs != null) {
            for (EffectRef ref : refs) {
                ref.destroy();
            }
            bindings.removeAll(refs);
        }
        for (PathlandNode child : node.children) {
            destroySubtreeBindings(child);
        }
    }

    /** Current text value without recording a dependency (reconcile runs untracked). */
    private static String currentText(PathlandNode node) {
        if (node.textBinding != null) {
            return Signals.untracked(node.textBinding::get);
        }
        return node.text;
    }
}