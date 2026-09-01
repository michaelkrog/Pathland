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
    classes.join(" ")
}
