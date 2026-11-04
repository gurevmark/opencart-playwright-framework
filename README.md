# OpenCart Playwright Testing Framework

A TypeScript test framework for OpenCart storefront/admin journeys, MySQL validation,
and FakeStore REST API contracts. Browser tests use page objects and fixtures; API
tests use Playwright's request fixture. Docker supports the existing local OpenCart
installation and a separate, reproducible stack with a controlled FakeStore service.

**Start here:** [documentation index and source-of-truth map](docs/README.md).
**Agents:** read [AGENTS.md](AGENTS.md) before changing the repository.

## Find what you need

| Need | Read |
| --- | --- |
| Understand the structure and data flow | [Architecture](docs/ARCHITECTURE.md) |
| Configure URLs, accounts, database access, and container ports | [Configuration](docs/CONFIGURATION.md) |
| Select tests, browsers, and validation commands | [Testing](docs/TESTING.md) |
| Operate the existing OpenCart/MySQL containers | [Local Docker guide](docker/README.md) |
| Run the complete isolated stack or configure GitHub Actions | [CI and full Docker setup](docs/CI.md) |
| View HTML/JUnit reports and inspect Allure output | [Report formats and viewing](docs/TESTING.md#docker-ci-and-reports) |
| Add or change tests and keep documentation current | [Contributing](CONTRIBUTING.md) |
| Understand the original requirements and generation templates | [Prompt catalog](prompts/README.md) |

Suite details: [OpenCart web](tests/web/README.md), [FakeStore API](tests/api/README.md),
and [MySQL / combined journeys](tests/db/README.md).

The local Allure generator is delivered separately. Its
[implementation guide](https://github.com/gurevmark/opencart-playwright-framework/blob/a299c994ce375dcddf3f86116a88ff2fd9f7187c/docs/REPORTS.md)
applies to checkouts containing that change; the reporting section above covers
the outputs already produced by this framework.

## Use the existing local environment

Run commands from the repository root. Use Node.js 24 or a newer compatible LTS
with npm 10 or newer; CI selects `lts/*`. For host-side tests, install the locked dependencies
and the browser you intend to run:

```sh
npm ci
npx --no-install playwright install chromium
```

If `.env` does not exist, copy [.env.example](.env.example) to `.env` and fill in
your own test configuration. Keep an existing `.env` intact. The example intentionally
has blank credentials; it does not provision accounts. See [configuration](docs/CONFIGURATION.md)
for the required accounts and the difference between test inputs and container setup.
Full-suite discovery also reads the API IDs, limit, and date settings at import
time. Fill in `USER_ID`, which is blank in the example; see
[discovery prerequisites](docs/TESTING.md#discover-without-executing-tests) for
commands confined to one area.

```sh
# Inspect the existing OpenCart/MySQL services before connecting.
docker compose ps

# Discover tests without contacting the applications or launching a browser.
bash scripts/ci/run-tests.sh test:master chromium --list --reporter=list

# Run against the configured OpenCart and MySQL after checking their settings.
bash scripts/ci/run-tests.sh test:opencart chromium

# Run API contracts against API_BASE_URL; no browser is launched.
bash scripts/ci/run-tests.sh test:api chromium
```

`test:*` names are arguments to the shell runner, not npm scripts. Tests run headlessly.
OpenCart tests create or change test records, and the `@web` selection includes
browser journeys that also require MySQL. The API target comes from configuration;
the example uses the public FakeStore service. Read the [testing guide](docs/TESTING.md)
before running against shared data.

## Run a separate complete Docker stack

With Node.js and Docker Desktop available, this existing helper builds the test
image, starts its own OpenCart/MySQL and controlled FakeStore/MongoDB services,
and runs the full Chromium suite:

```sh
node scripts/ci/local-docker.mjs
```

Host npm dependencies and browser installations are not required for this path.
The helper uses the separate `opencart-local-ci` project and private generated
credentials; it leaves the application containers running after tests. See
[full Docker Desktop setup](docs/CI.md#full-docker-desktop-stack) for ports, reports,
selection, and stop/remove commands. Controlled API results describe that service
and its synthetic fixtures, rather than the availability of the public deployment.

Use `npm ci` for ordinary setup. [env_setup.sh](env_setup.sh) explicitly installs
latest dependencies and can change both manifests; it is an upgrade helper.
The project does not currently declare a TypeScript compiler dependency; see
[type checking](docs/TESTING.md) before assuming `npx tsc` is a reproducible check.
