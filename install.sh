#!/usr/bin/env bash
set -euo pipefail

INSTALL_METHOD="zip"
INSTALL_DIR="$HOME/rcs"
BRANCH="main"
REPO_URL="https://github.com/GeKaixing/management"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --install-method)
      INSTALL_METHOD="$2"; shift 2 ;;
    --dir)
      INSTALL_DIR="$2"; shift 2 ;;
    --branch)
      BRANCH="$2"; shift 2 ;;
    *)
      echo "Unknown arg: $1"; exit 1 ;;
  esac
 done

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required."; exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required."; exit 1
fi

read -r -p "Server host (e.g. 192.168.1.23 or server.local): " SERVER_HOST
if [[ -z "$SERVER_HOST" ]]; then
  echo "Server host is required."; exit 1
fi

read -r -p "Device ID (e.g. cam-002, blank = auto-bind to this machine): " DEVICE_ID

read -r -p "Enable keyboard/mouse input monitoring? (y/N): " EN_INPUT
read -r -p "Enable screen capture? (y/N): " EN_SCREEN
read -r -p "Enable microphone recording? (y/N): " EN_MIC
read -r -p "Enable camera frames? (y/N): " EN_CAM

FLAGS=()
if [[ "$EN_INPUT" =~ ^[Yy]$ ]]; then FLAGS+=("--input"); fi
if [[ "$EN_SCREEN" =~ ^[Yy]$ ]]; then FLAGS+=("--screen"); fi
if [[ "$EN_MIC" =~ ^[Yy]$ ]]; then FLAGS+=("--mic"); fi
if [[ "$EN_CAM" =~ ^[Yy]$ ]]; then FLAGS+=("--camera-frames"); fi

if [[ "$INSTALL_METHOD" == "git" ]]; then
  if ! command -v git >/dev/null 2>&1; then
    echo "git not found, falling back to zip."; INSTALL_METHOD="zip"
  fi
fi

if [[ "$INSTALL_METHOD" == "git" ]]; then
  if [[ -d "$INSTALL_DIR/.git" ]]; then
    echo "Updating existing repo in $INSTALL_DIR"
    git -C "$INSTALL_DIR" pull origin "$BRANCH"
  else
    git clone -b "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
  fi
else
  TMP_ZIP="/tmp/rcs.zip"
  curl -fsSL "$REPO_URL/archive/refs/heads/$BRANCH.zip" -o "$TMP_ZIP"
  rm -rf "$INSTALL_DIR"
  unzip -q "$TMP_ZIP" -d /tmp
  mv "/tmp/management-$BRANCH" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

npm install
npm install ffmpeg-static

SERVER_URL="http://$SERVER_HOST:3000"

CMD=(node agent/cli.js start --server "$SERVER_URL")
if [[ -n "$DEVICE_ID" ]]; then
  CMD+=(--device "$DEVICE_ID")
fi
CMD+=("${FLAGS[@]}")

FFMPEG_STATIC_PATH=""
if node -e "require('ffmpeg-static')" >/dev/null 2>&1; then
  FFMPEG_STATIC_PATH=$(node -e "process.stdout.write(require('ffmpeg-static') || '')")
fi

if [[ -n "$FFMPEG_STATIC_PATH" ]]; then
  echo "Install complete. ffmpeg-static is available: $FFMPEG_STATIC_PATH"
else
  echo "Install complete, but ffmpeg-static is not available."
fi

"${CMD[@]}"
