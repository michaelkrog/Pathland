//! C ABI for the Pathland GTK renderer (Java host).
//!
//! A foreign host (Java via JNA) drives the `pathland-native` flat world to
//! build/emit the retained tree, then calls `pathland_gtk_run` to hand the
//! renderer its shared ring and run GTK in-process. Raw-input events are
//! reported back through a C callback (`void (*)(u32 targetId)`).

use std::cell::RefCell;
use std::ffi::c_void;
use std::rc::Rc;

use pathland_native::NativeHost;
use pathland_opcode::Event;
use pathland_transport::{DriverTransport, FrameSource, OpcodeBatch, TransportError};

use crate::{run_with_pump, Pump};

/// A host-supplied event callback: invoked with the activated node id.
pub type EventCallback = extern "C" fn(target_id: u32);

/// A `Pump` over a `pathland-native` `NativeHost` owned by the foreign host.
///
/// The renderer borrows the host through a raw pointer for the duration of
/// `pathland_gtk_run`; the foreign host keeps driving the same host (via its
/// own handle) from the event callback. All access is on the GTK main thread.
struct NativeHostHandle(*mut NativeHost);

impl Pump for NativeHostHandle {
    fn next_frame(&mut self) -> Result<Option<OpcodeBatch<'_>>, TransportError> {
        // SAFETY: single-threaded (GTK main thread); the foreign host must not
        // destroy the host until `pathland_gtk_run` returns.
        unsafe { FrameSource::next_frame(&mut *self.0) }
    }

    fn send_input(&mut self, event: &Event) -> Result<(), TransportError> {
        // SAFETY: as above.
        unsafe { DriverTransport::send_input(&mut *self.0, event) }
    }

    fn drain_events(&mut self) -> Vec<Event> {
        // SAFETY: as above.
        unsafe { (&mut *self.0).drain_events() }
    }
}

/// Run the GTK renderer over a `pathland-native` host's shared ring.
///
/// `host` is the opaque handle from `pathland_native_create`; the renderer
/// pumps its ring in-process (frames in, events out). `on_event` is called
/// (on the GTK main thread) with the id of the activated node; it may re-enter
/// `pathland_native_*` to update the tree and re-emit.
///
/// This function blocks until the GTK main loop exits (window closed).
#[no_mangle]
pub unsafe extern "C" fn pathland_gtk_run(
    host: *mut c_void,
    on_event: Option<EventCallback>,
) {
    if host.is_null() {
        return;
    }

    let handle = NativeHostHandle(host as *mut NativeHost);
    let pump = Rc::new(RefCell::new(handle));

    // Pass a bare program name to GTK: the real process argv is the JVM's
    // (`-cp`/`-D` flags + main class), which GTK must not parse as its own
    // options. A single non-option argument avoids both the "unknown option"
    // error and the empty-argv activation quirk on macOS.
    run_with_pump(
        "org.pathland.GtkDemo",
        "Pathland GTK Demo",
        pump,
        &["GtkDemo"],
        move |event, _pump| {
            if let Some(cb) = on_event {
                if let Event::PointerUp { target, .. } = event {
                    cb(target);
                }
            }
        },
    );
}
