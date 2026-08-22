#!/usr/bin/env bash
# Regenerate the catalog-driven DSLs and re-run the conformance tests.
#
# Usage: ./generate.sh
#
# 1. `pathland-codegen` parses lib/ui/components.yaml, asserts every id against
#    pathland_core::constants (hard error on mismatch), and emits the
#    checked-in Java DSL.
# 2. `cargo test` re-runs the native crate test suite (the consistency + wire
#    conformance safety net).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
export PATH="$HOME/.cargo/bin:$PATH"

echo "==> Regenerating DSL from lib/ui/components.yaml"
(cd "$REPO_ROOT/lib/rust" && cargo run -p pathland-codegen)

echo "==> Running Rust tests (conformance)"
(cd "$REPO_ROOT/lib/rust" && cargo test)
