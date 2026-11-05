# OpenCart Playwright Testing Framework

This TypeScript project tests two systems. OpenCart scenarios use the storefront, the administration UI and MySQL to check what happens to a customer or a cart. FakeStore scenarios send HTTP requests to the authentication, product, user and cart endpoints. The standard Docker run uses the project's controlled FakeStore service and a seeded MongoDB database.

## First run in Docker

Run these commands from the repository root with Node.js, npm and a running Docker engine with Compose available. The helper builds the Playwright image and supplies the browsers, test dependencies and synthetic accounts.

```sh
node --version
docker compose version
docker info --format '{{.ServerVersion}}'
npm run test:sanity
```

The first invocation generates random passwords and saves them in the ignored
`.docker-local/runtime.json`, readable only by its owner. The helper passes matching
credentials to MySQL, MongoDB, OpenCart's administrator and customer setup, the
controlled FakeStore API and Playwright. This full Docker mode supplies its own
configuration and does not read the root `.env`.

On the first run, allow time for the images to build and four services to become healthy. The helper checks FakeStore and the OpenCart URLs, then runs nine headless smoke tests. A successful command exits with code 0. Open `reports/local-docker/index.html` to see the result of each test. Use `npm test` to run the full suite.

The four application and database containers stay up in the `opencart-local-ci` project after the test runner exits. The default storefront is available [on localhost](http://localhost:18086/opencart/upload/). Later runs reuse the generated credentials and persistent volumes. Keep `.docker-local/runtime.json` for as long as you keep those volumes. [Configuration sources](docs/CONFIGURATION.md#configuration-ownership-and-precedence)

```sh
node scripts/ci/local-docker.mjs status
node scripts/ci/local-docker.mjs stop
```

## Select a suite

Use `npm run <suite>` from the repository root. To pass a browser and Playwright options, put them after `--`. For example, this command runs only the three shopping tests in WebKit.

```sh
npm run test:web -- webkit tests/web/shopping.spec.ts
```

The npm scripts call the same Docker helper used in the suite guides. The equivalent direct invocation is `node scripts/ci/local-docker.mjs test test:web webkit tests/web/shopping.spec.ts`.

| Suite | Selection | Cases per browser project |
| --- | --- | ---: |
| `test:master` | Everything tagged `@master` | 94 |
| `test:opencart` | Union of `@web` and `@db` | 27 |
| `test:web` | All `@web` cases, including 14 MySQL-backed browser journeys | 26 |
| `test:db` | All `@db` cases, including one SQL-only connection test | 15 |
| `test:api` | FakeStore HTTP cases, which do not launch a browser | 67 |
| `test:sanity` | `@sanity` smoke checks | 9 |
| `test:regression` | `@regression` | 90 |
| `test:e2e` | `@end-to-end` workflows | 18 |
| `test:datadriven` | `@datadriven` cases | 35 |

The counts come from the November 5, 2026 catalog. Tags overlap. The [testing guide](docs/TESTING.md) explains how to check the current selection.

## Use the existing local environment

The existing OpenCart/MySQL stack uses the separate `framework1-opencart` Compose project. Host runs obtain credentials and service addresses from the root `.env` or exported variables. Supply accounts that already exist in the target services. Install the locked dependencies and the browser you intend to use.

```sh
npm ci
npx --no-install playwright install chromium
test -e .env || cp .env.example .env
docker compose ps
```

Check that the storefront and MySQL settings refer to the same test installation before running customer scenarios. For host runs, use `--output=test-results/host` to keep Docker captures. Full-suite discovery needs six FakeStore selectors. File-scoped examples, setup steps and their side effects are in the [development guide](docs/DEVELOPMENT.md).

## GitHub CI

Open a PR targeting `main` to run the full suite in Chromium. New commits and
reopening the PR trigger a fresh run. The required `test` check must pass before
merging. Merging does not start another run. **Run workflow** remains available
for manual suite and browser selection. Eligible PR runs provide **Open Allure
report** in Summary and downloadable reports. [CI setup](docs/CI.md) ·
[Reports](docs/REPORTS.md)

## Find what you need

| Task | Where to start |
| --- | --- |
| Navigate the repository or start work as an agent | [Documentation index](docs/README.md) · [Agent instructions](AGENTS.md) |
| Change a component, set up a target or verify a change | [Development guide](docs/DEVELOPMENT.md) · [Architecture](docs/ARCHITECTURE.md) · [Configuration](docs/CONFIGURATION.md) · [Contributing](CONTRIBUTING.md) |
| Work on a specific suite | [OpenCart web](tests/web/README.md) · [MySQL and customer journeys](tests/db/README.md) · [FakeStore API](tests/api/README.md) |
| Operate containers, configure CI or open a report | [Docker](docker/README.md) · [Controlled FakeStore](docker/fakestore/README.md) · [GitHub Actions](docs/CI.md) · [Reports and Allure](docs/REPORTS.md) |
| Investigate a defect or reproduce a finding | [Known issues and coverage gaps](docs/KNOWN_ISSUES.md) |
| Trace a scenario to course requirements | [Prompt catalog](prompts/README.md) |
