package com.pathland.spring;

import com.pathland.render.html.HtmlRenderer;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Serves the compiled Tailwind CSS bundle at {@code /tailwind.css}. The CSS is
 * compiled once at startup from the Pathland default config + safelist (with an
 * empty developer override for the demo) via the Rust renderer's
 * {@code pathland_tailwind_compile}. If the embedded binary is unavailable the
 * response is a short explanatory error; the page still renders (unstyled).
 */
@Controller
public class TailwindCssController {

    private final String css;

    public TailwindCssController() {
        HtmlRenderer renderer = HtmlRenderer.tryInstance();
        if (renderer == null) {
            // Degrade gracefully: the app still boots; the page renders unstyled.
            this.css = "/* Pathland: native renderer unavailable. Build the Rust crate so "
                    + "libpathland_render_html is embedded in the pathland-render-html jar. */";
            return;
        }
        // The class safelist is owned internally by the Rust renderer.
        String compiled = renderer.compileTailwind("");
        this.css = compiled.startsWith("PATHLAND_TAILWIND_ERROR:")
                ? "/* Tailwind unavailable: " + compiled.substring("PATHLAND_TAILWIND_ERROR:".length()) + " */"
                : compiled;
    }

    @GetMapping(value = "/tailwind.css", produces = "text/css")
    public ResponseEntity<String> css() {
        return ResponseEntity.ok().contentType(MediaType.valueOf("text/css")).body(css);
    }
}