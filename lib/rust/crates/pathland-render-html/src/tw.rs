//! Tailwind (v4) structural class emission + safelist derivation.
//!
//! Phase 1 converts the **structural** surface (stacks, padding, size, spacer,
//! scroll, grid, z-index, opacity, visibility, position/offset) to Tailwind
//! utility classes; decorative/typography properties (color, background, fonts,
//! borders, shadows, effects, text layout) stay inline in this phase and move to
//! classes in Phase 2.
//!
//! The class set is generated **from this table**, so emission and the
//! `@source inline(...)` safelist can never drift: the renderer emits whatever
//! the table produces, and the safelist lists exactly that.

/// A spacing value rendered as an arbitrary Tailwind length, e.g. `gap-[13px]`.
fn px(value: f32) -> String {
    format!("[{value}px]")
}

/// Cross-axis alignment class from the `ALIGNMENT` enum (Leading=0, Center=1,
/// Trailing=2, Fill=3; default Fill → stretch, which is the CSS default and so
/// emits no class).
fn align_items(alignment: u8) -> &'static str {
    match alignment {
        0 => "items-start",
        1 => "items-center",
        2 => "items-end",
        _ => "",
    }
}

/// A `WIDTH`/`HEIGHT` hint as a Tailwind width/height class.
fn size_class(v: f32) -> String {
    if v == pathland_core::size::FILL {
        "full".to_string()
    } else if v == pathland_core::size::HUG_CONTENT {
        "fit".to_string()
    } else {
        px(v)
    }
}

pub(crate) fn stack_classes(direction: &str, alignment: u8, gap: Option<f32>) -> String {
    let mut classes = String::from("flex ");
    classes.push_str(if direction == "column" { "flex-col" } else { "flex-row" });
    let items = align_items(alignment);
    if !items.is_empty() {
        classes.push(' ');
        classes.push_str(items);
    }
    if let Some(g) = gap {
        if g > 0.0 {
            classes.push(' ');
            classes.push_str(&format!("gap-{}", px(g)));
        }
    }
    classes.trim().to_string()
}

pub(crate) fn grid_classes(columns: Option<u32>, gap: Option<f32>, horizontal: bool) -> String {
    let mut classes = String::from("grid");
    if let Some(n) = columns {
        classes.push(' ');
        classes.push_str(&format!("grid-cols-{n}"));
    }
    if horizontal {
        classes.push_str(" grid-flow-col");
    }
    if let Some(g) = gap {
        if g > 0.0 {
            classes.push(' ');
            classes.push_str(&format!("gap-{}", px(g)));
        }
    }
    classes
}

/// Padding classes from the node's PADDING / per-edge / CONTENT_MARGINS props.
pub(crate) fn padding_classes(padding: Option<f32>, edges: &[(u16, f32)], margins: Option<f32>) -> String {
    let mut classes = Vec::new();
    if let Some(m) = margins {
        if m > 0.0 {
            classes.push(format!("p-{}", px(m)));
        }
    }
    if let Some(p) = padding {
        if p > 0.0 {
            classes.push(format!("p-{}", px(p)));
        }
    }
    for (side, v) in edges {
        if *v > 0.0 {
            let token = match *side {
                0 => "pt",
                1 => "pr",
                2 => "pb",
                _ => "pl",
            };
            classes.push(format!("{token}-{}", px(*v)));
        }
    }
    classes.join(" ")
}

/// Size classes from WIDTH / HEIGHT hints.
pub(crate) fn size_classes(width: Option<f32>, height: Option<f32>) -> String {
    let mut classes = Vec::new();
    if let Some(w) = width {
        classes.push(format!("w-{}", size_class(w)));
    }
    if let Some(h) = height {
        classes.push(format!("h-{}", size_class(h)));
    }
    classes.join(" ")
}

/// Appearance/structural classes that Phase 1 moves to Tailwind: z-index,
/// opacity, visibility, position/offset.
pub(crate) fn structural_classes(
    z_index: Option<i32>,
    opacity: Option<f32>,
    visible: bool,
    position: Option<(f32, f32)>,
) -> String {
    let mut classes = Vec::new();
    if let Some(z) = z_index {
        if z != 0 {
            classes.push(format!("z-[{z}]"));
        }
    }
    if let Some(o) = opacity {
        if o < 1.0 {
            classes.push(format!("opacity-[{o}]"));
        }
    }
    if !visible {
        classes.push("hidden".to_string());
    }
    if let Some((x, y)) = position {
        classes.push("absolute".to_string());
        if x != 0.0 {
            classes.push(format!("left-{}", px(x)));
        }
        if y != 0.0 {
            classes.push(format!("top-{}", px(y)));
        }
    }
    classes.join(" ")
}

/// The structural Tailwind classes the renderer can emit — the exact set the
/// safelist must force in (`@source inline(...)` brace-expansions).
/// Decorative / typography properties, mapped to Tailwind utility classes
/// (Phase 2). Literal-color and string-typed properties (color, background,
/// border width/color, shadows, font family) stay inline in the renderer.
#[derive(Debug, Default, Clone, Copy)]
pub(crate) struct Decor {
    pub font_size: Option<f32>,
    pub font_weight: Option<f32>,
    pub italic: bool,
    pub font_design: Option<u8>,
    pub text_align: Option<u8>,
    pub line_limit: Option<u32>,
    pub truncate: bool,
    pub text_case: Option<u8>,
    pub underline: bool,
    pub strikethrough: bool,
    pub clips_to_bounds: bool,
    pub allows_hit_testing: bool,
    pub border_radius: Option<f32>,
    pub blur: Option<f32>,
    pub saturate: Option<f32>,
    pub contrast: Option<f32>,
    pub brightness: Option<f32>,
    pub grayscale: Option<f32>,
    pub hue_rotate: Option<f32>,
    pub invert: bool,
    pub rotate: Option<f32>,
    pub scale: Option<f32>,
    pub offset: Option<(f32, f32)>,
}

pub(crate) fn decor_classes(d: &Decor) -> String {
    let mut classes: Vec<String> = Vec::new();
    if let Some(v) = d.font_size {
        if v > 0.0 {
            classes.push(format!("text-[{v}px]"));
        }
    }
    if let Some(v) = d.font_weight {
        if v > 0.0 {
            classes.push(format!("font-[{v}]"));
        }
    }
    if d.italic {
        classes.push("italic".to_string());
    }
    if let Some(v) = d.font_design {
        let design = match v {
            1 => "font-serif",
            2 => "font-sans",
            3 => "font-mono",
            _ => "",
        };
        if !design.is_empty() {
            classes.push(design.to_string());
        }
    }
    if let Some(v) = d.text_align {
        let align = match v.min(2) {
            0 => "text-left",
            1 => "text-center",
            _ => "text-right",
        };
        classes.push(align.to_string());
    }
    if let Some(n) = d.line_limit {
        if n > 0 {
            classes.push(format!("line-clamp-{n}"));
        }
    }
    if d.truncate {
        classes.push("truncate".to_string());
    }
    if let Some(v) = d.text_case {
        match v {
            1 => classes.push("uppercase".to_string()),
            2 => classes.push("lowercase".to_string()),
            _ => {}
        }
    }
    if d.underline {
        classes.push("underline".to_string());
    }
    if d.strikethrough {
        classes.push("line-through".to_string());
    }
    if d.clips_to_bounds {
        classes.push("overflow-hidden".to_string());
    }
    if !d.allows_hit_testing {
        classes.push("pointer-events-none".to_string());
    }
    if let Some(v) = d.border_radius {
        if v != 0.0 {
            classes.push(format!("rounded-[{v}px]"));
        }
    }
    if let Some(v) = d.blur {
        classes.push(format!("blur-[{v}px]"));
    }
    if let Some(v) = d.saturate {
        classes.push(format!("saturate-[{v}]"));
    }
    if let Some(v) = d.contrast {
        classes.push(format!("contrast-[{v}]"));
    }
    if let Some(v) = d.brightness {
        classes.push(format!("brightness-[{v}]"));
    }
    if let Some(v) = d.grayscale {
        classes.push(format!("grayscale-[{v}]"));
    }
    if let Some(v) = d.hue_rotate {
        classes.push(format!("hue-rotate-[{v}deg]"));
    }
    if d.invert {
        classes.push("invert".to_string());
    }
    if let Some(v) = d.rotate {
        if v != 0.0 {
            classes.push(format!("rotate-[{v}deg]"));
        }
    }
    if let Some(v) = d.scale {
        if v != 1.0 {
            classes.push(format!("scale-[{v}]"));
        }
    }
    if let Some((x, y)) = d.offset {
        if x != 0.0 {
            classes.push(format!("translate-x-[{x}px]"));
        }
        if y != 0.0 {
            classes.push(format!("translate-y-[{y}px]"));
        }
    }
    classes.join(" ")
}

/// The structural + decorative Tailwind classes the renderer can emit — the
/// exact set the safelist must force in (`@source inline(...)` brace-expansions).
/// Wired into the compiler input in Phase 3 (compile-at-startup).
#[allow(dead_code)]
pub(crate) fn safelist() -> String {
    let mut classes: Vec<String> = [
        "flex",
        "flex-col",
        "flex-row",
        "grid",
        "grid-flow-col",
        "items-start",
        "items-center",
        "items-end",
        "items-stretch",
        "w-full",
        "w-fit",
        "h-full",
        "h-fit",
        "flex-1",
        "hidden",
        "overflow-auto",
        "absolute",
        "relative",
        "inset-0",
    ]
    .into_iter()
    .map(str::to_owned)
    .collect();
    // Arbitrary-value lengths that can be emitted: paddings, gaps, sizes,
    // left/top offsets. Listed explicitly so the safelist matches emission.
    // Widths/heights span common fixed sizes (up to 2048px); paddings/gaps/
    // offsets stay in a tight layout range.
    for n in 1..=120 {
        classes.push(format!("p-[{n}px]"));
        classes.push(format!("pt-[{n}px]"));
        classes.push(format!("pr-[{n}px]"));
        classes.push(format!("pb-[{n}px]"));
        classes.push(format!("pl-[{n}px]"));
        classes.push(format!("gap-[{n}px]"));
        classes.push(format!("left-[{n}px]"));
        classes.push(format!("top-[{n}px]"));
    }
    for n in 1..=2048 {
        classes.push(format!("w-[{n}px]"));
        classes.push(format!("h-[{n}px]"));
    }
    for n in 1..=24 {
        classes.push(format!("grid-cols-{n}"));
        classes.push(format!("z-[{n}]"));
    }
    for o in (1..=99).map(|x| x as f32 / 10.0) {
        classes.push(format!("opacity-[{o}]"));
    }
    // Decorative / typography (Phase 2).
    classes.extend(["italic", "text-left", "text-center", "text-right", "truncate",
        "uppercase", "lowercase", "underline", "line-through", "overflow-hidden",
        "pointer-events-none", "invert", "font-serif", "font-sans", "font-mono"]
        .into_iter().map(str::to_owned));
    for n in 1..=100 {
        classes.push(format!("text-[{n}px]"));
        classes.push(format!("rounded-[{n}px]"));
        classes.push(format!("blur-[{n}px]"));
    }
    for n in (100..=900).step_by(100) {
        classes.push(format!("font-[{n}]"));
    }
    for n in 1..=12 {
        classes.push(format!("line-clamp-{n}"));
    }
    for n in (1..=99).map(|x| x as f32 / 10.0) {
        classes.push(format!("saturate-[{n}]"));
        classes.push(format!("contrast-[{n}]"));
        classes.push(format!("brightness-[{n}]"));
        classes.push(format!("grayscale-[{n}]"));
        classes.push(format!("scale-[{n}]"));
    }
    for n in 1..=360 {
        classes.push(format!("rotate-[{n}deg]"));
        classes.push(format!("hue-rotate-[{n}deg]"));
    }
    for n in 1..=2048 {
        classes.push(format!("translate-x-[{n}px]"));
        classes.push(format!("translate-y-[{n}px]"));
    }
    classes.join(" ")
}
