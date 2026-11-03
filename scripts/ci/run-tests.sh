#!/usr/bin/env bash
set -euo pipefail

suite="${1:-test:e2e}"
browser="${2:-chromium}"
if (( $# >= 2 )); then shift 2; else set --; fi

case "$suite" in
  test:master) tag=master ;;
  test:sanity) tag=sanity ;;
  test:regression) tag=regression ;;
  test:e2e) tag=end-to-end ;;
  test:api) tag=api ;;
  test:web) tag=web ;;
  test:db) tag=db ;;
  test:datadriven) tag=datadriven ;;
  *) echo 'Unsupported test suite.' >&2; exit 2 ;;
esac

case "$browser" in
  chromium|firefox|webkit) ;;
  *) echo 'Unsupported browser.' >&2; exit 2 ;;
esac

# Keep the configured reporters. Extra CLI arguments support local --list checks.
exec npx --no-install playwright test --grep "@$tag(\\s|$)" \
  --project="$browser" --output=test-results "$@"
