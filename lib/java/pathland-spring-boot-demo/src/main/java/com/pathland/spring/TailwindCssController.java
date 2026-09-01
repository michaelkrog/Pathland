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
        String compiled = HtmlRenderer.instance().compileTailwind("", safelist());
        this.css = compiled.startsWith("PATHLAND_TAILWIND_ERROR:")
                ? "/* Tailwind unavailable: " + compiled.substring("PATHLAND_TAILWIND_ERROR:".length()) + " */"
                : compiled;
    }

    /** The full structural + decorative class safelist the renderer can emit. */
    private static String safelist() {
        // Deliberately mirrors lib/rust crates/pathland-render-html/src/tw.rs.
        // The demo renders the kitchensink; the Renderer's safelist would be
        // exposed once a Rust -> Java bridge carries it. For now list the common set.
        return "flex flex-col flex-row gap-[12px] p-[8px] w-full w-fit h-full h-fit items-center items-start items-end "
                + "text-[18px] font-[700] rounded-[8px] blur-[3px] opacity-[0.5] hidden";
    }

    @GetMapping(value = "/tailwind.css", produces = "text/css")
    public ResponseEntity<String> css() {
        return ResponseEntity.ok().contentType(MediaType.valueOf("text/css")).body(css);
    }
}