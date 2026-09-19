#!/usr/bin/env bash
# Wipes all user-generated data — plus nav_config, always — from the given
# environment's Railway database. subscription_plans and auth_platforms are
# never touched (the app can't function without them). Thin wrapper around
# frontend/scripts/wipe-database.ts; see that file for the full breakdown of
# what's deleted vs preserved.
#
# Usage: ./wipe.sh testing
#        ./wipe.sh production
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

TARGET="${1:-}"
if [[ "$TARGET" != "testing" && "$TARGET" != "production" ]]; then
  echo "Usage: $0 testing|production"
  exit 1
fi

if [ ! -f "$FRONTEND_DIR/.env" ]; then
  echo "Missing frontend/.env — copy frontend/.env.example to frontend/.env and fill in values first."
  exit 1
fi

set -a
# shellcheck disable=SC1091
. "$FRONTEND_DIR/.env"
set +a

if [ "$TARGET" = "production" ] && [ -z "${PRODUCTION_DATABASE_URL:-}" ]; then
  echo "Missing PRODUCTION_DATABASE_URL in frontend/.env."
  exit 1
fi
if [ "$TARGET" = "testing" ] && [ -z "${TESTING_DATABASE_URL:-}" ]; then
  echo "Missing TESTING_DATABASE_URL in frontend/.env."
  exit 1
fi

echo ""
echo "This permanently deletes ALL users, subscriptions, plan history,"
echo "webhook events, preferences, AND nav_config from: $TARGET"
echo "(subscription_plans and auth_platforms are preserved)"
echo ""

if [ "$TARGET" = "production" ]; then
  read -r -p "Type PRODUCTION to confirm wiping the LIVE database: " CONFIRM
  if [ "$CONFIRM" != "PRODUCTION" ]; then
    echo "Aborted."
    exit 1
  fi
  CONFIRM_FLAG="--confirm-production"
else
  read -r -p "Type yes to confirm wiping testing: " CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    echo "Aborted."
    exit 1
  fi
  CONFIRM_FLAG=""
fi

cd "$FRONTEND_DIR"
npx tsx scripts/wipe-database.ts --env="$TARGET" --yes --include-nav-config ${CONFIRM_FLAG:+"$CONFIRM_FLAG"}
