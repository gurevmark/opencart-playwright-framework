#!/usr/bin/env bash
set -euo pipefail

: "${ALLURE_VERSION:?Set the pinned Allure version}"
: "${ALLURE_SHA256:?Set the pinned archive checksum}"
: "${ALLURE_CACHE_DIR:?Set the archive cache directory}"
: "${ALLURE_HOME:?Set the installation directory}"

mkdir -p "$ALLURE_CACHE_DIR"
archive="$ALLURE_CACHE_DIR/allure-$ALLURE_VERSION.zip"
if [[ ! -f "$archive" ]]; then
  curl --fail --silent --show-error --location --retry 3 \
    "https://github.com/allure-framework/allure2/releases/download/$ALLURE_VERSION/allure-$ALLURE_VERSION.zip" \
    --output "$archive"
fi

# Verify restored archives too. Only the pinned distribution may be executed.
if ! printf '%s  %s\n' "$ALLURE_SHA256" "$archive" | sha256sum -c - > /dev/null; then
  echo 'Allure archive checksum verification failed.' >&2
  exit 1
fi
unzip -q "$archive" -d "$ALLURE_HOME"
