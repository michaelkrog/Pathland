//! Tailwind v4 integration. The renderer emits Tailwind utility classes (see
//! `tw.rs`); at application start the host compiles them — plus the developer's
//! override config and content — into a CSS bundle via the official Tailwind
//! compiler, embedded per platform (feature `tailwind-embed`) or on `PATH`.
//!
//! The compile is a **pure function**: `assemble_input(default, override,
//! classes)` builds the CSS the compiler consumes (default `@theme` + developer
//! override + `@source inline(...)` safelist), and `compile(...)` spawns the
//! compiler once, captures the output, and returns the CSS string.

use std::io::Write;
use std::path::PathBuf;
use std::process::Command;

/// The bundled default Tailwind config: `@theme` with the **Inter** font family
/// (SIL OFL, self-hosted — see `THIRD_PARTY_NOTICES`) and a minimal body reset.
/// A developer overrides it by passing their own v4 CSS (merged after this).
pub const DEFAULT_THEME_CSS: &str = r#"@import "tailwindcss";
@theme {
  --font-sans: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
}
body { font-family: var(--font-sans); margin: 0; }
"#;

/// Assemble the CSS the Tailwind compiler consumes: default config + developer
/// override + the `@source inline(...)` safelist forcing every class the
/// renderer can emit (and the developer's own classes) into the build.
pub fn assemble_input(default_css: &str, override_css: &str, classes: &str) -> String {
    let mut input = String::new();
    input.push_str(default_css);
    input.push('\n');
    input.push_str(override_css);
    input.push('\n');
    // `@source inline` brace-expands the given candidates; a space-separated
    // list of exact classes is force-included regardless of content scanning.
    if !classes.is_empty() {
        input.push_str(&format!("@source inline(\"{classes}\");\n"));
    }
    input
}

/// Compile the CSS bundle. `default_css` is [`DEFAULT_THEME_CSS`] unless the
/// host overrides it; `override_css` is the developer's v4 CSS; `classes` is
/// the space-separated class safelist (renderer-derived + developer content).
pub fn compile(default_css: &str, override_css: &str, classes: &str) -> Result<String, String> {
    let input = assemble_input(default_css, override_css, classes);
    let binary = resolve_binary()?;

    // Unique temp names per call: std::process::id() alone collides when two
    // compiles run concurrently (tests/parallel hosts), corrupting each other's
    // in/out files.
    let nonce = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.subsec_nanos())
        .unwrap_or(0);
    let dir = std::env::temp_dir();
    let in_path = dir.join(format!("pathland-tw-in-{}-{nonce}.css", std::process::id()));
    let out_path = dir.join(format!("pathland-tw-out-{}-{nonce}.css", std::process::id()));
    let mut file = std::fs::File::create(&in_path).map_err(|e| format!("write input: {e}"))?;
    file.write_all(input.as_bytes()).map_err(|e| format!("write input: {e}"))?;
    drop(file);

    let output = Command::new(&binary)
        .args([
            "-i",
            in_path.to_str().unwrap_or_default(),
            "-o",
            out_path.to_str().unwrap_or_default(),
        ])
        .output()
        .map_err(|e| format!("spawn tailwindcss ({binary:?}): {e}"))?;

    let _ = std::fs::remove_file(&in_path);
    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr).to_string();
        let _ = std::fs::remove_file(&out_path);
        return Err(format!("tailwindcss failed: {}", err.trim()));
    }
    // The compiler may have exited 0 without producing output (e.g. a placeholder/
    // mismatched binary). Surface that clearly instead of a cryptic read error.
    if !out_path.is_file() {
        return Err("tailwindcss exited successfully but produced no output file "
            .to_string());
    }
    let css = std::fs::read_to_string(&out_path).map_err(|e| format!("read output: {e}"))?;
    let _ = std::fs::remove_file(&out_path);
    if css.trim().is_empty() {
        return Err("tailwindcss produced an empty output file".to_string());
    }
    Ok(css)
}

/// The Tailwind compiler executable: the embedded per-platform binary (feature
/// `tailwind-embed`) or a `tailwindcss` binary on `PATH`.
fn resolve_binary() -> Result<PathBuf, String> {
    #[cfg(feature = "tailwind-embed")]
    {
        return extract_embedded();
    }
    #[cfg(not(feature = "tailwind-embed"))]
    {
        let on_path = std::env::var_os("PATH").and_then(|path| {
            std::env::split_paths(&path)
                .map(|dir| dir.join("tailwindcss"))
                .find(|candidate| candidate.is_file())
        });
        on_path.ok_or_else(|| {
            "tailwindcss binary unavailable: enable the `tailwind-embed` feature or put `tailwindcss` on PATH"
                .to_string()
        })
    }
}

/// Materialize the embedded per-platform binary into a cache path (executables
/// must live on disk) and return it.
#[cfg(feature = "tailwind-embed")]
fn extract_embedded() -> Result<PathBuf, String> {
    const BIN: &[u8] = include_bytes!(env!("TAILWIND_BIN"));
    let cache = std::env::temp_dir().join("pathland-tailwindcss");
    std::fs::create_dir_all(&cache).map_err(|e| format!("cache dir: {e}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let path = cache.join("tailwindcss");
        // Always rewrite: a stale/partial/placeholder file from a previous build
        // (e.g. a test placeholder, or an interrupted fetch) must not be reused,
        // since it would run and silently produce no output.
        std::fs::write(&path, BIN).map_err(|e| format!("extract binary: {e}"))?;
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755))
            .map_err(|e| format!("chmod binary: {e}"))?;
        Ok(path)
    }
    #[cfg(windows)]
    {
        let path = cache.join("tailwindcss.exe");
        std::fs::write(&path, BIN).map_err(|e| format!("extract binary: {e}"))?;
        Ok(path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn assemble_input_merges_default_override_and_safelist() {
        let input = assemble_input(
            "@import \"tailwindcss\";\n@theme { --font-sans: 'Inter'; }\n",
            "@theme { --color-brand: #ff0000; }\n",
            "flex gap-[12px] p-[8px]",
        );
        assert!(input.contains("@import \"tailwindcss\""));
        assert!(input.contains("--font-sans: 'Inter'"));
        assert!(input.contains("--color-brand: #ff0000"));
        assert!(input.contains("@source inline(\"flex gap-[12px] p-[8px]\")"));
    }

    #[test]
    fn assemble_input_omits_empty_safelist() {
        let input = assemble_input(DEFAULT_THEME_CSS, "", "");
        assert!(!input.contains("@source inline"));
    }

    #[cfg(feature = "tailwind-embed")]
    #[test]
    fn embedded_binary_compiles_real_css() {
        // The embedded standalone binary must actually turn the safelist into CSS.
        let css = compile(DEFAULT_THEME_CSS, "", "flex flex-col gap-[12px] p-[8px]").expect("compile");
        assert!(css.contains(".flex"), "flex utility present: {}", css);
        assert!(css.contains(".flex-col"), "flex-col utility present");
        assert!(css.contains("gap"), "gap utility present");
    }

    #[cfg(not(feature = "tailwind-embed"))]
    #[test]
    fn without_embed_reports_binary_unavailable() {
        // Without the embedded binary and no tailwindcss on PATH, compile must
        // return a clear error (not a cryptic read failure).
        let err = compile(DEFAULT_THEME_CSS, "", "flex").unwrap_err();
        assert!(err.contains("tailwindcss binary unavailable") || err.contains("produced no output"),
            "clear error: {err}");
    }
}