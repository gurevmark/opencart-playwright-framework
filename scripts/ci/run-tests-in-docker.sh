#!/usr/bin/env bash
set -euo pipefail

: "${PLAYWRIGHT_TEST_IMAGE:?Set PLAYWRIGHT_TEST_IMAGE to the locally built test image}"
: "${COMPOSE_PROJECT_NAME:?Set COMPOSE_PROJECT_NAME to the running application stack}"

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

export PLAYWRIGHT_VERSION="${PLAYWRIGHT_VERSION:-$(node -p 'require("./package-lock.json").packages["node_modules/@playwright/test"].version')}"
export TEST_UID="$(id -u)"
export TEST_GID="$(id -g)"

# Create writable bind mounts as the runner user, then use that same UID/GID
# inside Docker so artifact uploads can read every generated report and trace.
mkdir -p "${PLAYWRIGHT_REPORTS_DIR:-reports}" "${PLAYWRIGHT_ALLURE_DIR:-allure-results}" "${PLAYWRIGHT_RESULTS_DIR:-test-results}"

# Compose joins the existing project's bridge network and forwards only the
# runtime environment inputs declared on the test service.
# Playwright deletes its output directory before running; use a child of the
# writable mount so this never needs write access to the root-owned /app.
exec docker compose --env-file /dev/null \
  -f docker-compose.yml -f docker-compose.ci.yml -f docker-compose.test.yml \
  --project-name "$COMPOSE_PROJECT_NAME" \
  run --rm --no-deps -T playwright-tests \
  bash scripts/ci/run-tests.sh "${1:-test:master}" "${2:-chromium}" \
  --output=test-results/run "${@:3}"
