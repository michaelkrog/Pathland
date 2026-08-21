package pathland;

/**
 * App-side tap recognition over raw-input events (mirrors
 * {@code pathland_view::TapRecognizer}).
 *
 * A tap is a {@code POINTER_DOWN} followed by a {@code POINTER_UP} on the same
 * target, within a movement slop and a time window. A move beyond the slop,
 * leaving the node, or a down/up pair on different targets cancels the gesture.
 *
 * Feed events (and a monotonic timestamp in milliseconds) to
 * {@link #feed}; it returns the tapped target id, or {@code -1} when no tap
 * completed.
 */
public final class TapRecognizer {

    private static final int NO_TARGET = -1;

    private final float maxDistance;
    private final long maxDurationMs;

    private int downTarget = NO_TARGET;
    private float downX;
    private float downY;
    private long downTimeMs;

    public TapRecognizer() {
        this(10.0f, 500L);
    }

    public TapRecognizer(float maxDistance, long maxDurationMs) {
        this.maxDistance = maxDistance;
        this.maxDurationMs = maxDurationMs;
    }

    /** Feed one raw-input event; returns the tapped target id, or {@code -1}. */
    public int feed(EventReader.Event e, long nowMs) {
        if (e.isPointerDown()) {
            downTarget = e.target;
            downX = e.x();
            downY = e.y();
            downTimeMs = nowMs;
            return NO_TARGET;
        }
        if (e.isPointerUp()) {
            int target = downTarget;
            downTarget = NO_TARGET;
            if (target == e.target
                    && (nowMs - downTimeMs) <= maxDurationMs
                    && distanceSq(downX, downY, e.x(), e.y()) <= maxDistance * maxDistance) {
                return target;
            }
            return NO_TARGET;
        }
        if (e.isPointerMove()) {
            if (downTarget != NO_TARGET
                    && (e.isLeaving()
                        || e.target != downTarget
                        || distanceSq(downX, downY, e.x(), e.y()) > maxDistance * maxDistance)) {
                downTarget = NO_TARGET;
            }
        }
        return NO_TARGET;
    }

    /** Cancel any in-progress gesture. */
    public void reset() {
        downTarget = NO_TARGET;
    }

    private static float distanceSq(float x0, float y0, float x1, float y1) {
        float dx = x1 - x0;
        float dy = y1 - y0;
        return dx * dx + dy * dy;
    }
}
