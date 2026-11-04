# GitHub Actions setup

Automatic CI runs **all 94 Playwright scenarios** headlessly on an Ubuntu
GitHub-hosted runner: **27 OpenCart web/database tests** and **67 FakeStore API
tests against a controlled compatibility fork**. The API result describes the
controlled service, not the public `https://fakestoreapi.com` deployment.

The runner installs Node/Playwright and starts four Docker containers:

| Application | Database | Runner-side address |
| --- | --- | --- |
| OpenCart | MySQL | `http://localhost:8080/opencart/upload/`; MySQL `127.0.0.1:3306` |
| Controlled FakeStore API | MongoDB | `http://127.0.0.1:6400`; MongoDB has no published port |

The base `docker-compose.yml` remains the existing two-service local setup.
CI explicitly adds `docker-compose.ci.yml`. Your local `.env` continues to select
the public FakeStore API for local API runs.

The workflow runs on pushes and pull requests targeting `main`, and from
**Actions → Playwright Web, API and DB Tests → Run workflow**. Fork pull requests
and Dependabot runs skip the secret-dependent job. A GitHub Environment is not
required; configuration is repository-scoped.

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

The workflow fixes the controlled API URL to `http://127.0.0.1:6400`, product/user/
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

CI first runs four service integration checks: real JWT signature/expiration,
simulated writes preserving MongoDB data, restricted database access, and repeatable
initialization that rejects changed credentials. Then Playwright runs the selected
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
node --test scripts/ci/validate-env.test.mjs
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
