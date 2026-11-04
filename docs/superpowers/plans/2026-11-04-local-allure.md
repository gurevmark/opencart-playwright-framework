# Local Allure implementation plan

**Goal:** View this framework's existing Allure results in a new local Docker
container, independently of `sections346-playwright` and CI.

**Design:** Use the existing Allure Docker Service image, pinned to upstream's
current stable version 2.44.0. A dedicated `opencart-allure` Compose project
publishes only `127.0.0.1:5051`. Its `host` and `local-docker` Allure projects
consume the existing result directories and retain separate report history.
Generate reports explicitly after tests, with the most recent 20 reports retained.

**Approaches:** A single-project container would omit one existing result source
or mix their history. Two containers would duplicate the same reporting service.
One container with two Allure projects supports both existing workflows with one
port and separate history. This is an implementation choice within the requested
local Docker setup.

**Files:** `docker-compose.allure.yml` defines only the report service;
`scripts/allure.mjs` provides local lifecycle, generation and opening commands;
`package.json` exposes those commands; `docs/REPORTS.md` explains the workflow;
`docker/README.md` links to that documentation. Existing reporter output paths,
test suites, application containers and GitHub Actions remain as configured.

## Steps

- [x] Add the isolated Compose service and npm commands. Keep generated reports
  under the already ignored `allure-report/` directory.
- [x] Document HTML/JUnit versus Allure results/reports, both input sources,
  explicit generation, accumulated results, retained history and lifecycle.
- [x] Validate Compose, start the service and generate reports from both existing
  sources. Verify root results exclude the nested Docker result directory.
- [x] Check rendered reports, source/result counts, history across container
  recreation, invalid command handling and the final diff. Confirm CI files and
  the older project's container were not changed.

## Verification focus

- The root results directory contains a nested `local-docker` directory; each
  Allure project must read only its own results.
- First startup must tolerate missing result/report directories.
- Report-generation failures must return a nonzero exit code and a useful error.
- Reports/history must survive container recreation without application access.
- Report generation is deliberately manual: no report from a partially written run.

This is reversible local configuration. Verify it against the actual service and
existing result files; no dependencies or synthetic application tests are needed.

## Verification evidence

- Compose validation and Node syntax checks pass. The pinned image has the same
  local image ID as the older project's cached `latest` image.
- The new service is healthy at `127.0.0.1:5051`; the healthcheck uses the image's
  bundled curl. The original project's stopped container is unchanged.
- Host generation consumed exactly 936 saved raw executions (183 unique tests);
  local Docker generation consumed exactly 283 (94 unique tests). Comparing
  every generated case's history ID and start time to its source confirms no
  cross-project input mixing. No application tests were rerun for this change.
- Both overview pages render in Chromium with zero console errors; suite
  navigation works. The Docker report shows 94 passing tests from saved results.
- The reports/history retained identical SHA-256 hashes after `down` and `up`.
  A subsequent Docker report generation retains builds 2 and 1; host history
  remains at build 1. The second generation verifies history, not a new test run.
- Five invalid command/argument combinations return exit 2. Generation while
  the service is down returns exit 1 with startup instructions.
- The macOS default browser could not launch in this environment. The `open`
  command handles this by printing the report URL and manual-opening guidance;
  browser rendering was checked independently using Playwright.
- Reporter configuration, CI files, application Compose files and lockfile have
  no changes. All implementation changes are local and uncommitted.
