#!/usr/bin/env bash
set -euo pipefail

: "${RUNNER_TEMP:?}"
: "${GITHUB_RUN_ID:?}"
: "${TEST_ATTEMPT:?}"
: "${REPORT_ARTIFACT_URL:?}"

path="runs/$GITHUB_RUN_ID/$TEST_ATTEMPT/index.html"
if [[ "$PAGES_DEPLOY_OUTCOME" == 'success' && -n "$PAGE_URL" ]]; then
  url="${PAGE_URL%/}/$path"
  if curl --fail --silent --show-error --location --retry 8 --retry-all-errors \
      --retry-max-time 120 --max-time 20 "$url" --output "$RUNNER_TEMP/live.html" &&
      cmp -s "$RUNNER_TEMP/site/$path" "$RUNNER_TEMP/live.html"; then
    printf '[Open Allure report](%s)\n' "$url" >> "$GITHUB_STEP_SUMMARY"
    printf 'url=%s\n' "$url" >> "$GITHUB_OUTPUT"
    exit 0
  fi
fi

if [[ "$ALLOW_REPORT_FALLBACK" != 'true' ]]; then
  echo '::error::Pages did not serve the verified report for this new deployment.' >&2
  exit 1
fi

echo '::warning::Pages did not refresh this previously deployed commit. The verified Allure artifact is available.'
printf 'Pages did not refresh this commit. Use the downloadable report for this run.\n\n' >> "$GITHUB_STEP_SUMMARY"
printf '[Download Allure report](%s)\n' "$REPORT_ARTIFACT_URL" >> "$GITHUB_STEP_SUMMARY"
printf 'url=%s\n' "$REPORT_ARTIFACT_URL" >> "$GITHUB_OUTPUT"
