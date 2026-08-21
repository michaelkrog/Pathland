package pathland;

import com.sun.jna.Callback;
import com.sun.jna.Library;
import com.sun.jna.Native;
import com.sun.jna.Pointer;

/**
 * JNA binding for the Pathland GTK renderer (libpathland_gtk).
 *
 * A Java host authors the UI with the Pathland DSL and drives the
 * {@code pathland_native} flat world to emit opcodes, then hands the shared
 * host to the in-process GTK renderer via {@link #pathland_gtk_run}. The
 * renderer reports raw-input events back through a {@link EventCallback}.
 */
public interface PathlandGtk extends Library {

    PathlandGtk INSTANCE = Native.load("pathland_gtk", PathlandGtk.class);

    /**
     * Called on the GTK main thread when a native widget is activated
     * (e.g. a button click), with the activated node id.
     *
     * The callback may re-enter {@code pathland_native_*} to update the tree
     * and re-emit. Keep a strong reference to the callback for the lifetime of
     * {@link #pathland_gtk_run}.
     */
    interface EventCallback extends Callback {
        void invoke(int targetId);
    }

    /**
     * Run the GTK renderer over the host's shared ring. Blocks until the GTK
     * main loop exits (window closed).
     *
     * @param host    the opaque host from {@code pathland_native_create}
     * @param onEvent event callback (nullable)
     */
    void pathland_gtk_run(Pointer host, EventCallback onEvent);
}
