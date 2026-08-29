package com.pathland.view.ffm;

import com.pathland.view.Categories;
import com.pathland.view.Commands;
import com.pathland.view.ValueTypes;
import com.pathland.view.emit.Opcode;
import com.pathland.view.emit.OpcodeSink;
import com.pathland.view.emit.ValueEncoder;

import java.lang.foreign.MemorySegment;
import java.nio.charset.StandardCharsets;

/**
 * An {@link OpcodeSink} that writes opcodes zero-copy into the Rust SPSC ring via
 * FFM. Strings are allocated into the shared bump arena (absolute offsets). This is the
 * desktop/embedded path; the frame path uses {@code FrameOpcodeSink} instead.
 */
public final class RingOpcodeSink implements OpcodeSink, AutoCloseable {

    private final PathlandCore core;
    private final MemorySegment handle;

    public RingOpcodeSink() {
        this(PathlandCore.instance());
    }

    public RingOpcodeSink(PathlandCore core) {
        this.core = core;
        this.handle = core.create();
    }

    /** The opaque native handle (for direct ring access). */
    public MemorySegment handle() {
        return handle;
    }

    @Override
    public void beginFrame() {
        core.beginFrame(handle);
    }

    @Override
    public void endFrame() {
        core.endFrame(handle);
    }

    @Override
    public void createNode(int id, int component) {
        push(Categories.TREE, Commands.Tree.CREATE_NODE, 0, id, component, 0);
    }

    @Override
    public void deleteNode(int id) {
        push(Categories.TREE, Commands.Tree.DELETE_NODE, 0, id, 0, 0);
    }

    @Override
    public void insertChild(int parent, int child, int index) {
        push(Categories.TREE, Commands.Tree.INSERT_CHILD, 0, parent, child, index);
    }

    @Override
    public void removeChild(int parent, int child) {
        push(Categories.TREE, Commands.Tree.REMOVE_CHILD, 0, parent, child, 0);
    }

    @Override
    public void moveChild(int parent, int child, int newIndex) {
        push(Categories.TREE, Commands.Tree.MOVE_CHILD, 0, parent, child, newIndex);
    }

    @Override
    public void setText(int nodeId, String text) {
        int ref = core.arenaAlloc(handle, text.getBytes(StandardCharsets.UTF_8));
        push(Categories.STYLE, Commands.Style.SET_TEXT, 0, nodeId, ref, 0);
    }

    @Override
    public void setProperty(int nodeId, int property, int valueType, Object value) {
        int b = (valueType << 16) | (property & 0xFFFF);
        if (valueType == ValueTypes.STRING) {
            int ref = core.arenaAlloc(handle, ((String) value).getBytes(StandardCharsets.UTF_8));
            push(Categories.STYLE, Commands.Style.SET_PROPERTY, 0, nodeId, b, ref);
        } else {
            push(Categories.STYLE, Commands.Style.SET_PROPERTY, 0, nodeId, b,
                    ValueEncoder.encodeBits(valueType, value));
        }
    }

    @Override
    public void setDate(int nodeId, int days, int millisOfDay) {
        push(Categories.STYLE, Commands.Style.SET_DATE, 0, nodeId, days, millisOfDay);
    }

    private void push(int category, int command, int flags, int a, int b, int c) {
        core.push(handle, new Opcode(category, command, flags, a, b, c).toBytes());
    }

    @Override
    public void close() {
        core.destroy(handle);
    }
}