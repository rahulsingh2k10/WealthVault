#!/usr/bin/env bash
# Runs the WealthVault test suite (tests/). No argument runs everything.
# Usage: ./run-tests.sh [api|database|e2e]
set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────────
VIOLET='\033[0;35m'
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_project_name()  { echo -e "\n${VIOLET}--------------------------------------------------${NC}\n${VIOLET}$1${NC}\n${VIOLET}--------------------------------------------------${NC}\n"; }
print_header()  { echo -e "\n${BLUE}********************************************${NC}\n${BLUE}$1${NC}\n${BLUE}********************************************${NC}\n"; }
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
    print_error "$label failed"
    exit $exit_code
  fi
  print_success "$label completed"
}

# Runs a category of suites under one header, numbering them "SUITE i of N".
# Each argument after the header is a "Suite Label:ts_arg" pair.
run_group() {
  local header="$1"; shift
  local total=$# index=1 entry
  print_header "$header"
  for entry in "$@"; do
    print_suite_banner "${entry%%:*}" "$index" "$total"
    run_suite "${entry%%:*}" "${entry##*:}"
    index=$((index + 1))
  done
}

API_SUITES=("Auth API Tests:auth" "Unlock API Tests:unlock" "Dashboard API Tests:dashboard" "Upgrade Prompt Tests:upgrade" "Preferences API Tests:preferences" "Nav API Tests:nav" "Subscription Tests:subscription")

print_project_name "Running WealthVault Tests"

case "$(echo "$SUITE" | tr '[:upper:]' '[:lower:]')" in
  "")
    run_group "API Testing" "${API_SUITES[@]}"
    run_group "Database Testing" "Database Tests:database"
    run_group "Playwright End-to-End Testing" "Playwright E2E Tests:playwright"
    ;;
  api)
    run_group "API Testing" "${API_SUITES[@]}"
    ;;
  database)
    run_group "Database Testing" "Database Tests:database"
    ;;
  e2e|playwright)
    run_group "Playwright End-to-End Testing" "Playwright E2E Tests:playwright"
    ;;
  *)
    print_error "Unknown suite \"$SUITE\". Valid values: api, database, e2e (or no argument to run all)."
    exit 1
    ;;
esac

print_success "Test run completed successfully!"
