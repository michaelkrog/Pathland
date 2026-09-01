//! Tailwind (v4) class emission + static safelist derivation.
//!
//! Only the **finite, protocol-enum-derived** surface maps to Tailwind utility
//! classes: alignment, text alignment/case, stack direction, grid columns, and
//! the fixed booleans (hidden, underline, truncate, …). **Arbitrary-number (dp)
//! styling** — spacing, padding, size, offset, rotation, filters, opacity, etc. —
//! renders **inline** (see `style_css` in lib.rs), so it produces no class and no
//! CSS. This keeps the safelist a complete, static set compiled once at startup.
//!
//! The class set is generated **from this table**, so emission and the
//! `@source inline(...)` safelist can never drift.

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

/// A `WIDTH`/`HEIGHT` hint as a Tailwind width/height class. Only the fixed
/// sentinel values map to classes; arbitrary numeric sizes render inline (dp).
fn size_class(v: f32) -> &'static str {
    if v == pathland_core::size::FILL {
        "full"
    } else if v == pathland_core::size::HUG_CONTENT {
        "fit"
    } else {
        ""
    }
}

pub(crate) fn stack_classes(direction: &str, alignment: u8) -> String {
    let mut classes = String::from("flex ");
    classes.push_str(if direction == "column" { "flex-col" } else { "flex-row" });
    let items = align_items(alignment);
    if !items.is_empty() {
        classes.push(' ');
        classes.push_str(items);
    }
    classes.trim().to_string()
}

pub(crate) fn grid_classes(columns: Option<u32>, horizontal: bool) -> String {
    let mut classes = String::from("grid");
    if let Some(n) = columns {
        classes.push(' ');
        classes.push_str(&format!("grid-cols-{n}"));
    }
    if horizontal {
        classes.push_str(" grid-flow-col");
    }
    classes
}

/// Padding/content-margins now render inline (arbitrary dp values); no Tailwind
/// class is produced here.
pub(crate) fn padding_classes(_padding: Option<f32>, _edges: &[(u16, f32)], _margins: Option<f32>) -> String {
    String::new()
}

/// Size classes from WIDTH / HEIGHT hints — only the FILL/HUG sentinels map to
/// Tailwind classes; arbitrary numeric sizes render inline.
pub(crate) fn size_classes(width: Option<f32>, height: Option<f32>) -> String {
    let mut classes = Vec::new();
    if let Some(w) = width {
        let c = size_class(w);
        if !c.is_empty() {
            classes.push(format!("w-{c}"));
        }
    }
    if let Some(h) = height {
        let c = size_class(h);
        if !c.is_empty() {
            classes.push(format!("h-{c}"));
        }
    }
    classes.join(" ")
}

/// Visibility + fixed structural classes. z-index, opacity, and position x/y
/// render inline (arbitrary dp); only `hidden` and `absolute` stay as classes.
pub(crate) fn structural_classes(visible: bool, positioned: bool) -> String {
    let mut classes = Vec::new();
    if !visible {
        classes.push("hidden".to_string());
    }
    if positioned {
        classes.push("absolute".to_string());
    }
    classes.join(" ")
}

/// The structural Tailwind classes the renderer can emit — the exact set the
/// safelist must force in (`@source inline(...)` brace-expansions).
/// Decorative / typography properties, mapped to Tailwind utility classes
/// (Phase 2). Literal-color and string-typed properties (color, background,
/// border width/color, shadows, font family) stay inline in the renderer.
/// The finite, protocol-enum-derived typography/decor properties that map to
/// Tailwind classes. Arbitrary-number props (font size/weight, radius, filters,
/// rotation, scale, offset, line-clamp count) render inline and are not here.
#[derive(Debug, Default, Clone, Copy)]
pub(crate) struct Decor {
    pub italic: bool,
    pub font_design: Option<u8>,
    pub text_align: Option<u8>,
    pub truncate: bool,
    pub text_case: Option<u8>,
    pub underline: bool,
    pub strikethrough: bool,
    pub clips_to_bounds: bool,
    pub allows_hit_testing: bool,
    pub invert: bool,
}

pub(crate) fn decor_classes(d: &Decor) -> String {
    let mut classes: Vec<String> = Vec::new();
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
    if d.invert {
        classes.push("invert".to_string());
    }
    // Numeric/arbitrary decorative props (font size/weight, radius, blur, filters,
    // rotate, scale, offset, line-clamp count) render inline (dp); only the finite
    // enum/bool surface above maps to Tailwind classes.
    classes.join(" ")
}

/// The Tailwind classes the renderer can emit — a **complete, static set** derived
/// only from what the protocol can produce via enums and naturally-bounded values.
/// Arbitrary-number (dp) styling renders **inline**, so it contributes no class and
/// no CSS. This set is compiled once at startup and never changes.
#[allow(dead_code)]
pub(crate) fn safelist() -> String {
    let mut classes: Vec<String> = [
        // Layout / stacks
        "flex", "flex-col", "flex-row", "grid", "grid-flow-col",
        "items-start", "items-center", "items-end", "items-stretch",
        "flex-1", "w-full", "w-fit", "h-full", "h-fit",
        "relative", "absolute", "inset-0", "hidden", "overflow-auto",
        // Typography / text
        "italic", "text-left", "text-center", "text-right", "truncate",
        "uppercase", "lowercase", "underline", "line-through",
        "font-serif", "font-sans", "font-mono",
        // Effects / interaction
        "overflow-hidden", "pointer-events-none", "invert",
    ]
    .into_iter()
    .map(str::to_owned)
    .collect();
    // Naturally-bounded range: grid column counts.
    for n in 1..=24 {
        classes.push(format!("grid-cols-{n}"));
    }
    classes.join(" ")
}
