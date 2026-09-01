#!/usr/bin/env node
// Fetch the pinned Tailwind standalone binary into
// vendor/<rust-target-triple>/tailwindcss, which `pathland-render-html`'s build.rs
// embeds when the `tailwind-embed` feature is enabled. build.rs reads the Cargo
// `TARGET` (e.g. `x86_64-unknown-linux-gnu`), so the vendor directory MUST be
// keyed by the Rust target triple, not a human triple.
//
// The official Tailwind v4 compiler is distributed as per-platform standalone
// binaries under tailwindlabs/tailwindcss releases (fully Rust, no Node needed).
// We bundle the host platform's binary so the renderer can compile CSS offline.
import { createWriteStream, mkdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { spawnSync } from "node:child_process";

const PINNED_VERSION = process.env.TAILWIND_VERSION || "v4.3.3";
const BASE = "https://github.com/tailwindlabs/tailwindcss/releases/download";
const DIST = resolve(dirname(fileURLToPath(import.meta.url)), "../vendor");

// Map a Rust target triple to the Tailwind release asset triple
// (e.g. `x86_64-unknown-linux-gnu` -> `linux-x64`).
const TARGET_TO_ASSET = {
  "x86_64-unknown-linux-gnu": "linux-x64",
  "aarch64-unknown-linux-gnu": "linux-arm64",
  "x86_64-apple-darwin": "macos-x64",
  "aarch64-apple-darwin": "macos-arm64",
  "x86_64-pc-windows-msvc": "windows-x64",
  "x86_64-pc-windows-gnu": "windows-x64",
};

// Infer the host Rust target triple from process.platform/arch. Used when
// `TARGET` is not set (local dev).
function hostRustTriple() {
  const os = process.platform;
  const arch = process.arch;
  const osName = os === "darwin" ? "apple-darwin" : os === "linux" ? "unknown-linux-gnu" : "pc-windows-msvc";
  const archName = arch === "arm64" ? "aarch64" : arch === "x64" ? "x86_64" : arch;
  return `${archName}-${osName}`;
}

const asset = (triple) => `tailwindcss-${TARGET_TO_ASSET[triple]}`;

async function main() {
  const triple = process.env.TARGET || hostRustTriple();
  const assetTriple = TARGET_TO_ASSET[triple];
  if (!assetTriple) {
    throw new Error(`no Tailwind asset mapping for target triple '${triple}'`);
  }
  const outDir = resolve(DIST, triple);
  const outFile = resolve(outDir, "tailwindcss");
  mkdirSync(outDir, { recursive: true });

  if (process.env.TAILWIND_BIN) {
    spawnSync("cp", [process.env.TAILWIND_BIN, outFile]);
    console.log(`copied TAILWIND_BIN -> ${outFile}`);
    return;
  }

  const url = `${BASE}/${PINNED_VERSION}/${asset(triple)}`;
  console.log(`fetching ${url} -> ${outFile}`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`download failed (${res.status}): ${url}\nSet TAILWIND_VERSION / TARGET, or place the binary at ${outFile}.`);
  }
  await pipeline(res.body, createWriteStream(outFile));
  if (assetTriple.startsWith("macos") || assetTriple.startsWith("linux")) {
    spawnSync("chmod", ["+x", outFile]);
  }
  // Verify the pinned checksum when provided (TAILWIND_SHA256).
  if (process.env.TAILWIND_SHA256) {
    const hash = createHash("sha256").update(readFileSync(outFile)).digest("hex");
    if (hash !== process.env.TAILWIND_SHA256) {
      throw new Error(`sha256 mismatch for ${outFile}: ${hash}`);
    }
  }
  console.log(`ok: ${outFile}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});