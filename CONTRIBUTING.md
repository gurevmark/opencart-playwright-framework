# Contributing

[Overview](README.md) · [Documentation index](docs/README.md) · [Agent rules](AGENTS.md)

## Before changing the project

Read the [architecture](docs/ARCHITECTURE.md), then the relevant
[web](tests/web/README.md), [API](tests/api/README.md), or [DB](tests/db/README.md)
guide. Inspect existing fixtures, utilities, routes, schemas, and datasets before
adding equivalents. Scenario requirements and generation templates are cataloged
in [prompts/README.md](prompts/README.md).

Check `git status --short` and preserve unrelated work. Establish the configured
target and its prerequisites before running integration tests. Use
[.env.example](.env.example) to learn variable names; keep credentials in ignored
local configuration or CI Secrets. Never include secret values in documentation,
logs, test data, or review descriptions.

## Extend the existing layers

- Put UI interactions in [pages/](pages/), expose them through
  [page fixtures](fixtures/pageFixtures.ts), and keep assertions in specs. Reuse
  Playwright waiting and retried assertions instead of fixed sleeps.
- Put API route changes in [routes.ts](api/endpoints/routes.ts), response contracts
  in [schemas](api/schemas/), and deterministic datasets in [testdata/](testdata/).
  Respect FakeStore's simulated-write contract.
- Reuse [dbClient.ts](utils/dbClient.ts), [customerDb.ts](utils/customerDb.ts), and
  [DB fixtures](fixtures/dbFixtures.ts). Clean up only the records a test owns,
  including failure paths and related rows.
- Add meaningful tags in test titles and use the existing
  [suite runner](scripts/ci/run-tests.sh). Keep browser tests headless by default
  and keep suite filters out of the global Playwright configuration.

Test data is shared across browser projects and repeated runs. Use unique generated
customers where the scenario permits. Configured login accounts and existing
container volumes are persistent state; check their ownership before changing them.

## Validate a change

From the repository root, after `npm ci`, these checks do not require live
applications or start browsers:

```sh
node --test scripts/ci/*.test.mjs
bash scripts/ci/run-tests.sh test:master chromium --list --reporter=list
git diff --check
```

The reporter override above is for discovery, which produces no run artifacts.
Actual CI runs must retain the reporters expected by artifact uploads. Follow
[testing](docs/TESTING.md) for the targeted integration command and compiler
availability: TypeScript is used by Playwright but the project does not currently
declare a standalone `typescript` dependency. Do not mistake collection or
transpilation for a strict type check.

Run the checks appropriate to the changed layer. FakeStore service tests require
its controlled MongoDB-backed environment; `tests/db/db-client.spec.ts` also
requires a real MySQL connection. For a complete isolated run, use the existing
[full Docker helper](docs/CI.md#full-docker-desktop-stack). Verify connection settings
before using the existing local OpenCart/MySQL containers.

For documentation changes, verify relative links, commands against their scripts,
and claims against the owning sources. A live suite rerun is not required merely
to change prose. Describe exactly what you checked and what remains unverified.

## Dependencies and containers

Use `npm ci` for reproducible installs. Only add or update dependencies when the
task needs it; choose the latest stable compatible release and commit the changed
lockfile. [env_setup.sh](env_setup.sh) is an explicit dependency-upgrade helper.

Keep the Playwright version resolved by [package-lock.json](package-lock.json)
aligned with the default in [the test Dockerfile](docker/playwright/Dockerfile).
CI reads the lockfile version and passes it to the image build. The controlled
service has its own manifest and lockfile under [docker/fakestore/](docker/fakestore/).
The OpenCart/PHP compatibility exception is documented in the
[local Docker guide](docker/README.md).

## Documentation updates

Each topic has one guide. Update it alongside source changes and link it from the
[index](docs/README.md); use links elsewhere instead of maintaining parallel copies.

| Change | Review / update |
| --- | --- |
| Directory, fixture, page object, or utility ownership | [Architecture](docs/ARCHITECTURE.md), affected suite README |
| URL, account, environment key, default, or published port | [Configuration](docs/CONFIGURATION.md), [.env.example](.env.example) where applicable, affected Docker/CI guide |
| Test scenario, tag, suite selector, or execution setting | [Testing](docs/TESTING.md), affected suite README, relevant [scenario prompt](prompts/README.md) if requirements changed |
| Container lifecycle, initialization, test image, or CI workflow | [Local Docker](docker/README.md), [CI](docs/CI.md), [configuration](docs/CONFIGURATION.md) |
| Controlled API behavior, data, or dependencies | [Controlled service guide](docker/fakestore/README.md), [API suite](tests/api/README.md) |
| Reporter, output directory, Allure command, or uploaded artifact | [Reporting](docs/TESTING.md#docker-ci-and-reports), [CI](docs/CI.md), and the generator guide when changing its separate implementation |
| Onboarding command or contributor / agent workflow | [Root README](README.md), this file, [AGENTS.md](AGENTS.md) |
| Added, moved, or removed documentation | [Documentation index](docs/README.md) and inbound links |

Keep plans as dated records. Label old verification evidence as historical and
record new results separately with the target, command, browser, and date. A
successful controlled API run does not verify the public API. Avoid undated health
claims and fixed scenario counts in onboarding; use discovery for the current set.
