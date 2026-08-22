#!/usr/bin/env bash
# Build and run the Pathland Java demo (JNA over pathland-view-native + GTK renderer).
#
# Usage:
#   ./run.sh                 # run demo.GtkDemo
#   ./run.sh demo.DemoHeadless   # run the headless verification demo
#
# The Rust native libs (libpathland_native, libpathland_gtk) are built first,
# then the Java is compiled and launched with `java` directly (NOT
# `mvn exec:java`) — on macOS GTK must run on the process's main thread, which
# requires `-XstartOnFirstThread` on the `java` invocation; the Maven exec
# plugin does not propagate that flag correctly.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
RUST_DIR="$REPO_ROOT/lib/rust"
RUST_TARGET="$RUST_DIR/target/debug"
DEMO_DIR="$REPO_ROOT/lib/java/pathland-demo"

MAIN_CLASS="${1:-demo.GtkDemo}"

export PATH="$HOME/.cargo/bin:$PATH"

echo "==> Building native libs (pathland-view-native, pathland-render-gtk)"
(cd "$RUST_DIR" && cargo build -p pathland-view-native -p pathland-render-gtk)

echo "==> Compiling Java demo"
(cd "$DEMO_DIR" && mvn -q compile)

echo "==> Resolving Java classpath"
(cd "$DEMO_DIR" && mvn -q dependency:build-classpath \
    -Dmdep.outputFile="$DEMO_DIR/target/classpath.txt")

CLASSPATH="$DEMO_DIR/target/classes:$(cat "$DEMO_DIR/target/classpath.txt")"

JAVA_BIN="${JAVA_HOME:+$JAVA_HOME/bin/}java"

JVM_ARGS=()
if [[ "$(uname -s)" == "Darwin" ]]; then
    # GTK must initialize on the main thread on macOS; the flag must be passed
    # to `java` itself (not via MAVEN_OPTS / mvn exec:java).
    JVM_ARGS+=("-XstartOnFirstThread")
fi

echo "==> Running $MAIN_CLASS"
DYLD_LIBRARY_PATH="$RUST_TARGET${DYLD_LIBRARY_PATH:+:$DYLD_LIBRARY_PATH}" \
    "$JAVA_BIN" "${JVM_ARGS[@]}" \
    -Djna.library.path="$RUST_TARGET" \
    -cp "$CLASSPATH" \
    "$MAIN_CLASS"
