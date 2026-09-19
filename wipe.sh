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

# Refuse if both are set and identical — almost certainly a misconfiguration
# in .env, and would silently wipe "the other" environment under the wrong
# label with no further warning.
if [ -n "${PRODUCTION_DATABASE_URL:-}" ] && [ -n "${TESTING_DATABASE_URL:-}" ] \
   && [ "$PRODUCTION_DATABASE_URL" = "$TESTING_DATABASE_URL" ]; then
  echo "Refusing: PRODUCTION_DATABASE_URL and TESTING_DATABASE_URL are identical in frontend/.env."
  echo "This is almost certainly a mistake — fix .env before running this script."
  exit 1
fi

if [ "$TARGET" = "production" ]; then
  RESOLVED_URL="$PRODUCTION_DATABASE_URL"
else
  RESOLVED_URL="$TESTING_DATABASE_URL"
fi
# host:port only — never print credentials.
RESOLVED_HOST="$(echo "$RESOLVED_URL" | sed -E 's#^[a-zA-Z]+://[^@]*@##; s#/.*$##')"

echo ""
echo "Target: $TARGET  ($RESOLVED_HOST)"
echo "This permanently deletes ALL users, subscriptions, plan history,"
echo "webhook events, preferences, AND nav_config from this database."
echo "(subscription_plans and auth_platforms are preserved)"
echo ""

if [ "$TARGET" = "production" ]; then
  read -r -p "Type PRODUCTION to confirm wiping $RESOLVED_HOST: " CONFIRM
  if [ "$CONFIRM" != "PRODUCTION" ]; then
    echo "Aborted."
    exit 1
  fi
  CONFIRM_FLAG="--confirm-production"
else
  read -r -p "Type yes to confirm wiping $RESOLVED_HOST: " CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    echo "Aborted."
    exit 1
  fi
  CONFIRM_FLAG=""
fi

cd "$FRONTEND_DIR"
npx tsx scripts/wipe-database.ts --env="$TARGET" --yes --include-nav-config ${CONFIRM_FLAG:+"$CONFIRM_FLAG"}
