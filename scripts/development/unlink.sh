#!/usr/bin/env bash
# Removes the symlink created by link.sh.
#
# Override the Foundry data path if yours differs from the default:
#   FOUNDRY_DATA_PATH=/path/to/FoundryVTT/Data ./scripts/development/unlink.sh

set -euo pipefail

FOUNDRY_DATA_PATH="${FOUNDRY_DATA_PATH:-$HOME/.local/share/FoundryVTT/Data}"
SYSTEMS_DIR="$FOUNDRY_DATA_PATH/systems"
SYSTEM_ID="stonetop"
LINK_PATH="$SYSTEMS_DIR/$SYSTEM_ID"

if [ ! -L "$LINK_PATH" ]; then
  echo "Error: No symlink found at $LINK_PATH — nothing to remove."
  exit 1
fi

rm "$LINK_PATH"
echo "Removed: $LINK_PATH"
