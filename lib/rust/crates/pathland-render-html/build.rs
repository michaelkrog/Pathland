//! Build script for `pathland-render-html`.
//!
//! With the `tailwind-embed` feature enabled, embeds the per-platform Tailwind
//! standalone binary (MIT — see `THIRD_PARTY_NOTICES`) into the cdylib via
//! `include_bytes!`. The binary is placed by `scripts/fetch-tailwind.mjs` under
//! `vendor/<target-triple>/tailwindcss`; if the feature is on but the file is
//! missing, the build fails with a clear message instead of a confusing
//! `include_bytes!` error.

fn main() {
    println!("cargo:rerun-if-changed=build.rs");
    #[cfg(feature = "tailwind-embed")]
    {
        let target = std::env::var("TARGET").unwrap_or_else(|_| "unknown-target".to_string());
        let vendor = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("vendor")
            .join(&target)
            .join("tailwindcss");
        if !vendor.is_file() {
            panic!(
                "`tailwind-embed` is enabled but the Tailwind binary is missing at {}.\n\
                 Run `node scripts/fetch-tailwind.mjs` (or set TAILWIND_BIN) first.",
                vendor.display()
            );
        }
        println!("cargo:rustc-env=TAILWIND_BIN={}", vendor.display());
        println!("cargo:rerun-if-changed={}", vendor.display());
    }
}