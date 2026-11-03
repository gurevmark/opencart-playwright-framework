# GitHub Actions setup

The workflow runs headless Playwright tests against a new OpenCart/MySQL stack on
an Ubuntu GitHub-hosted runner. It uses repository-level configuration; a GitHub
Environment is not required. It runs on pushes and pull requests targeting `main`,
and can also be started from **Actions → Playwright Tests → Run workflow**.
Fork pull requests and Dependabot runs skip the secret-dependent job.

## Repository secrets

In **Settings → Secrets and variables → Actions → Secrets**, create these names.
Supply dedicated CI credentials; do not reuse your local OpenCart/database passwords.
No secret values belong in source files, this document, or `.env.example`.

| Secret | Purpose |
| --- | --- |
| `APP_EMAIL` | CI customer email; startup creates this account in the fresh database |
| `APP_PASSWORD` | CI customer password |
| `ADMIN_USERNAME` | Administrator username installed in the fresh OpenCart database |
| `ADMIN_PASSWORD` | Administrator password |
| `DB_PASSWORD` | Password for the non-root MySQL application/test account |
| `OPENCART_DB_ROOT_PASSWORD` | Separate MySQL root password, used for database initialization |
| `USERNAME` | Existing FakeStore demo API username |
| `PASSWORD` | Password for that FakeStore user |

The FakeStore credentials are independent of OpenCart. Creating a user through
FakeStore's simulated write API does not create a usable login account.

## Repository variables

In the **Variables** tab, add all the following names. These example values are
non-sensitive test configuration. API fixture IDs and date expectations target
FakeStore's demo dataset.

| Variable | Suggested value |
| --- | --- |
| `DB_USER` | `opencart_test` (must not be `root`) |
| `DB_NAME` | `openshop` |
| `API_BASE_URL` | `https://fakestoreapi.com` |
| `PRODUCT_NAME` | `MacBook` |
| `PRODUCT_QUANTITY` | `1` |
| `TOTAL_PRICE` | `$602.00` |
| `USER_ID` | `1` |
| `PRODUCT_ID` | `1` |
| `CART_ID` | `1` |
| `LIMIT` | `3` |
| `START_DATE` | `2020-01-01` |
| `END_DATE` | `2020-03-02` |

The workflow fixes `DB_HOST=127.0.0.1`, `DB_PORT=3306`, and
`WEB_APP_URL=http://localhost:8080/opencart/upload/` on the runner. OpenCart inside
Docker connects to `database:3306`. The installer uses a synthetic administrator
email, `admin@example.test`, with no real inbox requirement.

GitHub variables and secrets are explicitly mapped into the job's process
environment. There is no CI `.env` copy or generated `.env` file. The validation
step stops before dependency installation or container startup when a required
setting is missing or blank, reporting names only.

## Container and suite behavior

CI maps `DB_*` into Compose's `OPENCART_DB_*`, `APP_*` into `OPENCART_TEST_*`, and
`ADMIN_*` into `OPENCART_ADMIN_*`. Both tests and container initialization therefore
use the same accounts. Passwords are runtime environment inputs, not image build
arguments. The successful JSON login case reads `APP_EMAIL` and `APP_PASSWORD`;
the JSON/CSV/Excel examples contain environment references and retain their
synthetic failure rows.

Each CI job uses a unique `opencart-ci-<run>-<attempt>` Compose project and fresh
volumes. Startup waits for database and storefront health checks, with a
300-second wait limit after the image build. Cleanup removes only that CI project.
Your laptop's existing project and volumes are independent.

Manual suite choices map to tags as follows:

| Choice | Tag |
| --- | --- |
| `test:master` | `@master` (all tagged framework tests) |
| `test:sanity` | `@sanity` |
| `test:regression` | `@regression` |
| `test:e2e` | `@end-to-end` |
| `test:api` | `@api` |
| `test:web` | `@web` (also includes browser-based DB journeys) |
| `test:db` | `@db` |
| `test:datadriven` | `@datadriven` |

Automatic runs default to `test:e2e` in Chromium. Manual runs also offer Firefox
and WebKit. Suite selection belongs to the command, with no global config filter.
All configuration variables are required for every suite because API modules read
some settings during test discovery, even when another tag is selected.

The configured reporters create HTML and JUnit output in `reports/` and raw Allure
results in `allure-results/`. CI uploads both directories after a successful or
failed test run, with seven-day retention. It does not upload a custom report
while that reporter is disabled. Reports/traces may contain submitted test data;
GitHub log masking does not sanitize artifact contents. Use CI-only credentials
and review artifact access when sharing results.

The workflow uses stable action releases verified on 2026-11-03:
[checkout v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1),
[setup-node v7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0), and
[upload-artifact v7.0.2](https://github.com/actions/upload-artifact/releases/tag/v7.0.2).
They run on the hosted Ubuntu runner; Node uses the latest LTS. Application/test
dependency versions remain governed by the existing lockfile and `npm ci`.

## Local checks and first push

Local tests still load your ignored `.env`. See [the Docker notes](../docker/README.md)
before starting or recreating any existing containers. CI configuration must not
rotate passwords or reset data in your local volumes.

```sh
node --test scripts/ci/validate-env.test.mjs
bash scripts/ci/run-tests.sh test:e2e chromium --list
```

Before the first push, initialize the intended repository with `main`, confirm
that `.env` and generated reports/browser sessions are ignored, and review all
staged filenames and the staged diff locally. The lockfile must be included.
`.gitignore` does not remove a secret that has already been committed; any such
credential needs rotation and history cleanup before publication.

GitHub references: [secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets),
[variables](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-variables),
and [environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).

## Local acceptance evidence (2026-11-03)

- `npm ci` succeeded in a temporary project copy with no `.env`; the original lockfile stayed unchanged.
- A fresh image and isolated OpenCart/MySQL stack built and became healthy using throwaway acceptance credentials, separate from the fixed secrets required in GitHub.
- All 94 Chromium scenarios passed across two executions: 68 API/database checks passed initially; 26 UI checks hit a macOS sandbox browser-launch restriction, then all 26 passed headlessly outside that sandbox. This included customer login, administrator login, and the environment-backed JSON login row.
- All eight suite selectors discovered tests; Firefox/WebKit end-to-end discovery also passed. Their browser suites were not executed.
- An intentional failing test produced HTML, a JUnit failure testcase, and Allure results with the existing reporter configuration.
- Actionlint 1.7.12, three configuration-validation tests, and PHP/shell syntax checks passed. Independent review found one remaining credential example in a prompt; it was removed and the targeted credential scan then passed.
- A temporary Git index confirmed that `.env`, generated reports, and local browser sessions are excluded, while `.env.example` and the lockfile are included. No actual repository, commit, or push was created.
- The original local `.env` and the existing OpenCart/MySQL containers were preserved. Acceptance cleanup targets only its temporary Compose project.

These are local acceptance results. GitHub secrets/variables still need to be
configured, and hosted action execution, upload delivery, and cancellation cleanup
need the first GitHub run. `npm ci` also reported an existing high-severity `xlsx`
advisory with no registry fix available; dependency versions were not changed in
this CI work.
