package demo;

import com.sun.jna.Memory;
import com.sun.jna.Pointer;
import pathland.Align;
import pathland.Bridge;
import pathland.Constants;
import pathland.DSL;
import pathland.EventReader;
import pathland.Node;
import pathland.PathlandGtk;
import pathland.PathlandNative;
import pathland.View;

/**
 * Pathland Java + GTK desktop demo.
 *
 * Proves the cross-language + shared-renderer story for Java:
 *  - a SwiftUI-like DSL authoring surface (pathland.DSL)
 *  - drives Rust components via the flat pathland_native C ABI
 *  - renders through the shared pathland-gtk renderer (in-process via JNA)
 *
 * The demo does not use Swing or any GTK API directly — it only authors the UI
 * with Pathland and hands it to the renderer. Native inputs round-trip as
 * EVENT opcodes through the shared ring; the renderer wakes us (no payload)
 * and we drain the event ring via {@code pathland_native_drain_events}.
 *
 * Run:
 *   PATH="$HOME/.cargo/bin:$PATH" cargo build -p pathland-native -p pathland-gtk
 *   mvn -q -Dpathland.rust.target=<lib/rust/target/debug> compile exec:java
 *
 * On macOS, GTK must run on the main thread: launch the JVM with
 * {@code -XstartOnFirstThread}, e.g.
 *   MAVEN_OPTS="-XstartOnFirstThread" mvn -q -Dpathland.rust.target=<lib/rust/target/debug> compile exec:java
 */
public final class GtkDemo {

    /** Max events drained per wake (× 16 bytes each). */
    private static final int MAX_EVENTS = 64;

    private final Pointer host;
    private final Bridge bridge;
    private int count = 0;
    // Strong reference so JNA does not GC the callback mid-run.
    private final PathlandGtk.EventCallback onEvent;

    public GtkDemo() {
        host = PathlandNative.INSTANCE.pathland_native_create();
        bridge = new Bridge(host);
        onEvent = () -> {
            // Drain the event ring generically (EVENT opcodes) and react to a
            // pointer-up. Data flows through the opcode engine, not the callback.
            Memory buf = new Memory((long) MAX_EVENTS * 16);
            int n = PathlandNative.INSTANCE.pathland_native_drain_events(host, buf, MAX_EVENTS);
            boolean activated = false;
            for (EventReader.Event e : EventReader.decode(buf, n)) {
                if (e.isPointerUp()) {
                    activated = true;
                }
            }
            if (activated) {
                count += 1;
                render();
            }
        };
    }

    /** Rebuild the tree through the DSL, bridge it, then emit opcodes. */
    private void render() {
        View root = DSL.vstack(
                Align.LEADING, 12f,
                DSL.hstack(
                        DSL.text("Count: " + count).frame(Constants.FILL, Float.NaN, Align.LEADING),
                        DSL.button("Increment")
                ).padding(16f),
                DSL.text("Pathland · Java · shared ring").color(0x888888)
        ).padding(24f);

        Node tree = root.build();
        bridge.importTreeAndEmit(tree);
    }

    /** Emit the initial frame, then run the GTK renderer (blocks until closed). */
    public void run() {
        render();
        PathlandGtk.INSTANCE.pathland_gtk_run(host, onEvent);
    }

    public void shutdown() {
        PathlandNative.INSTANCE.pathland_native_destroy(host);
    }

    public static void main(String[] args) {
        GtkDemo demo = new GtkDemo();
        demo.run();
        demo.shutdown();
    }
}
