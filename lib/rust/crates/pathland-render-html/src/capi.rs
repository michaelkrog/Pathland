//! Flat C ABI (`pathland_html_*`) — the cross-language host surface for the
//! HTML renderer. Every function is a pure function of a self-contained PLPL
//! batch: it parses the raw bytes, renders a full document or fragment in one
//! streaming pass (no retained state), and returns a NUL-terminated C string
//! the caller owns (release with `pathland_html_free`).
//!
//! Java binds this via JNA (`com.pathland.render.html` shim); Swift/.NET bind
//! the same ABI.

use std::ffi::{CStr, CString, c_char};
use std::os::raw::c_uchar;

use pathland_core_transport::decode_frame;

use crate::HtmlRenderer;
use crate::tailwind;

fn render_bytes(batch: *const c_uchar, len: u32, root: u32, fragment: bool) -> *const c_char {
    if batch.is_null() {
        return std::ptr::null();
    }
    let bytes = unsafe { std::slice::from_raw_parts(batch, len as usize) };
    let (opcodes, strings) = match decode_frame(bytes) {
        Ok(decoded) => decoded,
        Err(_) => return std::ptr::null(),
    };
    let renderer = HtmlRenderer::new();
    let html = if fragment {
        renderer.render_fragment(&opcodes, &strings, root)
    } else {
        renderer.render_document(&opcodes, &strings, root)
    };
    match CString::new(html) {
        Ok(cs) => cs.into_raw(),
        Err(_) => std::ptr::null(),
    }
}

/// Render a self-contained PLPL batch as a **full HTML document**. Returns a
/// NUL-terminated C string owned by the caller (release with `pathland_html_free`);
/// NULL when the batch is malformed.
///
/// # Safety
/// `batch` must point to `len` readable bytes; the batch is decoded
/// bounds-checked before any rendering.
#[no_mangle]
pub unsafe extern "C" fn pathland_html_render(batch: *const c_uchar, len: u32, root: u32) -> *const c_char {
    render_bytes(batch, len, root, false)
}

/// Render a self-contained PLPL batch as an **HTML fragment** (no `<html>`).
/// Ownership and safety as [`pathland_html_render`].
#[no_mangle]
pub unsafe extern "C" fn pathland_html_render_fragment(
    batch: *const c_uchar,
    len: u32,
    root: u32,
) -> *const c_char {
    render_bytes(batch, len, root, true)
}

/// Release a string returned by [`pathland_html_render`] /
/// [`pathland_html_render_fragment`] / [`pathland_tailwind_compile`]. No-op on NULL.
///
/// # Safety
/// `ptr` must be a pointer previously returned by this module (or NULL).
#[no_mangle]
pub unsafe extern "C" fn pathland_html_free(ptr: *const c_char) {
    if !ptr.is_null() {
        drop(CString::from_raw(ptr as *mut c_char));
    }
}

/// Compile the Tailwind CSS bundle at application start. `default_css` and
/// `override_css` are NUL-terminated CSS strings (the override may be empty);
/// `classes` is the space-separated class safelist. Returns a NUL-terminated
/// C string: the compiled CSS on success, or a `PATHLAND_TAILWIND_ERROR: …`
/// message on failure (caller releases with `pathland_html_free`).
///
/// # Safety
/// All three pointers must be readable NUL-terminated strings (or NULL → "").
#[no_mangle]
pub unsafe extern "C" fn pathland_tailwind_compile(
    default_css: *const c_char,
    override_css: *const c_char,
    classes: *const c_char,
) -> *mut c_char {
    let read = |ptr: *const c_char| {
        if ptr.is_null() {
            String::new()
        } else {
            unsafe { CStr::from_ptr(ptr) }.to_string_lossy().into_owned()
        }
    };
    let default_raw = read(default_css);
    let default = if default_raw.is_empty() {
        tailwind::DEFAULT_THEME_CSS.to_string()
    } else {
        default_raw
    };
    let override_css = read(override_css);
    let classes = read(classes);
    let result = tailwind::compile(&default, &override_css, &classes);
    let output = match result {
        Ok(css) => css,
        Err(err) => format!("PATHLAND_TAILWIND_ERROR: {err}"),
    };
    CString::new(output).map(CString::into_raw).unwrap_or(std::ptr::null_mut())
}

#[cfg(test)]
mod tests {
    use std::ffi::CStr;

    use pathland_core::{Opcode, category, component_type, style, tree};
    use pathland_core_transport::encode_frame;

    use super::*;

    #[test]
    fn capi_renders_a_full_document_and_frees() {
        let mut opcodes = Vec::new();
        let mut strings = Vec::new();
        opcodes.push(Opcode::new(category::TREE, tree::CREATE_NODE, 0, 1, component_type::TEXT as u32, 0));
        strings.extend_from_slice(&(2u32).to_le_bytes());
        strings.extend_from_slice(b"Hi");
        opcodes.push(Opcode::new(category::STYLE, style::SET_TEXT, 0, 1, 0, 0));
        let bytes = encode_frame(&opcodes, &strings);

        let ptr = unsafe { pathland_html_render(bytes.as_ptr(), bytes.len() as u32, 1) };
        assert!(!ptr.is_null());
        let html = unsafe { CStr::from_ptr(ptr) }.to_string_lossy().into_owned();
        assert!(html.contains("<!DOCTYPE html>"));
        assert!(html.contains("<span data-pathland-id=\"1\">Hi</span>"));
        unsafe { pathland_html_free(ptr) };

        let frag = unsafe { pathland_html_render_fragment(bytes.as_ptr(), bytes.len() as u32, 1) };
        let html = unsafe { CStr::from_ptr(frag) }.to_string_lossy().into_owned();
        assert!(!html.contains("<!DOCTYPE html>"));
        assert!(html.contains("data-pathland-id=\"1\""));
        unsafe { pathland_html_free(frag) };
    }

    #[test]
    fn capi_rejects_a_truncated_batch() {
        let ptr = unsafe { pathland_html_render([0u8, 1, 2].as_ptr(), 3, 1) };
        assert!(ptr.is_null());
    }

    #[test]
    fn capi_tailwind_compile_reports_unavailability() {
        // Without the tailwind-embed binary (or a tailwindcss on PATH) the compile
        // must return a clear error string, not crash.
        let ptr = unsafe { pathland_tailwind_compile(std::ptr::null(), std::ptr::null(), std::ptr::null()) };
        assert!(!ptr.is_null());
        let msg = unsafe { CStr::from_ptr(ptr) }.to_string_lossy().into_owned();
        assert!(msg.starts_with("PATHLAND_TAILWIND_ERROR"), "got: {msg}");
        unsafe { pathland_html_free(ptr) };
    }
}