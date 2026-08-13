//! # pathland-layout
//!
//! Minimal layout engine for the Pathland core components. Computes node
//! origins and sizes and emits `LAYOUT_SET_ORIGIN` / `LAYOUT_SET_SIZE` opcodes
//! into the 16-byte ring buffer via a `Guest`.
//!
//! The layout pass performs **zero dynamic heap allocations**: it walks an
//! existing tree with pure `measure`/`place` recursion and writes opcodes
//! straight into the ring. Tree construction (allocating nodes) is separate
//! from layout.
//!
//! ## SwiftUI-like API
//!
//! Trees are built with the `view` module helpers (`vstack`, `hstack`, `text`,
//! `spacer`), which mirror the Goal 2 component DSL. This crate only needs the
//! *structure* to lay out.

#![no_std]
#![forbid(unsafe_op_in_unsafe_fn)]

#[cfg(test)]
extern crate std;

extern crate alloc;

use alloc::string::String;
use alloc::vec::Vec;

use pathland_opcode::component_type;
use pathland_opcode::Guest;

pub use pathland_opcode;

/// A node in the layout tree.
#[derive(Clone, PartialEq)]
pub struct Node {
    /// Stable node id (the root may be 0).
    pub id: u32,
    pub component: Component,
    pub children: Vec<Node>,
    /// Fixed/modifier width or `None` (resolved during layout).
    pub width: Option<f32>,
    /// Fixed/modifier height or `None` (resolved during layout).
    pub height: Option<f32>,
}

impl core::fmt::Debug for Node {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.debug_struct("Node")
            .field("id", &self.id)
            .field("component", &self.component)
            .field("children", &self.children)
            .field("width", &self.width)
            .field("height", &self.height)
            .finish()
    }
}

/// Core component types supported by the layout engine.
#[derive(Clone, PartialEq)]
pub enum Component {
    /// Vertical stack: children laid out top-to-bottom.
    VStack { spacing: f32, padding: f32 },
    /// Horizontal stack: children laid out left-to-right.
    HStack { spacing: f32, padding: f32 },
    /// Text leaf with an intrinsic measured size.
    Text { text: String },
    /// Spacer: fills remaining main-axis space.
    Spacer,
}

impl core::fmt::Debug for Component {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            Component::VStack { spacing, padding } => f
                .debug_struct("VStack")
                .field("spacing", spacing)
                .field("padding", padding)
                .finish(),
            Component::HStack { spacing, padding } => f
                .debug_struct("HStack")
                .field("spacing", spacing)
                .field("padding", padding)
                .finish(),
            Component::Text { text } => f.debug_tuple("Text").field(text).finish(),
            Component::Spacer => f.write_str("Spacer"),
        }
    }
}

/// A measured/placed rectangle.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Rect {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

impl Rect {
    #[inline]
    pub fn new(x: f32, y: f32, width: f32, height: f32) -> Self {
        Self {
            x,
            y,
            width,
            height,
        }
    }
}

/// Result of a layout pass.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct LayoutResult {
    /// Number of opcodes emitted (2 per laid-out node).
    pub opcodes: usize,
    /// Nodes whose requested size exceeded the available space (clamped).
    pub clamped: usize,
}

/// The zero-alloc layout engine.
pub struct LayoutEngine;

impl LayoutEngine {
    /// Lay out `root` within `bounds`, emitting LAYOUT opcodes into `guest`.
    pub fn layout(
        root: &Node,
        bounds: Rect,
        guest: &mut Guest<'_>,
    ) -> Result<LayoutResult, pathland_opcode::RingError> {
        let mut ctx = Ctx {
            guest,
            opcodes: 0,
            clamped: 0,
        };
        let (w, h) = ctx.measure(root, bounds.width, bounds.height);
        // The root fills its container unless it has an explicit size modifier.
        let w = match root.width {
            Some(v) => resolve(Some(v), w, bounds.width, &mut ctx.clamped),
            None => bounds.width,
        };
        let h = match root.height {
            Some(v) => resolve(Some(v), h, bounds.height, &mut ctx.clamped),
            None => bounds.height,
        };
        ctx.place(root, bounds.x, bounds.y, w, h)?;
        Ok(LayoutResult {
            opcodes: ctx.opcodes,
            clamped: ctx.clamped,
        })
    }
}

struct Ctx<'a, 'b> {
    guest: &'a mut Guest<'b>,
    opcodes: usize,
    clamped: usize,
}

enum Axis {
    Horizontal,
    Vertical,
}

impl<'a, 'b> Ctx<'a, 'b> {
    /// Pure measurement: returns `(width, height)` for `node` given available
    /// space. No opcodes emitted, no allocation.
    fn measure(&self, node: &Node, avail_w: f32, avail_h: f32) -> (f32, f32) {
        match &node.component {
            Component::Text { text } => text_size(text, avail_w),
            Component::Spacer => (0.0, 0.0),
            Component::VStack { spacing, padding } | Component::HStack { spacing, padding } => {
                self.measure_stack(node, *spacing, *padding, avail_w, avail_h)
            }
        }
    }

    fn axis(&self, node: &Node) -> Axis {
        match node.component {
            Component::HStack { .. } => Axis::Horizontal,
            _ => Axis::Vertical,
        }
    }

    fn measure_stack(
        &self,
        node: &Node,
        spacing: f32,
        padding: f32,
        avail_w: f32,
        avail_h: f32,
    ) -> (f32, f32) {
        let horizontal = matches!(self.axis(node), Axis::Horizontal);
        let inner_w = (avail_w - 2.0 * padding).max(0.0);
        let inner_h = (avail_h - 2.0 * padding).max(0.0);

        let mut main_extent = 0.0f32;
        let mut cross_extent = 0.0f32;
        let mut count = 0usize;
        for child in &node.children {
            let (w, h) = self.measure(child, inner_w, inner_h);
            count += 1;
            if horizontal {
                main_extent += w;
                cross_extent = cross_extent.max(h);
            } else {
                main_extent += h;
                cross_extent = cross_extent.max(w);
            }
        }
        let gaps = if count > 1 { spacing * (count - 1) as f32 } else { 0.0 };
        let main = (main_extent + gaps).max(0.0) + 2.0 * padding;
        let cross = cross_extent.max(0.0) + 2.0 * padding;
        (main, cross)
    }

    /// Place `node` at `(x, y)` with the resolved `(w, h)`, emitting opcodes
    /// and recursing. Returns the rect placed.
    fn place(&mut self, node: &Node, x: f32, y: f32, w: f32, h: f32) -> Result<Rect, pathland_opcode::RingError> {
        self.guest.set_origin(node.id, x, y)?;
        self.guest.set_size(node.id, w, h)?;
        self.opcodes += 2;

        if let Component::VStack { spacing, padding } | Component::HStack { spacing, padding } =
            &node.component
        {
            self.place_children(node, *spacing, *padding, x, y, w, h)?;
        }
        Ok(Rect::new(x, y, w, h))
    }

    fn place_children(
        &mut self,
        node: &Node,
        spacing: f32,
        padding: f32,
        x: f32,
        y: f32,
        w: f32,
        h: f32,
    ) -> Result<(), pathland_opcode::RingError> {
        let horizontal = matches!(self.axis(node), Axis::Horizontal);
        let inner_x = x + padding;
        let inner_y = y + padding;
        let inner_w = (w - 2.0 * padding).max(0.0);
        let inner_h = (h - 2.0 * padding).max(0.0);

        // Pass 1: measure fixed children; compute fill share.
        let mut fixed_main = 0.0f32;
        let mut fill_count = 0usize;
        let mut count = 0usize;
        for child in &node.children {
            count += 1;
            if matches!(child.component, Component::Spacer) {
                fill_count += 1;
                continue;
            }
            let (cw, ch) = self.measure(child, inner_w, inner_h);
            if horizontal {
                fixed_main += cw;
            } else {
                fixed_main += ch;
            }
        }
        let gaps = if count > 1 { spacing * (count - 1) as f32 } else { 0.0 };
        let available_main = if horizontal { inner_w } else { inner_h };
        let remaining = (available_main - fixed_main - gaps).max(0.0);
        let fill_share = if fill_count > 0 {
            remaining / fill_count as f32
        } else {
            0.0
        };

        // Pass 2: place children along the main axis.
        let mut cursor = 0.0f32;
        for child in &node.children {
            if matches!(child.component, Component::Spacer) {
                // Cross-extent for the spacer is the full inner cross space.
                if horizontal {
                    let cw = fill_share;
                    let ch = inner_h;
                    let pos = inner_x + cursor;
                    let _ = self.place(child, pos, inner_y, cw, ch)?;
                    cursor += cw + spacing;
                } else {
                    let cw = inner_w;
                    let ch = fill_share;
                    let pos = inner_y + cursor;
                    let _ = self.place(child, inner_x, pos, cw, ch)?;
                    cursor += ch + spacing;
                }
                continue;
            }
            let (cw, ch) = self.measure(child, inner_w, inner_h);
            if horizontal {
                let _ = self.place(child, inner_x + cursor, inner_y, cw, ch)?;
                cursor += cw + spacing;
            } else {
                let _ = self.place(child, inner_x, inner_y + cursor, cw, ch)?;
                cursor += ch + spacing;
            }
        }
        Ok(())
    }
}

/// Resolve a requested length: `None` → measured, negative → fill, else fixed.
fn resolve(requested: Option<f32>, measured: f32, available: f32, clamped: &mut usize) -> f32 {
    match requested {
        None => measured,
        Some(v) if v < 0.0 => available,
        Some(v) => {
            if v > available && available > 0.0 {
                *clamped += 1;
            }
            v
        }
    }
}

/// Intrinsic text size. The POC approximates: 8×16 px per character cell,
/// wrapping to `max_chars` columns when `available_w` is finite.
fn text_size(text: &str, available_w: f32) -> (f32, f32) {
    if text.is_empty() {
        return (0.0, 16.0);
    }
    let char_w = 8.0f32;
    let line_h = 16.0f32;
    let max_chars = if available_w > 0.0 && available_w < f32::MAX {
        let cols = (available_w / char_w) as usize;
        if cols < 1 {
            1
        } else {
            cols
        }
    } else {
        usize::MAX
    };
    let mut lines = 0usize;
    let mut width = 0.0f32;
    for line in text.split('\n') {
        let cols = line.chars().count();
        let wrapped = cols / max_chars + usize::from(cols % max_chars != 0);
        let wrapped = if wrapped < 1 { 1 } else { wrapped };
        lines += wrapped;
        width = if cols as f32 * char_w > width {
            cols as f32 * char_w
        } else {
            width
        };
    }
    (width, lines as f32 * line_h)
}

/// Map a component to its protocol component type id.
pub fn component_type_id(component: &Component) -> u16 {
    match component {
        Component::VStack { .. } => component_type::VSTACK,
        Component::HStack { .. } => component_type::HSTACK,
        Component::Text { .. } => component_type::TEXT,
        Component::Spacer => component_type::SPACER,
    }
}

/// SwiftUI-style tree builders (skeleton for Goal 2).
pub mod view {
    use super::*;

    pub fn vstack(spacing: f32, padding: f32, children: Vec<Node>) -> Node {
        Node {
            id: 0,
            component: Component::VStack { spacing, padding },
            children,
            width: None,
            height: None,
        }
    }

    pub fn hstack(spacing: f32, padding: f32, children: Vec<Node>) -> Node {
        Node {
            id: 0,
            component: Component::HStack { spacing, padding },
            children,
            width: None,
            height: None,
        }
    }

    pub fn text(id: u32, text: &str) -> Node {
        Node {
            id,
            component: Component::Text { text: text.into() },
            children: Vec::new(),
            width: None,
            height: None,
        }
    }

    pub fn spacer(id: u32) -> Node {
        Node {
            id,
            component: Component::Spacer,
            children: Vec::new(),
            width: None,
            height: None,
        }
    }

    /// Assign stable unique sequential ids to a tree (pre-order; root first).
    pub fn assign_ids(root: &mut Node, next: &mut u32) {
        root.id = *next;
        *next += 1;
        for child in &mut root.children {
            assign_ids(child, next);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use pathland_opcode::{category, init_memory, layout, Host, MemoryLayout};
    use alloc::vec;

    fn with_guest() -> (Vec<u8>, MemoryLayout) {
        let layout = MemoryLayout::default();
        let mut mem = vec![0u8; layout.total_bytes()];
        init_memory(&mut mem, &layout);
        (mem, layout)
    }

    fn collect_layout_ops(
        root: &Node,
        bounds: Rect,
    ) -> (Vec<u8>, MemoryLayout, Vec<pathland_opcode::Opcode>) {
        let (mut mem, layout) = with_guest();
        let mut guest = Guest::new(&mut mem, &layout);
        guest.begin_frame();
        LayoutEngine::layout(root, bounds, &mut guest).unwrap();
        guest.end_frame();
        drop(guest);
        let mut host = Host::new(&mut mem, &layout);
        let ops: Vec<pathland_opcode::Opcode> = host.frames()[0].opcodes().collect();
        (mem, layout, ops)
    }

    fn find<'a>(
        ops: &'a [pathland_opcode::Opcode],
        id: u32,
        cmd: u8,
    ) -> &'a pathland_opcode::Opcode {
        ops.iter()
            .find(|o| {
                o.category() == category::LAYOUT
                    && o.command() == cmd
                    && o.a() == id
            })
            .expect("opcode not found")
    }

    #[test]
    fn vstack_bounds_are_correct() {
        let mut root = view::vstack(
            4.0,
            8.0,
            vec![view::text(1, "ab"), view::text(2, "cd")],
        );
        let mut next = 1;
        view::assign_ids(&mut root, &mut next);
        let (_mem, _layout, ops) = collect_layout_ops(&root, Rect::new(0.0, 0.0, 100.0, 100.0));

        // Text "ab" (id 2) origin: padding 8,8; size 16x16.
        let o1 = find(&ops, 2, layout::SET_ORIGIN);
        assert_eq!(o1.b_f32(), 8.0);
        assert_eq!(o1.c_f32(), 8.0);
        let s1 = find(&ops, 2, layout::SET_SIZE);
        assert_eq!(s1.b_f32(), 16.0);
        assert_eq!(s1.c_f32(), 16.0);

        // Text "cd" (id 3) origin: y = 8 + 16 + spacing 4 = 28.
        let o2 = find(&ops, 3, layout::SET_ORIGIN);
        assert_eq!(o2.b_f32(), 8.0);
        assert_eq!(o2.c_f32(), 28.0);
    }

    #[test]
    fn hstack_with_spacer_fills() {
        let mut root = view::hstack(0.0, 0.0, vec![view::text(1, "x"), view::spacer(2)]);
        let mut next = 1;
        view::assign_ids(&mut root, &mut next);
        let (_mem, _layout, ops) = collect_layout_ops(&root, Rect::new(0.0, 0.0, 100.0, 50.0));

        // Spacer (id 3) starts after the text (id 2, "x" = 8px wide) at x=8,
        // fills to 92px.
        let spacer_origin = find(&ops, 3, layout::SET_ORIGIN);
        let spacer_size = find(&ops, 3, layout::SET_SIZE);
        assert_eq!(spacer_origin.b_f32(), 8.0);
        assert_eq!(spacer_size.b_f32(), 92.0);
    }

    #[test]
    fn layout_is_zero_alloc() {
        use std::alloc::{GlobalAlloc, Layout as AllocLayout};
        use std::cell::Cell;
        use std::thread_local;

        thread_local! {
            static COUNT: Cell<usize> = const { Cell::new(0) };
        }
        struct Counting;
        unsafe impl GlobalAlloc for Counting {
            unsafe fn alloc(&self, l: AllocLayout) -> *mut u8 {
                COUNT.with(|c| c.set(c.get() + 1));
                // SAFETY: forward to the system allocator.
                unsafe { std::alloc::System.alloc(l) }
            }
            unsafe fn dealloc(&self, p: *mut u8, l: AllocLayout) {
                // SAFETY: forward to the system allocator.
                unsafe { std::alloc::System.dealloc(p, l) }
            }
        }
        #[global_allocator]
        static A: Counting = Counting;

        // Build the tree (allocations allowed here) before counting.
        let (mut mem, layout) = with_guest();
        let mut root = view::vstack(
            4.0,
            8.0,
            vec![
                view::text(1, "one"),
                view::text(2, "two"),
                view::text(3, "three"),
            ],
        );
        let mut next = 1;
        view::assign_ids(&mut root, &mut next);

        COUNT.with(|c| c.set(0));
        let mut guest = Guest::new(&mut mem, &layout);
        guest.begin_frame();
        LayoutEngine::layout(&root, Rect::new(0.0, 0.0, 100.0, 100.0), &mut guest).unwrap();
        guest.end_frame();
        COUNT.with(|c| {
            assert_eq!(c.get(), 0, "layout must not allocate");
        });
    }
}
