# GitHub Actions setup

## Choose a test run

| Task | Where to start |
| --- | --- |
| Check the stack locally | Run `npm run test:sanity` from the repository root for the nine sanity cases. Use `npm test` for all 94. [Full Docker Desktop stack](#full-docker-desktop-stack) |
| Start a GitHub Actions run | Open **Actions → Playwright Web, API and DB Tests → Run workflow** and select the branch, suite and browser. Pushes to `main` and eligible PRs targeting `main` use `test:master` in Chromium. [CI configuration](#repository-secrets) |
| Test an existing OpenCart installation or another API endpoint | Set host addresses and test credentials in your local configuration. Pass `--output=test-results/host` to keep Docker captures separate. [Host runs and test discovery](#existing-host-side-local-runs) |
| Investigate an Actions failure | Open the first failed step in the `test` job to distinguish a setup error, test failure or failed artifact check. For published runs, open the Allure link on the run's **Summary**. [Report formats and access](REPORTS.md#open-a-ci-report) |

The workflow has four jobs. `trigger` identifies pushes produced by PR merges and skips their tests. `test` builds the stack, runs the suite and checks the diagnostic artifacts before upload. `report` builds HTML when the checked artifact contains at least one test result. `publish` deploys it to Pages for direct pushes to `main` and manual runs on that branch. Fork pull requests and Dependabot runs fail the required check before checking out code or using repository secrets. [Workflow definition](../.github/workflows/playwright.yml)

Automatic CI selects **94 Playwright scenarios** in one headless Chromium project
on an Ubuntu GitHub-hosted runner. Of these, **27** cover OpenCart web/database
journeys and **67** exercise the controlled FakeStore compatibility fork. Public
FakeStore availability is a separate check against the public endpoint.

The test job uses Node for configuration checks and reading the lockfile.
It builds the test image and starts four application/database containers:

| Application | Database | Address inside the test container |
| --- | --- | --- |
| OpenCart | MySQL | `http://opencart/opencart/upload/`; MySQL `database:3306` |
| Controlled FakeStore API | MongoDB | `http://fakestore:6400`; MongoDB `fakestore-database:27017` is used only by the API |

The base `docker-compose.yml` defines the two-service OpenCart stack. CI adds
`docker-compose.ci.yml` for controlled FakeStore. Host-side API tests read
`API_BASE_URL` from the host environment or local `.env`. The example points
to the public service. [Environment template](../.env.example)

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

Automatic tests run on direct pushes to `main` and when a PR targeting `main`
is opened. GitHub also creates a push run after a PR merge. The `trigger` job
uses GitHub's associated PR and merge SHA to skip tests and reports in that run,
including squash and rebase merges. A failed API lookup fails the required check.
Manual runs remain available under **Actions → Playwright Web, API and DB Tests
→ Run workflow**.

The `test` check from GitHub Actions is required on `main`, including for
administrators. Adding commits to an open PR does not automatically run tests.
Use **Run workflow** on its branch to test the latest commit before merging.
Rerunning an older run tests its original commit. Direct pushes also need a
passing check on the pushed commit, so test the commit on a branch first.
Test configuration is repository-scoped. Pages publication uses the
`github-pages` environment.

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
The test process's exit code is returned to the workflow. After a test failure
the workflow still attempts artifact verification and stack cleanup. Both
diagnostic uploads require the verification step to pass.

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
| `verify:allure-failure` | Manual acceptance check that intentionally fails one product-limit assertion |

Automatic runs use Chromium. Manual runs also offer Firefox and WebKit. The shell
wrapper selects the suite by tag. CI provisions the full stack even for a smaller
suite. With `CI=true`, the Playwright config selects one worker and up to two retries.
[Suite selection](../scripts/ci/run-tests.sh) · [Playwright config](../playwright.config.ts)

The filtered reporter writes HTML/JUnit to `reports/` and Allure JSON to
`allure-results/`. CI exercises the reporter with a synthetic failure and retry,
requires fresh directories for the actual suite and checks its
`test-results/run/report-artifacts.ready` marker. The upload check inspects the
HTML's embedded ZIP, JUnit XML and Allure JSON for the four required OpenCart
customer/admin values and the configured API, database and signing secrets
listed by the verifier. Checked files from passing or failing runs are available
as Actions artifacts for seven days. [Upload check](../scripts/ci/verify-report-privacy.py)

Private captures (screenshots, traces, videos and failure context) are written
under `test-results/run/` and excluded from upload. The separate `list` reporter
writes to the job console. Assertion diffs there can contain response data,
including password fields. Check logs before sharing them. [Report formats and visibility](REPORTS.md#what-is-public)

Every run uses an `opencart-ci-<run>-<attempt>` Compose project with fresh volumes.
Cleanup uses both Compose files and removes only that run's project and volumes.
It must never be run against the existing local `framework1-opencart` project.

## GitHub Pages deployment

In **Settings → Pages → Build and deployment**, set **Source** to **GitHub
Actions**. Under **Settings → Environments → github-pages**, allow deployments
from the `main` branch. The workflow publishes on direct pushes to `main` and
manual runs on that branch. PR merges skip tests and publication. PR reports
are available as artifacts.

If Actions was paused for credential rotation, first merge the reporter and
upload checks into `main`. Then select **Actions → Playwright Web, API and DB
Tests → Enable workflow** before running the acceptance checks below.

The read-only `report` job downloads the test job's raw artifact by ID, lists
the checked-out tests without application secrets, and generates a sanitized
Allure 2 HTML file. It runs after failed tests when raw results exist.
Only `publish` has `pages: write` and `id-token: write`. It uses `contents: read`
for the assembly script and `actions: read` for archived HTML. It verifies each
historical artifact's repository, workflow, event and run ID, and checks that its
commit belongs to the history of `main`.
Publications queue while tests can run concurrently. After deployment, CI
compares the live file with the packaged file before adding the run-specific
link to Summary. See [report contents and retention](REPORTS.md#open-a-ci-report)
and [GitHub's Pages workflow requirements](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

To check both outcomes, manually run `test:master` and then
`verify:allure-failure` on `main`. The latter requests 999 products from the
small fixture catalog and runs one existing assertion with retries disabled.
Expect a failed `test` job, successful `report` and `publish` jobs, and one failed
test in the linked Allure report. Reopen the first Summary link to verify it
still displays the original passing run.

## Local use

### Full Docker Desktop stack

From the project root, run:

```sh
npm test
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

The npm scripts select the same suites listed above and use Chromium by default:

```sh
npm run test:master       # All scenarios; equivalent to npm test
npm run test:opencart     # OpenCart web and database scenarios
npm run test:sanity
npm run test:regression
npm run test:e2e
npm run test:api
npm run test:web
npm run test:db
npm run test:datadriven

# Arguments after -- go to the Docker helper: browser, then Playwright options.
npm run test:sanity -- firefox
npm run test:api -- chromium --list
npm run test:web -- chromium tests/web/shopping.spec.ts
```

When passing Playwright options, include the browser first, even for Chromium.
These commands run the tests in Docker Desktop using the existing helper; Node
and npm are required on the host, while browsers and test dependencies come from
the test image. The direct `node scripts/ci/local-docker.mjs` command is still
available.

Even with `--list`, the helper builds the image, starts or reuses the stack,
waits for all four services and runs their checks. Playwright then replaces
the Docker HTML/JUnit and adds skipped entries to the Docker Allure results.
For discovery that preserves reports, use the clean-checkout catalog command
in [Existing host-side local runs](#existing-host-side-local-runs). [Docker helper](../scripts/ci/local-docker.mjs)

```sh
# Start/wait for applications without running tests.
node scripts/ci/local-docker.mjs up

# Inspect or stop only this project.
node scripts/ci/local-docker.mjs status
node scripts/ci/local-docker.mjs stop

# Remove only this project's containers/network; retain its data and credentials.
node scripts/ci/local-docker.mjs down
```

The helper loads the runtime configuration even for `status`, `stop` and
`down`. A missing file triggers credential generation. A malformed file stops
the helper before it calls Docker. To inspect existing containers without
initializing a file, query Docker directly.

```sh
docker ps -a --filter label=com.docker.compose.project=opencart-local-ci
```

Outputs are separated from other runs: HTML/JUnit in `reports/local-docker/`,
Allure in `allure-results/local-docker/`, and raw artifacts in
`test-results/local-docker/run/`. A test failure returns a nonzero exit code while
keeping the stack and reports available for investigation.

### Existing host-side local runs

Host-side runs require local npm dependencies. Browser-based tests also require
the selected browser on the host. Check the existing OpenCart/MySQL addresses
and test account before a web or database run. API tests use the configured
FakeStore endpoint and its credentials. The following example selects the 67
HTTP scenarios in one project without launching a browser.

```sh
bash scripts/ci/run-tests.sh test:api chromium tests/api --output=test-results/host
```

Use the separate host capture directory on every host-side test run.
Playwright clears its output directory before running tests. The shell wrapper
defaults to the parent `test-results/`, which also contains the Docker captures.
Reserve `allure-report/` for the generated local site. [Capture locations](REPORTS.md#local-reports) · [Known issues](KNOWN_ISSUES.md)

For a configuration check or a list of tests in the working copy:

```sh
node --test scripts/ci/*.test.mjs
PRODUCT_ID=1 USER_ID=1 CART_ID=1 LIMIT=3 START_DATE=2020-01-01 END_DATE=2020-03-02 \
  bash scripts/ci/run-tests.sh test:master chromium --output=test-results/host --list
```

`--list` skips the test bodies but the configured reporter replaces
`reports/index.html` and `reports/results.xml`. It also adds a skipped result
for each listed case to `allure-results/`. Save the previous HTML/JUnit if you
need them. To list tests without writing those reports, run the CI catalog command
in a separate checkout with dependencies installed, no `.env`, and no credential
or reporter-override variables. The six selectors below match the fixture
catalog. The reporter guard requires the exact Playwright arguments shown.

```sh
PRODUCT_ID=1 USER_ID=1 CART_ID=1 LIMIT=3 START_DATE=2020-01-01 END_DATE=2020-03-02 \
  npx --no-install playwright test --list --reporter=json --project=chromium
```

The catalog is written to standard output. [Reporter guard](../scripts/ci/reporters/options.cjs)

The root lockfile and the controlled service's lockfile are committed. The
workflow uses checkout 7.0.1, setup-node 7.1.0 and upload-artifact 7.0.2.
[Controlled service versions and provenance](../docker/fakestore/README.md#runtime-and-provenance)

## Evidence and limits

These entries record earlier runs. For the status of a new change, use the
workflow run associated with its commit.

On **2026-11-05**, a fresh local Compose project built the working-tree image and
ran the CI Docker wrapper in Chromium. All **94 passed**, with zero skipped,
failed or errored tests in JUnit. The 4 FakeStore checks, 12 OpenCart URL checks,
14 CI helper tests, 4 reporter regression tests and the upload privacy check
passed. The temporary project and volumes were removed. Discovery in a clean
copy listed 94 per browser project. This run exercised the local CI path through
artifact verification. Hosted Actions and Pages were outside its scope.

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
removed. The four local full-stack services were healthy at the end of that run.

The npm dependency layer was reused (`CACHED`) during these builds. An earlier
isolated source-only probe also confirmed fresh test code with the npm layer
cached and a sentinel `.env` absent from the image. All 94 tests subsequently
passed on the hosted Docker runner in [the baseline run before Pages publication](https://github.com/gurevmark/opencart-playwright-framework/actions/runs/41902002814).
