#!/bin/bash

# Copy @pathland packages from lib to node_modules for Vite to resolve
# This is needed because Vite's import analysis doesn't follow symlinks

echo "Copying @pathland packages to node_modules..."

PACKAGES=("platform-browser" "view" "renderer-dom" "protocol" "transport")
POC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LIB_DIR="$POC_DIR/../lib/typescript/packages"
NODE_MODULES_DIR="$POC_DIR/node_modules/@pathland"

# Create @pathland directory in node_modules
mkdir -p "$NODE_MODULES_DIR"

# Copy each package
for pkg in "${PACKAGES[@]}"; do
  if [ -d "$LIB_DIR/$pkg" ]; then
    echo "  Copying $pkg..."
    cp -r "$LIB_DIR/$pkg" "$NODE_MODULES_DIR/$pkg"
  else
    echo "  Warning: $pkg not found in $LIB_DIR"
  fi
done

echo "Done!"
