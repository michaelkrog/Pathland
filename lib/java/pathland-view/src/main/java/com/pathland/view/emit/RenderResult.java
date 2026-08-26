package com.pathland.view.emit;

/** The result of mounting a view tree: the root node id and the tap-action routing map. */
public record RenderResult(int rootId, java.util.Map<Integer, Runnable> tapActions) {}