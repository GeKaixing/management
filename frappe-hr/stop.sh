#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_DIR="$SCRIPT_DIR/hrms-src/docker"

if [ ! -d "$DOCKER_DIR" ]; then
  echo "Missing $DOCKER_DIR. Run ./start.sh first."
  exit 1
fi

(cd "$DOCKER_DIR" && docker compose down)
echo "Frappe HR stopped."
