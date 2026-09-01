#!/usr/bin/env node
// Fetch the pinned Tailwind standalone binary for the host platform into
// vendor/<target-triple>/tailwindcss, which `pathland-render-html`'s build.rs
// embeds when the `tailwind-embed` feature is enabled.
//
// NOTE: Tailwind Labs distributes the v4 compiler as the npm `@tailwindcss/cli`
// (the Rust engine is only the class scanner; the CSS compiler is JS). For a
// bundled, offline-capable build we use the standalone CLI binary published in
// the tailwindcss-standalone releases. The asset naming below follows that
// convention; confirm the exact release URL + asset names during the P2a test
// pass (the compile machinery is verified separately).
import { createWriteStream, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { spawnSync } from "node:child_process";

const PINNED_VERSION = process.env.TAILWIND_VERSION || "v3.4.17";
const BASE = "https://github.com/tailwindlabs/tailwindcss-standalone/releases/download";
const DIST = resolve(dirname(fileURLToPath(import.meta.url)), "../vendor");

function targetTriple() {
  const os = process.platform;
  const arch = process.arch;
  const osName = os === "darwin" ? "macos" : os === "linux" ? "linux" : os === "win32" ? "windows" : os;
  const archName = arch === "arm64" ? "arm64" : arch === "x64" ? "x64" : arch;
  const osCode = osName === "macos" ? "macos" : osName === "linux" ? "linux" : osName;
  return `${osCode}-${archName}`;
}

const asset = (triple) => `tailwindcss-${triple === "macos-arm64" ? "macos-arm64" : triple}`;

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
  console.log(`ok: ${outFile}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});