package com.pathland.quarkus;

import com.pathland.render.html.HtmlRenderer;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

/**
 * Serves the compiled Tailwind CSS bundle at {@code /tailwind.css}. Compiled once
 * at startup from the Pathland default config + demo safelist via the Rust
 * renderer's {@code pathland_tailwind_compile}.
 */
@Path("/tailwind.css")
public class TailwindCssResource {

    private final String css;

    public TailwindCssResource() {
        String compiled = HtmlRenderer.instance().compileTailwind("", safelist());
        this.css = compiled.startsWith("PATHLAND_TAILWIND_ERROR:")
                ? "/* Tailwind unavailable: " + compiled.substring("PATHLAND_TAILWIND_ERROR:".length()) + " */"
                : compiled;
    }

    private static String safelist() {
        return "flex flex-col flex-row gap-[12px] p-[8px] w-full w-fit h-full h-fit items-center items-start items-end "
                + "text-[18px] font-[700] rounded-[8px] blur-[3px] opacity-[0.5] hidden";
    }

    @GET
    @Produces("text/css")
    public String css() {
        return css;
    }
}