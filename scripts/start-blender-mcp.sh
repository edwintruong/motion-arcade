#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export LD_LIBRARY_PATH="$HOME/.local/opt/blender-runtime-libs${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
exec "$HOME/.local/opt/blender-4.5.9-linux-x64/blender" --background --python scripts/blender-mcp-headless.py
