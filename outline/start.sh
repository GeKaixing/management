#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_EXAMPLE="$SCRIPT_DIR/.env.example"
ENV_FILE="$SCRIPT_DIR/.env"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed or not available in PATH." >&2
  exit 1
fi

if [[ ! -f "$ENV_EXAMPLE" ]]; then
  echo "Missing .env.example in $SCRIPT_DIR" >&2
  exit 1
fi

random_hex_secret() {
  if command -v xxd >/dev/null 2>&1; then
    head -c 32 /dev/urandom | xxd -p -c 256
  else
    od -An -N32 -tx1 /dev/urandom | tr -d ' \n'
  fi
}

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  secret="$(random_hex_secret)"
  utils="$(random_hex_secret)"
  sed -i.bak "s/replace-with-secret-key/$secret/g" "$ENV_FILE"
  sed -i.bak "s/replace-with-utils-secret/$utils/g" "$ENV_FILE"
  rm -f "$ENV_FILE.bak"
  echo "Created .env with generated secrets."
fi

cd "$SCRIPT_DIR"
docker compose up -d

echo "Outline is starting."
echo "URL: http://127.0.0.1:13080"
echo "Register/Login email inbox: http://127.0.0.1:18025"
