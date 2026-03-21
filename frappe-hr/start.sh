#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$SCRIPT_DIR/hrms-src"
DOCKER_DIR="$REPO_DIR/docker"
UPDATE="${1:-}"

if ! command -v git >/dev/null 2>&1; then
  echo "Git is required but not found in PATH."
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required but not found in PATH."
  exit 1
fi

if [ ! -d "$REPO_DIR" ]; then
  echo "Cloning frappe/hrms..."
  git clone https://github.com/frappe/hrms "$REPO_DIR"
elif [ "$UPDATE" = "--update" ]; then
  echo "Updating hrms-src..."
  git -C "$REPO_DIR" pull --ff-only
fi

if [ ! -d "$DOCKER_DIR" ]; then
  echo "Missing $DOCKER_DIR. Upstream repository layout may have changed."
  exit 1
fi

echo "Starting Frappe HR docker environment..."
(cd "$DOCKER_DIR" && docker compose up -d)

echo "Started."
echo "URL: http://localhost:8000"
echo "Default account: Administrator / admin"
