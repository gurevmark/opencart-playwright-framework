# Testing guide

Use this guide to choose a check, run the current suites, and interpret the result.
Return to the [documentation index](README.md) for the wider project map, read
[configuration](CONFIGURATION.md) before connecting to a target, and follow
[contribution guidance](../CONTRIBUTING.md) when changing tests.

The executable sources are [Playwright configuration](../playwright.config.ts),
the [suite wrapper](../scripts/ci/run-tests.sh), the specs under `tests/`, and the
[CI workflow](../.github/workflows/playwright.yml). A historical report or a listed
test is not evidence that the current target passes.

## Choose the check

| Check | Needs running applications? | What it establishes |
| --- | --- | --- |
| `node --test scripts/ci/*.test.mjs` | No | Environment-validator behavior and local Docker configuration generation/mapping, using synthetic inputs and temporary files |
| `php docker/opencart/http-server.test.php` | No; needs a PHP CLI | OpenCart public/internal URL-selection helper behavior |
| Playwright `--list` | No; needs installed npm dependencies and discovery-time configuration | Specs import and the requested tests are registered |
| TypeScript check | No; needs a separately supplied TypeScript compiler | Static checks covered by `tsconfig.json` |
| Playwright `@api` | FakeStore-compatible API | HTTP response, schema, filter, authentication, and simulated-write contracts |
| Playwright `tests/web` | OpenCart storefront | Customer and shopping behavior through a browser |
| Playwright `@db` | MySQL and, for the customer journeys, OpenCart storefront/Admin | Customer persistence/lifecycle and SQL connection cleanup |
| Controlled FakeStore service `npm test` | Its running API and authenticated MongoDB | Service integration, JWT, database permissions, simulated writes, and fixture initialization |

The last row runs inside the controlled API container as part of the local Docker
helper and CI. It is an integration check, not an offline Node unit suite.

## Prepare a host-side run

Run commands from the repository root. Use Node.js 24 or a newer compatible LTS
with npm 10 or newer, satisfying the [locked package engine requirements](../package-lock.json).
The Faker import used by the CommonJS framework also requires a runtime that
supports loading its ESM package. CI selects `lts/*`; the container image supplies
its own Node runtime. Install the committed dependency versions:

```sh
npm ci
```

For browser-backed tests, install the browser you will select:

```sh
npx --no-install playwright install chromium
```

Use `firefox` or `webkit` when preparing those projects, or omit the browser name
to install all configured browsers. Host browser/system requirements still apply.
API tests and `tests/db/db-client.spec.ts` do not request a browser fixture.

`env_setup.sh` intentionally installs the latest dependency versions and can change
the manifests and lockfile; use it only for a deliberate dependency update. Normal
setup uses `npm ci`. A Playwright update must keep the Docker base version aligned
with the version resolved in the root lockfile.

The host runner does not start applications. Verify the existing OpenCart/MySQL
addresses and credentials before a live run; see [local containers](../docker/README.md).
Configure the selected API target separately. Existing process environment values
take precedence over dotenv-loaded values. The configuration guide lists the
variable names and the host/container distinction.

## Discover without executing tests

```sh
# List the complete suite for one project, using only the console reporter.
bash scripts/ci/run-tests.sh test:master chromium --list --reporter=list

# Limit imported files to the storefront specs.
bash scripts/ci/run-tests.sh test:web chromium tests/web --list --reporter=list

# Inspect the DB-only connection test without loading the other specs.
bash scripts/ci/run-tests.sh test:db chromium tests/db/db-client.spec.ts --list --reporter=list
```

Discovery imports spec modules and reads their JSON data. In particular,
`utils/fakestoreTestSupport.ts` reads `PRODUCT_ID`, `USER_ID`, `CART_ID`, `LIMIT`,
`START_DATE`, and `END_DATE` during import. The wrapper's tag filter does not limit
which files are imported: an unqualified `test:web` or `test:db` invocation can
therefore require these API settings too. Add a file/directory argument when only
that area's discovery is intended.

`--list` does not verify browser launch, network access, credentials, application
state, database permissions, or assertions. The console reporter avoids generating
the usual HTML/JUnit/Allure outputs for these inventory commands.

## Select a suite and browser

```sh
bash scripts/ci/run-tests.sh test:opencart chromium
bash scripts/ci/run-tests.sh test:api chromium
bash scripts/ci/run-tests.sh test:db chromium

# Storefront specs only; excludes the DB journeys tagged @web in tests/db.
bash scripts/ci/run-tests.sh test:web chromium tests/web

# Extra arguments are forwarded to Playwright.
bash scripts/ci/run-tests.sh test:regression webkit --workers=1
```

The `test:*` names below are positional arguments to the shell wrapper. They are
not npm scripts. The root manifest does not define these suite commands.
Local Allure generator commands belong to a separate implementation change.

| Wrapper suite | Selected title tags | Scope |
| --- | --- | --- |
| `test:master` | `@master` | All current framework scenarios |
| `test:opencart` | `@web` or `@db` | OpenCart browser and database coverage |
| `test:web` | `@web` | Storefront specs plus browser-backed DB journeys |
| `test:db` | `@db` | Browser-backed customer journeys plus the DB-only connection test |
| `test:api` | `@api` | FakeStore HTTP tests |
| `test:sanity` | `@sanity` | Tagged authentication/list and storefront smoke scenarios |
| `test:regression` | `@regression` | Tagged regression scenarios across areas |
| `test:e2e` | `@end-to-end` | Workflows whose dependent steps stay inside a single test |
| `test:datadriven` | `@datadriven` | Tagged login rows, API boundaries, and DB validation variants |

Tags are embedded in test titles and can overlap. The wrapper applies a tag-ending
boundary, so a suite label selects the intended whole tag. File arguments and tags
intersect; a directory name alone does not express every suite's membership.

The wrapper defaults to `test:opencart` and `chromium`. Supply both arguments before
adding Playwright flags. Supported projects are `chromium`, `firefox`, and `webkit`,
using the Desktop Chrome, Firefox, and Safari device presets. API/DB-only tests
still belong to these projects even when they launch no browser.

There is no global `grep` in the Playwright config. A bare
`npx --no-install playwright test` selects all tests in all three projects; this
also repeats API requests and DB work per project. Prefer an explicit suite and
project for a focused run.

Playwright's [versioned CLI reference](https://github.com/microsoft/playwright/blob/v1.64.1/docs/src/test-cli-js.md)
and [tag selection reference](https://github.com/microsoft/playwright/blob/v1.64.1/docs/src/test-annotations-js.md)
describe the underlying flags; this repository's wrapper and configuration define
the defaults documented here.

## Runtime behavior

| Setting | Host default when `CI` is empty/unset | When `CI` is nonempty |
| --- | --- | --- |
| Browser display | Headless | Headless |
| Test timeout | 30 seconds | 30 seconds |
| `fullyParallel` | Enabled | Enabled |
| Workers | Playwright default | 1 |
| Retries after an initial failure | 0 | 2 |
| Focused `test.only` | Allowed by config | Rejected by `forbidOnly` |

The code tests whether `CI` is truthy; the string `CI=false` still enables CI
settings. Both the local Docker test service and GitHub Actions set `CI=true`.
The specs do not introduce serial groups or ordering dependencies. Workflows keep
their dependent steps within one test, while fixtures generate independent
customer data for DB journeys.

Current specs contain no `test.skip`, `test.fixme`, or expected-failure markers.
Missing required configuration, unavailable services, and browser-launch problems
fail the run rather than causing an automatic skip. The workflow separately skips
its secret-dependent job for fork pull requests and Dependabot; see [CI](CI.md).

## Integration prerequisites and data lifecycle

For storefront tests, `WEB_APP_URL` must reach the existing OpenCart installation.
`APP_EMAIL`/`APP_PASSWORD` must identify an enabled, unlocked reusable customer.
The successful JSON login row resolves those same environment credentials; tests
do not create or repair that configured account. Product settings must match the
installed catalog and its displayed currency/tax/quantity totals. The shopping
journey ends at cart validation and does not submit an order.

Browser contexts are isolated per test, and the page fixtures close their page
and context afterwards. This does not roll back server data. The ordinary
registration and shopping-journey specs in `tests/web` leave their generated
customers in OpenCart. Failed logins can also leave server-side attempt counters.
Negative data rows accept either the no-match warning or OpenCart's one-hour
lockout warning, so a throttled row establishes rejection without isolating the
underlying credential rule. The standalone invalid-login test uses a generated
email and requires the exact no-match warning.

DB journeys require direct access to the same MySQL database used by OpenCart,
the expected `oc_` tables, and permissions for their queries and scoped cleanup
deletes. Admin journeys also need working `ADMIN_USERNAME`/`ADMIN_PASSWORD` and
customer-management access. See the [DB suite notes](../tests/db/README.md) for
the schema assumptions and coverage.

`fixtures/dbFixtures.ts` and the registration spec clean up generated customers
in `finally` blocks. `utils/customerDb.ts` uses the captured customer ID and/or
generated email to remove the defined related rows and login-attempt records;
the ID keeps cleanup scoped after an email edit or Admin deletion. The missing-email
negative case uses its generated identity/contact marker rather than deleting
blank-email customers broadly. Cleanup is best effort: an interrupted process or
unavailable database can leave records behind. The DB-only connection spec causes
a controlled rejected `SELECT`, checks that its exact session closes, and creates
no business data.

Parallel tests use isolated browser contexts but share applications, configured
login accounts, and service limits. Retries repeat test actions and can create
additional records. For diagnosing authentication throttling or shared-service
contention, add `--workers=1` to a focused host run; this does not reset a locked
account or repair credentials.

API tests use `API_BASE_URL` or the public FakeStore fallback in `Routes.BASE_URL`.
They require an existing demo/fixture login, configured IDs/query inputs, and the
deterministic data contracts in `testdata/fakestore_api_data.json`. They send
`POST`, `PUT`, and `DELETE`, including updates/deletes against configured existing
IDs. Use a verified FakeStore-compatible test target with simulated writes.
The workflows validate responses and reuse generated IDs without proving
persistence or authenticating a newly created user. Public-service challenges or
data changes can fail host runs; passing against the controlled service establishes
that service's compatibility, not public FakeStore availability. See the
[API suite](../tests/api/README.md) and [controlled service](../docker/fakestore/README.md).

## Offline and static checks

```sh
node --test scripts/ci/*.test.mjs

# Optional when a local PHP CLI is available.
php docker/opencart/http-server.test.php
```

`scripts/ci/validate-env.mjs` is a CI presence check. It reads process environment
variables, not `.env`, and reports missing/blank names without supplied values.
`--with-api` adds controlled API/MongoDB requirements. It does not verify addresses,
credential validity, numeric/date formats, database permissions, or health. Its
offline tests provide their own synthetic environment.

`tsconfig.json` enables strict checking, but the root manifest and lockfile do not
declare `typescript`, and there is no `typecheck` npm script. Consequently,
`npm ci` alone does not provide a reproducible compiler check. If a compatible
TypeScript compiler has been provisioned explicitly, use its verified binary and
record its version:

```sh
# Set TSC_BIN to that compiler's absolute executable path first.
"$TSC_BIN" --version
"$TSC_BIN" --noEmit --project tsconfig.json
```

Do not treat an unpinned `npx tsc` download or Playwright's TypeScript transpilation
as the repository's type-check baseline. Adding a pinned compiler is a separate
dependency change.

## Docker, CI, and reports

For the full controlled local stack:

```sh
node scripts/ci/local-docker.mjs test test:master chromium
```

This is an explicit integration operation: it builds images, starts/waits for the
separate `opencart-local-ci` applications, runs service checks, and executes tests
with CI retry/worker settings. It creates/reuses private generated runtime
configuration and separate volumes, preserves the root `.env` and existing local
OpenCart project, and leaves the application containers running. Even passing
`--list` to this helper still performs startup and service checks first; use the
host discovery commands above for inventory only. See [CI and local Docker](CI.md)
for lifecycle commands, ports, credentials, image matching, and workflow behavior.

Normal runs keep the configured list, HTML, JUnit, and Allure reporters. Host
HTML/JUnit are written to `reports/`, Allure raw results to `allure-results/`, and
the wrapper's raw test artifacts to `test-results/`. Local Docker outputs use
their `local-docker/` subdirectories, with raw artifacts under
`test-results/local-docker/run/`. CI uploads HTML/JUnit and Allure outputs after
successful or failed test execution.

Screenshots are captured only on failure, videos are retained only on failure,
and traces are collected on the first retry. A default host run has no retries,
so it produces no first-retry trace unless retries are enabled explicitly. API and
DB-only tests have no browser video/screenshots. Overriding `--reporter` changes
which report artifacts are generated; keep configured reporters for CI uploads.

Reports can contain submitted credentials and test data. Use dedicated test
identities and review artifacts before sharing them. HTML/JUnit outputs and Allure
raw results have different retention/cleanup behavior; Allure results accumulate
between runs.

View the current HTML output with the installed Playwright CLI:

```sh
npx --no-install playwright show-report reports
# For the isolated local Docker run:
npx --no-install playwright show-report reports/local-docker
```

JUnit XML can be read directly or imported into a test-results viewer. Raw Allure
results are JSON and attachments, rather than a viewable HTML report. The local
Allure generator, its npm commands, and persisted history are delivered separately;
follow its [implementation guide](https://github.com/gurevmark/opencart-playwright-framework/blob/a299c994ce375dcddf3f86116a88ff2fd9f7187c/docs/REPORTS.md)
only in a checkout containing that change. This documentation branch does not add
the Allure service, helper, or npm scripts.
