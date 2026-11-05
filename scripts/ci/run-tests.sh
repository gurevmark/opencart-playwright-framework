#!/usr/bin/env bash
set -euo pipefail

suite="${1:-test:opencart}"
browser="${2:-chromium}"
if (( $# >= 2 )); then shift 2; else set --; fi

case "$suite" in
  test:opencart) tag='(web|db)' ;;
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

# An alternate config can replace every artifact writer before this project's
# config is even loaded. Keep the normal Docker entry point on its own config.
for arg in "$@"; do
  case "$arg" in
    -c*|--config|--config=*) echo 'Use the project Playwright config.' >&2; exit 2 ;;
  esac
done

# Keep the configured reporters. Extra arguments support test paths and --list.
exec npx --no-install playwright test --grep "@$tag(\\s|$)" \
  --project="$browser" --output=test-results "$@"
