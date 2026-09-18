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
DEV_LOG="/tmp/wealthvault-dev.log"
DEFAULT_IFACE="$(route -n get default 2>/dev/null | awk '/interface: / {print $2}')"
LAN_IP="$(ipconfig getifaddr "${DEFAULT_IFACE:-en0}" 2>/dev/null || ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"

NGROK_PID=""
DEV_PID=""
trap '[ -n "$NGROK_PID" ] && kill "$NGROK_PID" 2>/dev/null || true; [ -n "$DEV_PID" ] && kill "$DEV_PID" 2>/dev/null || true' EXIT INT TERM

# Next.js 14.1.0's dev server hangs on every request under newer Node 20.x
# patch releases (confirmed hang on v20.20.2); pin to a known-good version
# regardless of what the calling shell currently has active.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  \. "$NVM_DIR/nvm.sh"
  nvm use 20.11.1 >/dev/null
fi

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

if command -v ngrok >/dev/null 2>&1; then
  echo "Freeing ngrok's inspection port 4040..."
  lsof -ti :4040 | xargs kill -9 2>/dev/null || true

  echo "Starting ngrok tunnel on $NGROK_DOMAIN..."
  ngrok http --domain="$NGROK_DOMAIN" "$PORT" >"$NGROK_LOG" 2>&1 &
  NGROK_PID=$!

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

if [ -n "$LAN_IP" ]; then
  NETWORK_LINE="   - Network:      http://$LAN_IP:$PORT"
else
  NETWORK_LINE="   - Network:      couldn't auto-detect your LAN IP — run 'ipconfig getifaddr en0' (or your active adapter) to find it"
fi

npm run dev > >(sed -l "/- Local:/a\\
$NETWORK_LINE" | tee "$DEV_LOG") 2>&1 &
DEV_PID=$!

for _ in $(seq 1 60); do
  if grep -q "Ready in" "$DEV_LOG" 2>/dev/null; then
    open -a Safari "http://localhost:$PORT"
    break
  fi
  sleep 1
done

wait "$DEV_PID"
