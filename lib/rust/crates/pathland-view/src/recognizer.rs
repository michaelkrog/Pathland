//! App-side gesture recognition over raw-input events.
//!
//! The protocol carries only raw inputs (`POINTER_DOWN` / `POINTER_UP` /
//! `POINTER_MOVE`, …). High-level interpretations — tap, drag, long-press — are
//! built by the application from those raw events. [`TapRecognizer`] is the
//! first such recognizer; more gestures can be added later.
//!
//! This module is `no_std`; time is supplied by the caller (`now_ms`) so the
//! recognizer stays independent of a platform clock.

use pathland_core::Event;

/// Recognizes a tap: a `POINTER_DOWN` followed by a `POINTER_UP` on the same
/// target, within a movement slop and a time window.
///
/// Feed events (and a monotonic timestamp in milliseconds) to [`feed`]; it
/// returns `Some(target)` when a tap completes. A `POINTER_MOVE` beyond the
/// slop, leaving the node, or a down/up pair on different targets cancels the
/// gesture.
///
/// [`feed`]: TapRecognizer::feed
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct TapRecognizer {
    down: Option<DownState>,
    /// Maximum travel (in logical points) from press to release before the
    /// gesture is cancelled.
    max_distance: f32,
    /// Maximum press-to-release duration in milliseconds.
    max_duration: u64,
}

#[derive(Debug, Clone, Copy, PartialEq)]
struct DownState {
    target: u32,
    x: f32,
    y: f32,
    time: u64,
}

impl Default for TapRecognizer {
    fn default() -> Self {
        Self::new()
    }
}

impl TapRecognizer {
    /// A recognizer with default limits (10 logical points, 500 ms).
    pub fn new() -> Self {
        Self {
            down: None,
            max_distance: 10.0,
            max_duration: 500,
        }
    }

    /// A recognizer with explicit limits.
    pub fn with_limits(max_distance: f32, max_duration_ms: u64) -> Self {
        Self {
            down: None,
            max_distance,
            max_duration: max_duration_ms,
        }
    }

    /// Feed one raw-input event; returns `Some(target)` when a tap completes.
    pub fn feed(&mut self, event: &Event, now_ms: u64) -> Option<u32> {
        match event {
            Event::PointerDown { target, x, y, .. } => {
                self.down = Some(DownState {
                    target: *target,
                    x: *x,
                    y: *y,
                    time: now_ms,
                });
                None
            }
            Event::PointerUp { target, x, y, .. } => {
                let mut tapped = None;
                if let Some(d) = self.down.take() {
                    if d.target == *target
                        && now_ms.saturating_sub(d.time) <= self.max_duration
                        && distance_sq(d.x, d.y, *x, *y) <= self.max_distance * self.max_distance
                    {
                        tapped = Some(*target);
                    }
                }
                tapped
            }
            Event::PointerMove {
                target,
                x,
                y,
                leaving,
                ..
            } => {
                if let Some(d) = self.down {
                    if *leaving
                        || *target != d.target
                        || distance_sq(d.x, d.y, *x, *y) > self.max_distance * self.max_distance
                    {
                        self.down = None;
                    }
                }
                None
            }
            _ => None,
        }
    }

    /// Cancel any in-progress gesture.
    pub fn reset(&mut self) {
        self.down = None;
    }
}

/// Squared Euclidean distance between two points (avoids `sqrt`, keeping the
/// module `no_std`-friendly).
fn distance_sq(x0: f32, y0: f32, x1: f32, y1: f32) -> f32 {
    let dx = x1 - x0;
    let dy = y1 - y0;
    dx * dx + dy * dy
}

#[cfg(test)]
mod tests {
    use super::*;

    fn down(target: u32, x: f32, y: f32) -> Event {
        Event::PointerDown {
            target,
            x,
            y,
            secondary: false,
        }
    }

    fn up(target: u32, x: f32, y: f32) -> Event {
        Event::PointerUp {
            target,
            x,
            y,
            secondary: false,
        }
    }

    fn move_to(target: u32, x: f32, y: f32) -> Event {
        Event::PointerMove {
            target,
            x,
            y,
            hovering: true,
            leaving: false,
        }
    }

    #[test]
    fn down_then_up_on_same_target_is_a_tap() {
        let mut r = TapRecognizer::new();
        assert_eq!(r.feed(&down(7, 0.0, 0.0), 100), None);
        assert_eq!(r.feed(&up(7, 2.0, 2.0), 200), Some(7));
    }

    #[test]
    fn up_on_different_target_is_not_a_tap() {
        let mut r = TapRecognizer::new();
        assert_eq!(r.feed(&down(7, 0.0, 0.0), 100), None);
        assert_eq!(r.feed(&up(8, 0.0, 0.0), 200), None);
    }

    #[test]
    fn up_without_down_is_not_a_tap() {
        let mut r = TapRecognizer::new();
        assert_eq!(r.feed(&up(7, 0.0, 0.0), 100), None);
    }

    #[test]
    fn move_beyond_slop_cancels() {
        let mut r = TapRecognizer::new();
        assert_eq!(r.feed(&down(7, 0.0, 0.0), 100), None);
        assert_eq!(r.feed(&move_to(7, 50.0, 50.0), 150), None);
        assert_eq!(r.feed(&up(7, 50.0, 50.0), 200), None);
    }

    #[test]
    fn leaving_cancels() {
        let mut r = TapRecognizer::new();
        assert_eq!(r.feed(&down(7, 0.0, 0.0), 100), None);
        let leave = Event::PointerMove {
            target: 7,
            x: 1.0,
            y: 1.0,
            hovering: false,
            leaving: true,
        };
        assert_eq!(r.feed(&leave, 150), None);
        assert_eq!(r.feed(&up(7, 1.0, 1.0), 200), None);
    }

    #[test]
    fn exceeds_duration_is_not_a_tap() {
        let mut r = TapRecognizer::new();
        assert_eq!(r.feed(&down(7, 0.0, 0.0), 100), None);
        assert_eq!(r.feed(&up(7, 0.0, 0.0), 700), None);
    }
}
