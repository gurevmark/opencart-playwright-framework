# GitHub Actions setup

Automatic CI runs **all 94 Playwright scenarios** headlessly in a Playwright
container built on an Ubuntu GitHub-hosted runner: **27 OpenCart web/database
tests** and **67 FakeStore API tests against a controlled compatibility fork**.
The API result describes the
controlled service, not the public `https://fakestoreapi.com` deployment.

The runner uses Node only for configuration checks and reading the lockfile.
It builds the test image and starts four application/database containers:

| Application | Database | Address inside the test container |
| --- | --- | --- |
| OpenCart | MySQL | `http://opencart/opencart/upload/`; MySQL `database:3306` |
| Controlled FakeStore API | MongoDB | `http://fakestore:6400`; MongoDB `fakestore-database:27017` is used only by the API |

The base `docker-compose.yml` remains the existing two-service local setup.
CI explicitly adds `docker-compose.ci.yml`. Your local `.env` continues to select
the public FakeStore API for local API runs.

## Compose files and environment labels

The complete containerized run combines three shared files:

| File | Responsibility |
| --- | --- |
| `docker-compose.yml` | Base OpenCart and MySQL services |
| `docker-compose.ci.yml` | Controlled FakeStore/MongoDB and the internal OpenCart URL; used both locally and in CI |
| `docker-compose.test.yml` | Playwright test service on the application's bridge network |

Local and CI runs reuse these definitions. Their project names, credentials,
published host ports, report directories and cache backends differ. CI starts the
four application/database services with the first two files, then its test wrapper
adds the third file for the one-off Playwright run. The local helper supplies all
three files and selects the appropriate services for each command.

Internal ports are service contracts: OpenCart listens on 80, MySQL on 3306 and
FakeStore on 6400. Configuring a different published host port changes access from
the Mac while preserving container URLs such as `http://fakestore:6400`.

`${APP_ENV:-qa}` uses Compose's `:-` default operator: `qa` is the value when
`APP_ENV` is unset or empty. The local helper supplies `local-docker`; GitHub
Actions supplies `qa` (quality assurance). This labels the environment; service
URLs are configured separately.

The workflow display name remains **Playwright Web, API and DB Tests**. Its
**Check FakeStore API and OpenCart URL helpers** step checks the two application
helpers before the separate step that runs the Playwright Web/API/DB suite.

The workflow runs on pushes and pull requests targeting `main`, and from
**Actions → Playwright Web, API and DB Tests → Run workflow**. Fork pull requests
and Dependabot runs skip the secret-dependent job. A GitHub Environment is not
required; configuration is repository-scoped.

## Playwright image and build cache

Each run checks out the tested commit and builds `docker/playwright/Dockerfile`
with the repository root as its context. The official
`mcr.microsoft.com/playwright:v<version>-noble` base supplies Node, browsers and
system libraries. CI reads `<version>` from the root lockfile and passes it as
`PLAYWRIGHT_VERSION`; the build also verifies the installed package matches.
When updating Playwright, update the lockfile and the Dockerfile's local-build
default together. The current default is 1.64.1.

`npm ci` runs in a layer after copying only `package.json` and `package-lock.json`.
Test code is copied afterwards, so changing tests does not invalidate the
dependency layer. Buildx restores and exports layers through the GitHub Actions
cache (`type=gha`, scope `playwright-linux-amd64`, `mode=max`). A cold or evicted
cache performs a full build. The image is loaded into the runner's Docker engine,
tagged with the tested commit SHA, and never pushed to a registry.

The root `.dockerignore` permits only runtime sources and manifests. Local
`.env` files, Git data, existing reports and host `node_modules` are excluded.
Credentials are passed only at runtime, by environment-variable name, through
`scripts/ci/run-tests-in-docker.sh`; database root passwords and the API signing
key are not forwarded to Playwright.

Local and CI runs share the opt-in test service in `docker-compose.test.yml`.
Compose attaches it to the application's default bridge network. Tests resolve
service names through Docker DNS and use container ports; published host ports
are not part of test-to-service traffic. No host networking or Docker Desktop
host-network option is required. `init: true` reaps child processes and a private
1 GB shared-memory area supports Chromium without sharing the host IPC namespace.

OpenCart's `OPENCART_HTTP_SERVER` retains its external URL, such as
`http://localhost:18086/opencart/upload/` locally. The CI application overlay also
supplies `OPENCART_INTERNAL_HTTP_SERVER=http://opencart/opencart/upload/`.
Generated storefront/admin configuration selects that predefined internal URL
only for requests whose Host authority matches the configured internal service.
External requests and CLI execution retain the public URL; arbitrary Host values
cannot become generated base URLs. Leaving the internal setting unset preserves
the original two-service configuration. Twelve PHP checks cover both URL forms,
default ports, admin links and unknown-host fallback.

The runner's UID/GID owns bind-mounted `reports/`, `allure-results/` and
`test-results/`; only output directories are mounted, so the container uses the
code and dependencies baked into the tested image. Playwright writes raw test
artifacts under `test-results/run/`, allowing it to clear that directory without
removing a mount point or changing permissions on the application directory.
The test process's exit code is returned to the workflow. Existing artifact
uploads and stack cleanup still
run after a test failure.

The Docker actions are pinned to stable releases setup-buildx 4.4.1 and
build-push 7.4.0. See [Docker's cache configuration](https://docs.docker.com/build/ci/github-actions/cache/),
[local image loading](https://docs.docker.com/build/ci/github-actions/test-before-push/)
and [Playwright's Docker requirements](https://playwright.dev/docs/docker).

## Repository secrets

Under **Settings → Secrets and variables → Actions → Secrets**, configure the
following names with dedicated CI values. Never put values in tracked files or
`.env.example`. Existing public FakeStore secrets named `USERNAME`/`PASSWORD` are
not used by this workflow and do not need to be changed.

| Secret | Purpose |
| --- | --- |
| `APP_EMAIL` | Customer created in the fresh OpenCart database |
| `APP_PASSWORD` | OpenCart customer password |
| `ADMIN_USERNAME` | OpenCart administrator username |
| `ADMIN_PASSWORD` | OpenCart administrator password |
| `DB_PASSWORD` | MySQL application/test account password |
| `OPENCART_DB_ROOT_PASSWORD` | Separate MySQL initialization/root password |
| `FAKESTORE_CI_USERNAME` | Dedicated synthetic FakeStore user 1 login |
| `FAKESTORE_CI_PASSWORD` | Synthetic FakeStore user 1 password |
| `FAKESTORE_JWT_SECRET` | Random JWT signing key, at least 32 bytes |
| `FAKESTORE_MONGO_PASSWORD` | MongoDB application account password |
| `FAKESTORE_MONGO_ROOT_PASSWORD` | Separate MongoDB initialization/root password |

The MongoDB application account has `readWrite` only on the fixture database;
the API does not receive the MongoDB root password. All application passwords
are runtime inputs rather than image build arguments.

## Repository variables and fixed settings

These five repository Variables configure OpenCart:

| Variable | Suggested value |
| --- | --- |
| `DB_USER` | `opencart_test` (not root) |
| `DB_NAME` | `openshop` |
| `PRODUCT_NAME` | `MacBook` |
| `PRODUCT_QUANTITY` | `1` |
| `TOTAL_PRICE` | `$602.00` |

The workflow fixes the controlled API URL to `http://fakestore:6400`, product/user/
cart IDs to 1, limit to 3, and dates to `2020-01-01` through `2020-03-02`, matching
the versioned synthetic dataset. Former public-API repository Variables are unused.
The API login maps from `FAKESTORE_CI_USERNAME`/`FAKESTORE_CI_PASSWORD` Secrets into
`USERNAME`/`PASSWORD` for Playwright and into `API_USERNAME`/`API_PASSWORD` for the
API container, so startup and tests use the same account.

OpenCart similarly maps `DB_*` to container settings, `APP_*` to
`OPENCART_TEST_*`, and `ADMIN_*` to `OPENCART_ADMIN_*`. Its installer uses a synthetic
administrator email, `admin@example.test`. CI never creates or copies a `.env` file.

## Startup, selection, reports, and cleanup

Validation runs with `node scripts/ci/validate-env.mjs --with-api`, failing with
missing configuration names only. Docker builds both applications and waits up to
300 seconds after the build for all four service health checks. The API connects
to authenticated MongoDB and seeds a new fixture database before becoming healthy.
See [the controlled API notes](../docker/fakestore/README.md) for upstream provenance,
compatibility changes, and seeding rules.

CI first runs four API service integration checks: real JWT signature/expiration,
simulated writes preserving MongoDB data, restricted database access, and repeatable
initialization that rejects changed credentials, plus twelve OpenCart URL-selection
checks. Then Playwright runs the selected
suite with its existing assertions, browser configuration, and reporters.

| Suite | Tag / coverage |
| --- | --- |
| `test:master` | `@master`; all 94 scenarios (automatic/manual default) |
| `test:opencart` | `@web` or `@db`; 27 OpenCart/database scenarios |
| `test:api` | `@api`; 67 controlled FakeStore scenarios |
| `test:sanity` | `@sanity` |
| `test:regression` | `@regression` |
| `test:e2e` | `@end-to-end` |
| `test:web` | `@web`, including browser-based DB journeys |
| `test:db` | `@db` |
| `test:datadriven` | `@datadriven` |

Automatic runs use Chromium. Manual runs also offer Firefox and WebKit. Tags are
selected on the command rather than through a global Playwright filter. Full CI
always provisions the complete stack, including when a smaller suite is selected.

Configured reporters produce HTML/JUnit under `reports/` and Allure results under
`allure-results/`. CI uploads both after successful or failed Playwright runs,
with seven-day retention. Reports/traces can contain submitted CI credentials and
synthetic data; GitHub log masking does not sanitize artifact contents. Restrict
artifact access appropriately and use only dedicated disposable test identities.

Every run uses an `opencart-ci-<run>-<attempt>` Compose project with fresh volumes.
Cleanup uses both Compose files and removes only that run's project and volumes.
It must never be run against the existing local `framework1-opencart` project.

## Local use

### Full Docker Desktop stack

From the project root, run:

```sh
node scripts/ci/local-docker.mjs
```

This builds the current test image using Docker's local layer cache, starts
OpenCart/MySQL and controlled FakeStore/MongoDB, waits for their health checks,
runs the four API service checks, twelve OpenCart URL-selection checks and then
all 94 Playwright scenarios in Chromium.
Node on the host only orchestrates Docker; host npm dependencies or browser
installations are not required. The local project is named `opencart-local-ci`
in Docker Desktop. The test container belongs to the same project and is removed
after the run; the four application/database containers remain running.

| Service | Address from the Mac | Address inside the bridge network |
| --- | --- | --- |
| OpenCart | `http://localhost:18086/opencart/upload/` | `http://opencart/opencart/upload/` |
| MySQL | `127.0.0.1:13316` | `database:3306` |
| Controlled FakeStore | `http://127.0.0.1:16406` | `http://fakestore:6400` |
| MongoDB | Not published | `fakestore-database:27017` |

The existing `framework1-opencart` project and root `.env` are preserved. This
explicit pre-push replica uses its own named volumes and generated synthetic
credentials, stored privately in ignored `.docker-local/runtime.json`. The helper
passes `--env-file` with the null device, so Compose does not import the root
`.env`. Retain the private configuration while retaining this stack's volumes;
the stored databases expect the same credentials on subsequent starts. Ports can
be changed in that JSON file before the next start.

All five services use `opencart-local-ci_default`, a Compose-managed bridge
network. Normal Docker Desktop networking is sufficient; the host-networking
feature can remain disabled. See
[Compose networking](https://docs.docker.com/compose/how-tos/networking/).

```sh
# Start/wait for applications without running tests.
node scripts/ci/local-docker.mjs up

# Choose a suite/browser; trailing arguments are passed to Playwright.
node scripts/ci/local-docker.mjs test test:master firefox
node scripts/ci/local-docker.mjs test test:api chromium

# Inspect or stop only this project.
node scripts/ci/local-docker.mjs status
node scripts/ci/local-docker.mjs stop

# Remove only this project's containers/network; retain its data and credentials.
node scripts/ci/local-docker.mjs down
```

Outputs are separated from other runs: HTML/JUnit in `reports/local-docker/`,
Allure in `allure-results/local-docker/`, and raw artifacts in
`test-results/local-docker/run/`. A test failure returns a nonzero exit code while
keeping the stack and reports available for investigation.

### Existing host-side local runs

Local OpenCart tests continue using the existing containers and ignored `.env`.
Local API tests continue using the public API and the existing FakeStore demo-user
configuration in that file:

```sh
bash scripts/ci/run-tests.sh test:api chromium
```

This selects 67 API tests without launching a browser. The local API URL, username,
password, IDs, limit, and date range come from the local environment. The CI-only
MongoDB and JWT settings are not required for these public API runs.

For discovery or configuration checks:

```sh
node --test scripts/ci/*.test.mjs
bash scripts/ci/run-tests.sh test:master chromium --list
```

The root lockfile remains committed, and the controlled service has its own
committed npm lockfile. The existing stable action versions are checkout 7.0.1,
setup-node 7.1.0, and upload-artifact 7.0.2. Runtime/library versions and provenance
for the new service are listed in its README.

## Evidence and limits

The [original hosted full-suite run](https://github.com/gurevmark/opencart-playwright-framework/actions/runs/41710064983)
passed 27 OpenCart/database tests while all 67 public FakeStore requests were
challenged by Cloudflare (HTTP 403 with `cf-mitigated: challenge`). The temporary
OpenCart-only workflow subsequently passed. The controlled API removes that public
network dependency from CI; it does not establish public FakeStore availability.

Local acceptance on 2026-11-04 used a separate four-container project, synthetic
runtime credentials, no `.env` in the worktree, and all 94 existing framework
scenarios passed. Four additional service integration checks and five configuration
validation checks passed. The original local `.env`, root lockfile, and existing
OpenCart/MySQL containers were preserved.

Bridge-network acceptance on 2026-11-04 built the test image natively for Linux
ARM64 through Docker Desktop. The full local command passed all 94 scenarios in
24.8 seconds; a separate disposable CI-style stack passed all 94 through
`scripts/ci/run-tests-in-docker.sh` in 25.8 seconds. The running local test container
was observed on `opencart-local-ci_default`. Both paths used service DNS/internal
ports and private browser shared memory.

Nine configuration checks, twelve OpenCart URL-selection checks, four API service
checks and workflow/shell syntax validation passed. Chromium, Firefox and WebKit
launched as UID 1001. An intentional timeout returned exit code 1 while writing
readable HTML/JUnit/Allure outputs; an unsupported suite returned exit code 2.
Storefront and admin responses fetched from the Mac retained their external
localhost base URLs. The original local container IDs/start times, root `.env`
and saved full-stack credentials were unchanged. The disposable stack was
removed; the four local full-stack services remain running and healthy.

The npm dependency layer was reused (`CACHED`) during these builds. An earlier
isolated source-only probe also confirmed fresh test code with the npm layer
cached and a sentinel `.env` absent from the image. The exact hosted Linux AMD64
job and GitHub cache export/restore still require an Actions run after publication.
No registry publication or hosted run was performed during local acceptance.
