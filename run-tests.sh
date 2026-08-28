#!/usr/bin/env bash
# Runs the WealthVault test suite (tests/). No argument runs everything.
# Usage: ./run-tests.sh [api|database|e2e]
set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header()  { echo -e "\n${BLUE}========================================${NC}\n${BLUE}$1${NC}\n${BLUE}========================================${NC}\n"; }
print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_error()   { echo -e "${RED}✗ $1${NC}"; }
print_suite_banner() {
  local label="$1" index="$2" total="$3"
  echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}  SUITE $index of $total — $label${NC}"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TESTS_DIR="$SCRIPT_DIR/tests"
SUITE="${1:-}"

cd "$TESTS_DIR"

if [ ! -f ../frontend/.env ]; then
  print_error "Missing frontend/.env — the test suite reads DATABASE_URL/TEST_DATABASE_URL/SESSION_SECRET/ENCRYPTION_SALT from there."
  exit 1
fi

if [ ! -d node_modules ]; then
  print_header "Installing test suite dependencies"
  npm install --silent
  print_success "Test suite dependencies ready"
fi

# Runs one suite via the TS orchestrator; exits the whole script on failure.
run_suite() {
  local label="$1" ts_arg="$2"
  set +e
  npx ts-node run-tests.ts "$ts_arg"
  local exit_code=$?
  set -e
  if [ $exit_code -ne 0 ]; then
    print_error "$label suite failed"
    exit $exit_code
  fi
  print_success "$label suite completed"
}

print_header "Running WealthVault Tests"

case "$(echo "$SUITE" | tr '[:upper:]' '[:lower:]')" in
  "")
    print_suite_banner "Auth API Tests" 1 4
    run_suite "Auth API" auth

    print_suite_banner "Unlock API Tests" 2 4
    run_suite "Unlock API" unlock

    print_suite_banner "Database Tests" 3 4
    run_suite "Database" database

    print_suite_banner "Playwright E2E Tests" 4 4
    run_suite "Playwright E2E" playwright
    ;;
  api)
    print_suite_banner "Auth API Tests" 1 2
    run_suite "Auth API" auth

    print_suite_banner "Unlock API Tests" 2 2
    run_suite "Unlock API" unlock
    ;;
  database)
    print_header "Running Database Tests"
    run_suite "Database" database
    ;;
  e2e|playwright)
    print_header "Running Playwright E2E Tests"
    run_suite "Playwright E2E" playwright
    ;;
  *)
    print_error "Unknown suite \"$SUITE\". Valid values: api, database, e2e (or no argument to run all)."
    exit 1
    ;;
esac

print_success "Test run completed successfully!"
