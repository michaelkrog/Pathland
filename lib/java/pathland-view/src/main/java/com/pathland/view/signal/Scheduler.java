package com.pathland.view.signal;

import java.util.ArrayDeque;

/**
 * Synchronous effect scheduler. Dirty effects are queued and flushed to quiescence
 * at the end of the outermost signal write — the deterministic flush model chosen
 * for SSR + WebSocket delta streaming. No async surprises: by the time {@code set}
 * returns, all effects that depend (transitively) on the write have run.
 */
final class Scheduler {

    private static final ArrayDeque<Effect> QUEUE = new ArrayDeque<>();
    private static boolean flushing = false;

    private Scheduler() {}

    static void schedule(Effect effect) {
        if (!effect.scheduled) {
            effect.scheduled = true;
            QUEUE.add(effect);
        }
        flush();
    }

    static void flush() {
        if (flushing) {
            return;
        }
        flushing = true;
        try {
            while (!QUEUE.isEmpty()) {
                Effect effect = QUEUE.poll();
                effect.scheduled = false;
                effect.runIfScheduled();
            }
        } finally {
            flushing = false;
        }
    }

    /** Drop a destroyed effect from the queue. */
    static void cancel(Effect effect) {
        QUEUE.remove(effect);
        effect.scheduled = false;
    }
}