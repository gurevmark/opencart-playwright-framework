# Configuration reference

[Documentation index](README.md)

Use this document to identify which configuration a command consumes. The
tracked [`.env.example`](../.env.example) lists host-side starting settings;
it is not a loaded configuration file. Keep working values in an ignored `.env`
or the invoking process environment. No credentials belong in documentation.

For commands, use the [testing guide](TESTING.md), [local OpenCart container
guide](../docker/README.md), [CI guide](CI.md), and [reporting guide](TESTING.md#docker-ci-and-reports).
The sources linked below define the behavior if those guides drift.

## Configuration ownership and precedence

| Execution path | Configuration source and precedence | Scope |
| --- | --- | --- |
| Host Playwright | Exported process variables take precedence over root `.env`. [`playwright.config.ts`](../playwright.config.ts) loads `.env` by an absolute path with dotenv's default non-overriding behavior. Some helpers/specs also load dotenv without overriding. | Existing services selected by `WEB_APP_URL`, `API_BASE_URL`, and `DB_*`; no application startup in Playwright config. |
| Base local Compose | The shell environment takes precedence over root `.env` for Compose interpolation; YAML fallback expressions apply when values are unset or empty. | [`docker-compose.yml`](../docker-compose.yml), project `framework1-opencart`, OpenCart/MySQL and their persistent volumes. |
| Explicit local Docker replica | [`local-docker.mjs`](../scripts/ci/local-docker.mjs) merges inherited process variables with generated settings, with generated settings winning for every key it supplies. It passes `--env-file` with the OS null device, disabling root `.env` import. | Project `opencart-local-ci`; combines the base, application overlay, and test-service Compose files. |
| GitHub Actions | [Workflow](../.github/workflows/playwright.yml) `env` maps repository Variables/Secrets and fixed values. CI does not create `.env`; the test image excludes it. The Docker test wrapper also uses `--env-file /dev/null`. | A unique `opencart-ci-<run>-<attempt>` project with disposable application volumes. |

`APP_ENV` is a label: it does not select a separate file, URL, or database. The
test-service Compose file defaults it to `qa` when unset or empty; the local
Docker helper supplies `local-docker`. In Playwright config, any non-empty `CI`
value enables `forbidOnly`, two retries, and one worker. Tests remain headless in
both modes. Suite tags are selected by the
[test wrapper](../scripts/ci/run-tests.sh); there is no global `grep` in config.

Run host commands from the repository root: several dotenv calls use the current
working directory. The primary Playwright config and API support module resolve
the root `.env` explicitly. Neither `APP_ENV` nor setting a different shell
working directory is a supported environment-file selector.

## Framework inputs

Host-side setup uses Node.js 24 or a newer compatible LTS with npm 10 or newer;
see the [locked package engine requirements](../package-lock.json) and
[host preparation](TESTING.md#prepare-a-host-side-run). The test Docker image
supplies its own runtime.

The defaults below distinguish template values from real code fallbacks. Copying
`.env.example` does not provision accounts, and blank credential fields need
working dedicated test identities for the selected target.

| Variables | Template / fallback | Consumer |
| --- | --- | --- |
| `APP_ENV` | Template `qa`; test-service fallback `qa`; label only | [Test service](../docker-compose.test.yml), [workflow](../.github/workflows/playwright.yml), [local helper](../scripts/ci/local-docker.mjs) |
| `WEB_APP_URL` | Template `http://localhost/opencart/upload/`; required by web navigation | [Page fixtures](../fixtures/pageFixtures.ts), [HomePage](../pages/HomePage.ts), [AdminLoginPage](../pages/AdminLoginPage.ts) |
| `APP_EMAIL`, `APP_PASSWORD` | Blank in template; required for configured customer login | [`Helper.getLoginDetails`](../utils/helper.ts) |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Blank in template; required for administrator login | [`Helper.getAdminLoginDetails`](../utils/helper.ts) |
| `PRODUCT_NAME`, `PRODUCT_QUANTITY`, `TOTAL_PRICE` | Template and helper fallbacks: `MacBook`, `1`, `$602.00` | [`Helper.getProductDetails`](../utils/helper.ts) |
| `API_BASE_URL` | Template and code fallback `https://fakestoreapi.com`; container runs use `http://fakestore:6400` | [API support](../utils/fakestoreTestSupport.ts), [route constants](../api/endpoints/routes.ts) |
| `USERNAME`, `PASSWORD` | Blank in template; existing API login account required | [Authentication specs](../tests/api/auth.spec.ts); controlled API startup receives mapped copies |
| `USER_ID`, `PRODUCT_ID`, `CART_ID`, `LIMIT` | Template: blank `USER_ID`, IDs `1` for product/cart, limit `3`; API support requires all four | [API support](../utils/fakestoreTestSupport.ts) |
| `START_DATE`, `END_DATE` | Template `2019-12-10` / `2020-10-10`; required by API support. Controlled stacks set their own fixture range. | [API support](../utils/fakestoreTestSupport.ts) |
| `DB_HOST`, `DB_PORT`, `DB_NAME` | Template `localhost`, `3306`, `openshop`; DB client passes configured values to mysql2, with port omitted when absent | [DB client](../utils/dbClient.ts) |
| `DB_USER`, `DB_PASSWORD` | Template has a sample account name and blank password; use an existing account for the chosen database | [DB client](../utils/dbClient.ts) |
| `CI` | Not in template; unset for ordinary host runs, `true` in container runs | [Playwright config](../playwright.config.ts) |

The commented `BASIC_AUTH_*`, `API_KEY`, `ACCESS_TOKEN`, `CLIENT_ID`,
`CLIENT_SECRET`, `AUTHORIZATION_CODE`, and `TOKEN_URL` entries in `.env.example`
are placeholders. Current suites do not consume them. `TEST_ENV` and
`TEST_AUTHOR` occur only in the optional [custom reporter](../utils/CustomReporter.ts),
which is commented out in Playwright config; they do not replace `APP_ENV`.

## Application and Compose inputs

Framework keys configure the test process. Compose also uses some of them as
fallback inputs while configuring containers. This does not make all names
interchangeable: the base file explicitly maps host inputs to container
environment names.

| Host-side input | Fallback / default in Compose | Container consumer |
| --- | --- | --- |
| `OPENCART_DB_NAME` | `DB_NAME`, then `openshop` | MySQL `MYSQL_DATABASE`; OpenCart `DB_NAME` |
| `OPENCART_DB_USER`, `OPENCART_DB_PASSWORD` | Corresponding `DB_USER`, `DB_PASSWORD`; no usable credential defaults | MySQL `MYSQL_USER` / `MYSQL_PASSWORD`; OpenCart `DB_USER` / `DB_PASSWORD` |
| `OPENCART_DB_ROOT_PASSWORD` | No usable default; needed for a new MySQL volume | MySQL `MYSQL_ROOT_PASSWORD`; not forwarded to Playwright |
| `OPENCART_TEST_EMAIL`, `OPENCART_TEST_PASSWORD` | `APP_EMAIL`, `APP_PASSWORD` | OpenCart test-customer seeder |
| `OPENCART_ADMIN_USER`, `OPENCART_ADMIN_PASSWORD` | `ADMIN_USERNAME`, `ADMIN_PASSWORD` | OpenCart installer for an uninstalled database |
| `OPENCART_ADMIN_EMAIL` | A synthetic installer email | OpenCart installer |
| `OPENCART_HTTP_SERVER` | `http://localhost/opencart/upload/` | Generated storefront/admin public base URLs |
| `OPENCART_PORT` | `80` | Published OpenCart host port; container remains on `80` |
| `DB_PORT` | `3306` | Published MySQL host port; OpenCart/test containers remain on `3306` |
| `FAKESTORE_PORT` | `6400` | Published controlled API host port; API/test containers remain on `6400` |
| `FAKESTORE_MONGO_ROOT_PASSWORD` | Required by application overlay | MongoDB `MONGO_INITDB_ROOT_PASSWORD` |
| `FAKESTORE_MONGO_PASSWORD` | Required by application overlay | MongoDB application-user initialization and API `MONGODB_PASSWORD` |
| `FAKESTORE_JWT_SECRET` | Required; API validates at least 32 bytes | API `JWT_SECRET`; not forwarded to Playwright |
| `USERNAME`, `PASSWORD` | Required by application overlay | API `API_USERNAME` / `API_PASSWORD`; same account used by Playwright |

Authoritative mappings are in the [base](../docker-compose.yml) and
[application overlay](../docker-compose.ci.yml). `MYSQL_*`, `MONGO_INITDB_*`,
`MONGODB_*`, `API_USERNAME`, `API_PASSWORD`, `JWT_SECRET`, and API `PORT` are
container environment names, not additional root `.env` inputs in these files.
Exporting those names alone does not override an explicit Compose mapping.

OpenCart's container always receives `DB_HOST=database`, `DB_PORT=3306`, and
`DB_PREFIX=oc_` from the base file. The overlay supplies
`OPENCART_INTERNAL_HTTP_SERVER=http://opencart/opencart/upload/`; it is not an
interpolated root `.env` key. The generated config selects that predefined URL
only for requests matching its internal Host authority, and uses the public URL
otherwise. See [`configure.php`](../docker/opencart/configure.php) and
[`http-server.php`](../docker/opencart/http-server.php). The build-time
`OPENCART_VERSION` is fixed to `3.0.3.8` in the base Compose file; it is not a
runtime environment switch.

Keep framework and initialization settings aligned. An `OPENCART_DB_*`,
`OPENCART_TEST_*`, or `OPENCART_ADMIN_*` override changes the application side,
while Playwright still receives its own `DB_*`, `APP_*`, and `ADMIN_*` keys.
`WEB_APP_URL` and `OPENCART_HTTP_SERVER` also serve different consumers and must
describe the same storefront from their respective network locations.

## Addresses depend on where the command runs

These are configuration defaults, not a claim about currently running containers.
Inspect the existing project and published ports before connecting or changing
integration-test settings. Reuse the existing OpenCart/MySQL containers for
ordinary host-side runs; the explicit full Docker replica is a separate opt-in
target.

| Service | Base host-side setup | Full local Docker replica: host access | Application/test bridge network |
| --- | --- | --- | --- |
| OpenCart | `http://localhost/opencart/upload/` by default | `http://localhost:18086/opencart/upload/` | `http://opencart/opencart/upload/` |
| MySQL | `127.0.0.1:3306` by default; use the verified published `DB_PORT` | `127.0.0.1:13316` | `database:3306` |
| Controlled FakeStore | Not started by base Compose; host API tests normally target the public API | `http://127.0.0.1:16406` | `http://fakestore:6400` |
| MongoDB | Not started by base Compose | Not published | `fakestore-database:27017`, used by the API |
| [Separate Allure change](#separate-local-allure-generator) | When installed: `http://127.0.0.1:5051/allure-docker-service` | Same separate service | Listens on `5050` in its own project; not included in this documentation branch |

Service DNS names work inside the corresponding Compose network. `localhost`
inside the test container refers to that container. Changing a published host
port does not change internal service ports. The base MySQL, overlay FakeStore,
and Allure mappings bind to loopback; the OpenCart mapping has no explicit host-IP
restriction. CI sets OpenCart's published host port to `8080` and retains the
same internal addresses shown above. See [Compose topology](CI.md#compose-files-and-environment-labels).

## Isolated test-run settings

[`docker-compose.test.yml`](../docker-compose.test.yml) declares the opt-in
`tests` profile and forwards only named runtime inputs to the Playwright service.
The test container uses `CI=true`, fixed internal service addresses, and the
configured test identities; it does not receive MySQL/MongoDB root credentials
or the JWT signing key.

| Variables | Default / owner | Use |
| --- | --- | --- |
| `PLAYWRIGHT_VERSION` | Required by test-service build; local helper/workflow derive it from the root lockfile, CI wrapper falls back to the lockfile when unset | Version-matched official Playwright image; Dockerfile verifies package equality |
| `PLAYWRIGHT_TEST_IMAGE` | Compose fallback `opencart-playwright:local`; CI wrapper requires an explicit image | Locally built image tag |
| `TEST_UID`, `TEST_GID` | Required by test service; wrappers set caller UID/GID | Ownership of bind-mounted artifacts |
| `PLAYWRIGHT_REPORTS_DIR` | `./reports` | Host directory mounted at `/app/reports` |
| `PLAYWRIGHT_ALLURE_DIR` | `./allure-results` | Host directory mounted at `/app/allure-results` |
| `PLAYWRIGHT_RESULTS_DIR` | `./test-results` | Host directory mounted at `/app/test-results`; wrapper writes to child `run/` |
| `COMPOSE_PROJECT_NAME` | CI supplies its unique project; CI wrapper requires it; local helper uses explicit `opencart-local-ci` | Selects the application network/project, never a new credential set |
| `TEST_SUITE`, `TEST_BROWSER` | Workflow defaults `test:master`, `chromium` | Workflow passes these as wrapper arguments; host wrapper defaults `test:opencart`, `chromium` |

The [local helper](../scripts/ci/local-docker.mjs) generates its synthetic
credentials and three configurable published ports in ignored
`.docker-local/runtime.json` (new directory mode `0700`, new file mode `0600`).
Retain this private file with that project's volumes; startup expects the same
credentials. Its output mounts use `reports/local-docker/`,
`allure-results/local-docker/`, and `test-results/local-docker/`. It overrides
inherited values for its generated keys, so shell exports are not a way to
replace its stored passwords or ports.

[`env_setup.sh`](../env_setup.sh) explicitly installs dependencies at `latest`
and can install local browsers with `--with-browsers`; it changes package
manifests/lockfile rather than creating configuration. Use `npm ci` for an
ordinary reproducible install. Explicit dependency updates must retain a
committed lockfile and keep the Playwright image version aligned; see
[image/cache rules](CI.md#playwright-image-and-build-cache).

## Initialization, secrets, and readiness

Starting OpenCart can change persistent files/data. Its
[entrypoint](../docker/opencart/entrypoint.sh) validates required credentials,
detects installation state, installs when the prefixed settings table is absent,
regenerates storefront/admin configuration on every start, and
[creates the configured customer only when absent](../docker/opencart/seed-customer.php).
It does not update that customer's existing password. MySQL initialization
variables likewise do not rotate accounts stored in an existing volume.
Changing `.env` alone is not a credential-rotation procedure.

The controlled API [bootstrap](../docker/fakestore/seed.mjs) accepts its known
fixture version only when the configured login still matches. It refuses unknown
populated fixture collections or changed login credentials instead of resetting
data. MongoDB account initialization runs only for a new volume. Its simulated
API writes and fixture scope are documented in the
[controlled API guide](../docker/fakestore/README.md).

Store local secrets in ignored configuration and CI values in repository Secrets.
The complete GitHub Secrets/Variables mapping belongs in
[CI configuration](CI.md#repository-secrets). The image build contexts exclude
`.env`; passwords/signing keys are runtime inputs, not build arguments. Reports,
traces, screenshots, and API responses can contain submitted identities or
credentials, so keep test accounts disposable and control access to outputs.

Readiness comes from the declared health checks: MySQL authenticates as the
application account and executes `SELECT 1`; OpenCart fetches its storefront;
MongoDB authenticates and pings; FakeStore starts HTTP only after fixture
bootstrap, and `/health` pings MongoDB and returns the dataset identifier. The
local helper and CI wait up to 300 seconds after builds for the
application services, then run API and OpenCart URL-helper checks before tests.
[`validate-env.mjs --with-api`](../scripts/ci/validate-env.mjs) checks required
names for non-empty values; it does not prove credentials, permissions, or
network connectivity.

## Reports and Allure configuration

[Playwright config](../playwright.config.ts) enables list, HTML (`reports/`),
JUnit (`reports/results.xml`), and Allure (`allure-results/`) reporters. Reporter
paths inside the test image stay fixed; the `PLAYWRIGHT_*_DIR` settings above
select host bind-mount destinations. CI uploads `reports/` and `allure-results/`
after test success/failure with seven-day retention. `test-results/` is produced
but is not a separate workflow upload.

### Separate local Allure generator

The generator is delivered independently of this documentation branch. The
following settings describe that separate implementation, rather than a service
provided by the current branch. Use its
[implementation guide](https://github.com/gurevmark/opencart-playwright-framework/blob/a299c994ce375dcddf3f86116a88ff2fd9f7187c/docs/REPORTS.md)
when working in a checkout containing it.

There are no root `ALLURE_*` environment inputs in that service.
Its [Allure Compose file](https://github.com/gurevmark/opencart-playwright-framework/blob/a299c994ce375dcddf3f86116a88ff2fd9f7187c/docker-compose.allure.yml) fixes host port `5051`,
disables automatic generation (`CHECK_RESULTS_EVERY_SECONDS=NONE`), enables
history (`KEEP_HISTORY=1`), and retains 20 numbered reports
(`KEEP_HISTORY_LATEST=20`). Its helper defaults to project `host`, with
`local-docker` as the second explicit report source. Generated reports/history
are persisted under `allure-report/<source>/`; raw results remain under
`allure-results/` and `allure-results/local-docker/`.

Allure's health check fetches `/allure-docker-service/version`; it establishes
service readiness, not the presence of a generated test report. Generation is
explicit after tests finish and does not clear accumulated raw results. Use the
[report guide](https://github.com/gurevmark/opencart-playwright-framework/blob/a299c994ce375dcddf3f86116a88ff2fd9f7187c/docs/REPORTS.md) for lifecycle, viewing, and source-specific cleanup.
