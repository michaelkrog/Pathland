package com.pathland.view.ffm;

import com.pathland.view.emit.Opcode;

import java.lang.foreign.Arena;
import java.lang.foreign.FunctionDescriptor;
import java.lang.foreign.Linker;
import java.lang.foreign.MemorySegment;
import java.lang.foreign.SymbolLookup;
import java.lang.foreign.ValueLayout;
import java.lang.invoke.MethodHandle;
import java.util.NoSuchElementException;

/**
 * Java Foreign Function &amp; Memory binding to the Rust {@code libpathland_core}
 * cdylib — the SPSC ring buffer + 16-byte opcode engine.
 *
 * <p>This is the desktop/embedded zero-copy path. Opcodes are written into a reused
 * native {@link MemorySegment} (no per-op heap allocation) and pushed into the shared
 * ring with zero JNI overhead. The library is loaded <em>lazily</em> on first use:
 * server apps (Spring Boot / Quarkus) that only emit self-contained frames never touch
 * it.
 *
 * <p>C ABI (see {@code lib/rust/crates/pathland-core-capi}):
 * <pre>
 * void*  pathland_core_create(void);
 * void   pathland_core_destroy(void*);
 * bool   pathland_ring_buffer_push(void*, const uint8_t* opcode); // 16 bytes
 * uint32 pathland_core_arena_alloc(void*, const uint8_t* bytes, uint32 len);
 * void   pathland_core_begin_frame(void*) / pathland_core_end_frame(void*);
 * uint32 pathland_core_frame_count(void*);
 * const uint8_t* pathland_core_ring_ptr(void*);
 * uint64 pathland_core_ring_len(void*);
 * uint32 pathland_core_drain_events(void*, uint8_t* out, uint32 max);
 * bool   pathland_core_send_event(void*, const uint8_t* opcode); // 16 bytes
 * </pre>
 */
public final class PathlandCore {

    /** Thrown when the native library cannot be linked (missing {@code libpathland_core}). */
    public static final class NativeUnavailableException extends IllegalStateException {
        public NativeUnavailableException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    private static final class Holder {
        static final PathlandCore INSTANCE = new PathlandCore();
    }

    /** The process-wide binding; lazily links {@code libpathland_core} on first call. */
    public static PathlandCore instance() {
        return Holder.INSTANCE;
    }

    private final Arena arena = Arena.ofAuto();
    private final Linker linker = Linker.nativeLinker();
    private final MethodHandle createH;
    private final MethodHandle destroyH;
    private final MethodHandle pushH;
    private final MethodHandle arenaAllocH;
    private final MethodHandle beginFrameH;
    private final MethodHandle endFrameH;
    private final MethodHandle frameCountH;
    private final MethodHandle ringPtrH;
    private final MethodHandle ringLenH;
    private final MethodHandle drainEventsH;
    private final MethodHandle sendEventH;

    /** Reused 16-byte opcode buffer (zero per-op heap allocations). */
    private final MemorySegment opcodeBuf = arena.allocate(Opcode.SIZE);

    private PathlandCore() {
        try {
            String libraryPath = resolveLibraryPath();
            if (libraryPath == null) {
                throw new NativeUnavailableException(
                        "libpathland_core not found on java.library.path; "
                                + "set the system property pathland.core.lib to its full path", null);
            }
            SymbolLookup lookup = SymbolLookup.libraryLookup(java.nio.file.Path.of(libraryPath), arena);
            createH = linker.downcallHandle(find(lookup, "pathland_core_create"),
                    FunctionDescriptor.of(ValueLayout.ADDRESS));
            destroyH = linker.downcallHandle(find(lookup, "pathland_core_destroy"),
                    FunctionDescriptor.ofVoid(ValueLayout.ADDRESS));
            pushH = linker.downcallHandle(find(lookup, "pathland_ring_buffer_push"),
                    FunctionDescriptor.of(ValueLayout.JAVA_BOOLEAN, ValueLayout.ADDRESS, ValueLayout.ADDRESS));
            arenaAllocH = linker.downcallHandle(find(lookup, "pathland_core_arena_alloc"),
                    FunctionDescriptor.of(ValueLayout.JAVA_INT, ValueLayout.ADDRESS, ValueLayout.ADDRESS, ValueLayout.JAVA_INT));
            beginFrameH = linker.downcallHandle(find(lookup, "pathland_core_begin_frame"),
                    FunctionDescriptor.ofVoid(ValueLayout.ADDRESS));
            endFrameH = linker.downcallHandle(find(lookup, "pathland_core_end_frame"),
                    FunctionDescriptor.ofVoid(ValueLayout.ADDRESS));
            frameCountH = linker.downcallHandle(find(lookup, "pathland_core_frame_count"),
                    FunctionDescriptor.of(ValueLayout.JAVA_INT, ValueLayout.ADDRESS));
            ringPtrH = linker.downcallHandle(find(lookup, "pathland_core_ring_ptr"),
                    FunctionDescriptor.of(ValueLayout.ADDRESS, ValueLayout.ADDRESS));
            ringLenH = linker.downcallHandle(find(lookup, "pathland_core_ring_len"),
                    FunctionDescriptor.of(ValueLayout.JAVA_LONG, ValueLayout.ADDRESS));
            drainEventsH = linker.downcallHandle(find(lookup, "pathland_core_drain_events"),
                    FunctionDescriptor.of(ValueLayout.JAVA_INT, ValueLayout.ADDRESS, ValueLayout.ADDRESS, ValueLayout.JAVA_INT));
            sendEventH = linker.downcallHandle(find(lookup, "pathland_core_send_event"),
                    FunctionDescriptor.of(ValueLayout.JAVA_BOOLEAN, ValueLayout.ADDRESS, ValueLayout.ADDRESS));
        } catch (Throwable t) {
            throw new NativeUnavailableException("failed to link libpathland_core", t);
        }
    }

    private static MemorySegment find(SymbolLookup lookup, String name) {
        return lookup.find(name)
                .orElseThrow(() -> new NoSuchElementException("missing native symbol: " + name));
    }

    /**
     * Resolve the native library's full path: the {@code pathland.core.lib} system
     * property if set, else {@code libpathland_core} (with the platform extension)
     * searched on {@code java.library.path}.
     */
    static String resolveLibraryPath() {
        String override = System.getProperty("pathland.core.lib");
        if (override != null) {
            return override;
        }
        String fileName = "libpathland_core" + platformLibraryExtension();
        String libraryPath = System.getProperty("java.library.path");
        if (libraryPath == null) {
            return null;
        }
        for (String dir : libraryPath.split(java.io.File.pathSeparator)) {
            java.io.File candidate = new java.io.File(dir, fileName);
            if (candidate.isFile()) {
                return candidate.getAbsolutePath();
            }
        }
        return null;
    }

    private static String platformLibraryExtension() {
        String os = System.getProperty("os.name", "").toLowerCase(java.util.Locale.ROOT);
        if (os.contains("mac")) {
            return ".dylib";
        }
        if (os.contains("win")) {
            return ".dll";
        }
        return ".so";
    }

    // --- ring host lifetime ---

    /** Create a ring host over a fresh shared ring. */
    public MemorySegment create() {
        return (MemorySegment) invoke(createH);
    }

    /** Destroy a ring host. */
    public void destroy(MemorySegment handle) {
        invoke(destroyH, handle);
    }

    // --- guest → host ring ---

    /** Push one 16-byte opcode into the shared ring. Returns false when full. */
    public boolean push(MemorySegment handle, byte[] opcode) {
        opcodeBuf.copyFrom(MemorySegment.ofArray(opcode));
        return (boolean) invoke(pushH, handle, opcodeBuf);
    }

    /** Allocate bytes into the bump arena, returning the absolute offset (or {@code u32::MAX}). */
    public int arenaAlloc(MemorySegment handle, byte[] bytes) {
        MemorySegment buf = arena.allocate(bytes.length);
        buf.copyFrom(MemorySegment.ofArray(bytes));
        return (int) invoke(arenaAllocH, handle, buf, bytes.length);
    }

    public void beginFrame(MemorySegment handle) {
        invoke(beginFrameH, handle);
    }

    public void endFrame(MemorySegment handle) {
        invoke(endFrameH, handle);
    }

    public int frameCount(MemorySegment handle) {
        return (int) invoke(frameCountH, handle);
    }

    /** Pointer to the shared linear memory (header | ring | arena) for zero-copy reads. */
    public MemorySegment ringPtr(MemorySegment handle) {
        return (MemorySegment) invoke(ringPtrH, handle);
    }

    /** Byte length of the shared linear memory. */
    public long ringLen(MemorySegment handle) {
        return (long) invoke(ringLenH, handle);
    }

    // --- events (host → guest) ---

    /** Drain pending EVENT opcodes into {@code out}; returns the number written. */
    public int drainEvents(MemorySegment handle, MemorySegment out, int max) {
        return (int) invoke(drainEventsH, handle, out, max);
    }

    /** Push one 16-byte EVENT opcode into the host → guest event ring. */
    public boolean sendEvent(MemorySegment handle, byte[] opcode) {
        opcodeBuf.copyFrom(MemorySegment.ofArray(opcode));
        return (boolean) invoke(sendEventH, handle, opcodeBuf);
    }

    private static Object invoke(MethodHandle handle, Object... args) {
        try {
            return handle.invokeWithArguments(args);
        } catch (Throwable t) {
            throw new NativeUnavailableException("native call failed: " + handle, t);
        }
    }
}