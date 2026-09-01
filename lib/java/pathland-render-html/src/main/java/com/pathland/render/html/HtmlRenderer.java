package com.pathland.render.html;

import com.pathland.view.emit.Frame;
import com.pathland.view.transport.FrameCodec;
import com.sun.jna.Library;
import com.sun.jna.Native;
import com.sun.jna.Pointer;

/**
 * The Java binding to the Rust HTML renderer ({@code libpathland_render_html}) —
 * a thin JNA shim over the flat C ABI. **Stateless and streaming**: each call
 * renders a self-contained snapshot frame to HTML in one pass (no retained tree).
 *
 * <p>This replaces the former hand-written retained Java renderer, so there is a
 * single renderer reused by every language (Rust SSR, Java via JNA, Swift/.NET via
 * the same ABI). The wire codec ({@link FrameCodec}) provides the self-contained
 * batch bytes the C ABI consumes.
 *
 * <p>C ABI (see {@code lib/rust/crates/pathland-render-html/src/capi.rs}):
 * <pre>
 * const char* pathland_html_render(const uint8_t* batch, uint32 len, uint32 root);
 * const char* pathland_html_render_fragment(const uint8_t* batch, uint32 len, uint32 root);
 * const char* pathland_tailwind_compile(const char* default_css, const char* override_css, const char* classes);
 * void        pathland_html_free(const char* ptr);
 * </pre>
 */
public final class HtmlRenderer {

    /** Thrown when the native library cannot be linked (missing {@code libpathland_render_html}). */
    public static final class NativeUnavailableException extends IllegalStateException {
        public NativeUnavailableException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    /** The C ABI surface, mapped by JNA onto the Rust cdylib. */
    private interface NativeRenderHtml extends Library {
        Pointer pathland_html_render(Pointer batch, int len, int root);
        Pointer pathland_html_render_fragment(Pointer batch, int len, int root);
        Pointer pathland_tailwind_compile(String defaultCss, String overrideCss, String classes);
        void pathland_html_free(Pointer ptr);
    }

    private static final class Holder {
        static final HtmlRenderer INSTANCE = new HtmlRenderer();
    }

    /** The process-wide binding; lazily links {@code libpathland_render_html} on first call. */
    public static HtmlRenderer instance() {
        return Holder.INSTANCE;
    }

    private final NativeRenderHtml nativeRenderer;

    private HtmlRenderer() {
        try {
            String path = resolveLibraryPath();
            if (path == null) {
                throw new NativeUnavailableException(
                        "libpathland_render_html not found on java.library.path; "
                                + "set pathland.render.html.lib or build the Rust crate", null);
            }
            nativeRenderer = Native.load(path, NativeRenderHtml.class);
        } catch (NativeUnavailableException e) {
            throw e;
        } catch (Throwable t) {
            throw new NativeUnavailableException("failed to link libpathland_render_html", t);
        }
    }

    /**
     * Resolve the native library's full path: the {@code pathland.render.html.lib}
     * system property if set, else {@code libpathland_render_html} (with the platform
     * extension) searched on {@code java.library.path}.
     */
    static String resolveLibraryPath() {
        String override = System.getProperty("pathland.render.html.lib");
        if (override != null) {
            return override;
        }
        String fileName = "libpathland_render_html" + platformLibraryExtension();
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

    /**
     * Render a full snapshot frame as a complete HTML document. The frame is the
     * self-contained mount/snapshot batch (TREE + STYLE) the emitter produced.
     */
    public String render(Frame frame, int root) {
        return renderFrame(frame, root, true);
    }

    /** Render a full snapshot frame as an HTML fragment (no {@code <html>}). */
    public String renderFragment(Frame frame, int root) {
        return renderFrame(frame, root, false);
    }

    /** Alias of {@link #renderFragment} for the {@code META::RESYNC} snapshot path. */
    public String renderFullSnapshot(Frame frame, int root) {
        return renderFrame(frame, root, false);
    }

    private String renderFrame(Frame frame, int root, boolean fullDocument) {
        byte[] bytes = FrameCodec.encodeFrame(frame);
        try (com.sun.jna.Memory memory = new com.sun.jna.Memory(bytes.length)) {
            memory.write(0, bytes, 0, bytes.length);
            Pointer result = fullDocument
                    ? nativeRenderer.pathland_html_render(memory, bytes.length, root)
                    : nativeRenderer.pathland_html_render_fragment(memory, bytes.length, root);
            return take(result);
        }
    }

    /**
     * Compile the Tailwind CSS bundle at application start. {@code overrideCss} is the
     * developer's v4 CSS (may be empty); {@code classes} is the class safelist. The
     * bundled default {@code @theme} config (Inter) is used when no default is given.
     * Returns the compiled CSS, or a string starting with {@code PATHLAND_TAILWIND_ERROR:}
     * when compilation fails (e.g. no embedded binary / tailwindcss on PATH).
     */
    public String compileTailwind(String overrideCss, String classes) {
        Pointer result = nativeRenderer.pathland_tailwind_compile(null, overrideCss == null ? "" : overrideCss,
                classes == null ? "" : classes);
        return take(result);
    }

    /** Copy a NUL-terminated C string into a Java String and free the native buffer. */
    private static String take(Pointer ptr) {
        if (ptr == null) {
            return "";
        }
        try {
            return ptr.getString(0);
        } finally {
            nativeFree(ptr);
        }
    }

    private static void nativeFree(Pointer ptr) {
        // Resolve through the holder to avoid re-initializing on the free path.
        try {
            Holder.INSTANCE.nativeRenderer.pathland_html_free(ptr);
        } catch (Throwable ignored) {
            // best-effort; the buffer is transient
        }
    }
}