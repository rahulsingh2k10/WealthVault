#!/usr/bin/env bash
# Runs the WealthVault frontend locally at http://localhost:3000, plus an
# ngrok tunnel on the domain already registered as Razorpay's webhook URL —
# Razorpay's servers can't reach localhost directly, so without this,
# subscription events (activated, charged, halted, ...) never arrive.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
PORT=3000
NGROK_DOMAIN="${NGROK_DOMAIN:-rory-notal-unintrusively.ngrok-free.dev}"
NGROK_LOG="/tmp/wealthvault-ngrok.log"

cd "$FRONTEND_DIR"

if [ ! -f .env ]; then
  echo "Missing frontend/.env — copy frontend/.env.example to frontend/.env and fill in values first."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Syncing Prisma Client with schema.prisma..."
npx prisma generate

echo "Freeing port $PORT..."
lsof -ti ":$PORT" | xargs kill -9 2>/dev/null || true

NGROK_PID=""
if command -v ngrok >/dev/null 2>&1; then
  echo "Freeing ngrok's inspection port 4040..."
  lsof -ti :4040 | xargs kill -9 2>/dev/null || true

  echo "Starting ngrok tunnel on $NGROK_DOMAIN..."
  ngrok http --domain="$NGROK_DOMAIN" "$PORT" >"$NGROK_LOG" 2>&1 &
  NGROK_PID=$!
  trap '[ -n "$NGROK_PID" ] && kill "$NGROK_PID" 2>/dev/null || true' EXIT INT TERM

  for _ in $(seq 1 10); do
    if curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | grep -q "$NGROK_DOMAIN"; then
      echo "ngrok tunnel up: https://$NGROK_DOMAIN (matches the Razorpay webhook URL)"
      break
    fi
    sleep 1
  done
else
  echo "ngrok not found on PATH — Razorpay webhook events won't reach this server. Install ngrok to enable it."
fi

echo "Starting dev server on http://localhost:$PORT ..."
npm run dev
