#!/usr/bin/env node
// Fetch the pinned Tailwind standalone binary for the host platform into
// vendor/<target-triple>/tailwindcss, which `pathland-render-html`'s build.rs
// embeds when the `tailwind-embed` feature is enabled.
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

function targetTriple() {
  const os = process.platform;
  const arch = process.arch;
  const osName = os === "darwin" ? "macos" : os === "linux" ? "linux" : os === "win32" ? "windows" : os;
  const archName = arch === "arm64" ? "arm64" : arch === "x64" ? "x64" : arch;
  return `${osName}-${archName}`;
}

// Asset name in the tailwindlabs/tailwindcss release (e.g. tailwindcss-macos-arm64).
const asset = (triple) => `tailwindcss-${triple}${triple.startsWith("windows") ? ".exe" : ""}`;

async function main() {
  const triple = process.env.TARGET || targetTriple();
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
  if (triple.startsWith("macos") || triple.startsWith("linux")) {
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