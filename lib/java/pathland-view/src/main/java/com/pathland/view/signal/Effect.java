package com.pathland.view.signal;

import java.util.Objects;

/**
 * A reactive effect (Angular-style {@code effect}). Runs its body immediately on
 * creation, tracking the signals it reads; re-runs (synchronously, via the shared
 * {@link Scheduler}) whenever a tracked dependency's value actually changes.
 */
final class Effect extends ReactiveNode implements EffectRef {

    private final Runnable fn;
    boolean scheduled;

    Effect(Runnable fn, EffectOptions options, String name) {
        super(name);
        this.fn = Objects.requireNonNull(fn, "effect body");
        this.allowSignalWrites = options.allowSignalWrites();
        if (!options.manualCleanup()) {
            schedule();
        }
    }

    void schedule() {
        Scheduler.schedule(this);
    }

    void runIfScheduled() {
        if (!dirty) {
            return;
        }
        refreshProducers();
        dirty = false;
        if (!firstRun && !depsChanged()) {
            return; // dirtied transitively, but no tracked producer actually changed
        }
        firstRun = false;
        ReactiveContext.push(this);
        resetProducers();
        try {
            fn.run();
            error = null;
        } catch (Throwable t) {
            error = t;
            throw new EffectException("Effect '" + describe() + "' threw during flush", t);
        } finally {
            ReactiveContext.pop();
        }
    }

    @Override
    public void destroy() {
        Scheduler.cancel(this);
        resetProducers();
        dirty = false;
    }
}