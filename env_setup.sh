#!/usr/bin/env bash
set -euo pipefail

# Run from the project directory regardless of the caller's working directory.
cd "$(dirname "$0")"

case "${1:-}" in
  "") install_browsers=false ;;
  --with-browsers) install_browsers=true ;;
  -h|--help)
    echo "Usage: bash env_setup.sh [--with-browsers]"
    echo "Install the latest course dependencies; optionally install local Playwright browsers."
    exit 0
    ;;
  *)
    echo "Unknown option: $1" >&2
    echo "Usage: bash env_setup.sh [--with-browsers]" >&2
    exit 2
    ;;
esac

if (( $# > 1 )); then
  echo "Only one option is supported." >&2
  exit 2
fi

npm install --save-dev \
  @playwright/test@latest @types/node@latest dotenv@latest \
  @faker-js/faker@latest luxon@latest ajv@latest csv-parse@latest \
  xlsx@latest @axe-core/playwright@latest allure-playwright@latest mysql2@latest

if [[ "$install_browsers" == true ]]; then
  npx playwright install
fi
