#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: ./scripts/switch-env.sh [local|cloud]"
  exit 1
fi

PROFILE="$1"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

case "$PROFILE" in
  local)
    SOURCE_FILE="$ROOT_DIR/.env.local.local"
    ;;
  cloud)
    SOURCE_FILE="$ROOT_DIR/.env.local.cloud"
    ;;
  *)
    echo "Unknown profile: $PROFILE"
    echo "Valid profiles: local, cloud"
    exit 1
    ;;
esac

TARGET_FILE="$ROOT_DIR/.env.local"

if [ ! -f "$SOURCE_FILE" ]; then
  echo "Missing profile file: $SOURCE_FILE"
  echo "Create it first, then rerun."
  exit 1
fi

cp "$SOURCE_FILE" "$TARGET_FILE"
echo "Active env profile: $PROFILE"
echo "Updated: $TARGET_FILE"
