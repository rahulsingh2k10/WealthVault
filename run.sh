#!/usr/bin/env bash
# Runs the WealthVault frontend locally at http://localhost:3000
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
PORT=3000

cd "$FRONTEND_DIR"

if [ ! -f .env ]; then
  echo "Missing frontend/.env — copy frontend/.env.example to frontend/.env and fill in values first."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Freeing port $PORT..."
lsof -ti ":$PORT" | xargs kill -9 2>/dev/null || true

echo "Starting dev server on http://localhost:$PORT ..."
exec npm run dev
