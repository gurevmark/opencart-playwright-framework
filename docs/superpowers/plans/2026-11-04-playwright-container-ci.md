# Playwright Container CI Implementation Plan

> **For agentic workers:** Implement inline using superpowers:executing-plans and verify the complete container flow.

**Goal:** Build and run the current commit's Playwright tests in CI without reinstalling browsers or unchanged npm dependencies on each run.

**Architecture:** Build from the version-matched official Playwright image, install npm dependencies before copying runtime sources, and reuse Buildx layers through the GitHub Actions cache. Load the image into the same Ubuntu runner and run tests on the application's Compose bridge network with writable artifact mounts.

**Tech Stack:** Docker Buildx, GitHub Actions, Playwright 1.64.1, Bash.

**Spec:** User-selected architecture in this chat; operational contract in `docs/CI.md`.

## Global Constraints

- Preserve the existing local OpenCart/MySQL containers, data and ignored `.env`.
- Keep the root lockfile unchanged; resolve the base image version from it.
- Keep browser tests headless, suite selection by tags, existing reporters and failure exit codes.
- Pass credentials only at runtime; exclude local configuration from the build context.
- Build and run on the same runner without publishing an image or pushing repository changes.

## Review Focus

- Cache reuse when only test sources change; cold builds must also work.
- Container access to OpenCart, API and MySQL by service DNS names and internal ports.
- Reports remain readable by the runner after successful and failed tests.
- Package/image version alignment and absence of `.env` in the image.
- Cleanup affects only the disposable acceptance-test stack.

## Task 1: Image and workflow

**Files:** `.dockerignore`, `docker/playwright/Dockerfile`, `.github/workflows/playwright.yml`, `scripts/ci/run-tests-in-docker.sh`.

- [x] Inspect the existing workflow, suite dispatcher, environment inputs and container addresses.
- [x] Add the image, a restricted build context and the container runner.
- [x] Add Buildx layer caching and replace host dependency/browser installation with a local image build.
- [x] Validate workflow/shell syntax, build the image and verify source-only changes reuse the npm layer.

## Task 2: Acceptance and documentation

**Files:** `docs/CI.md`, `docker/README.md`.

- [x] Run existing configuration checks and the full 94-scenario suite in the test image against a disposable stack with synthetic credentials.
- [x] Check failure exit-code propagation and host-readable reports, and remove only the acceptance stack.
- [x] Document cache behavior, runtime networking, image versions and verification limits.

## Decisions

- Configuration changes are verified with the real image and existing suites rather than tests that mirror YAML or shell argument assembly.
- Local verification uses isolated runtime inputs and output directories; GitHub cache export/restore requires a hosted run after publication.
- Real acceptance exposed output-directory cleanup failing under a root-owned `/app`; the container wrapper uses `test-results/run/` below the writable mount. Runtime `HOME=/tmp` is set after dependency installation to avoid a root-owned runtime npm cache.

## Task 3: Full local Docker Desktop stack

**Files:** `docker-compose.test.yml`, `scripts/ci/local-docker.mjs`, `scripts/ci/local-docker.test.mjs`, `.gitignore`, `docs/CI.md`, `docker/README.md`.

- [x] Add private persistent synthetic credentials and validate ports/configuration without reading the existing `.env`.
- [x] Add an opt-in test service grouped with four applications/databases in a separate `opencart-local-ci` Compose project.
- [x] Run the complete local command, verify all 94 tests and rerun against the same saved configuration.
- [x] Document startup, reports, status, stop and removal commands; confirm the original environment is preserved.

## Task 4: Shared bridge network locally and in CI

- [x] Reuse a shared Compose test-service overlay with service DNS and private browser shared memory.
- [x] Select configured internal OpenCart URLs for internal requests while preserving the external Mac URL and existing two-service defaults.
- [x] Run URL-selection checks and full local and disposable CI-style 94-test runs; verify network membership, browser access, reports and failure codes.
- [x] Update documentation and preserve existing local data, credentials and the original two-service stack.
