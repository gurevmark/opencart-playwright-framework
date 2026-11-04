# Documentation index and source of truth

[Project overview and quick start](../README.md) · [Agent instructions](../AGENTS.md)
· [Contribution workflow](../CONTRIBUTING.md)

This is the canonical navigation and ownership map for this repository. Each topic
has one maintained guide; executable files define the current behavior. Follow the
source links below when changing a setting or reconciling conflicting text.

## Reading routes

| Reader / task | Route |
| --- | --- |
| New contributor or reviewer | [Overview](../README.md) → [architecture](ARCHITECTURE.md) → [testing](TESTING.md) |
| Agent starting a task | [AGENTS.md](../AGENTS.md) → this index → the relevant guide and owning source files |
| Existing local environment | [Configuration](CONFIGURATION.md) → [local Docker guide](../docker/README.md) → [testing](TESTING.md) |
| Reproducible full stack / CI | [CI setup](CI.md), including [full local Docker mode](CI.md#full-docker-desktop-stack) |
| Failed run or report inspection | [Testing](TESTING.md) → [reporting](TESTING.md#docker-ci-and-reports) → the relevant suite README |
| New test scenario | [Contributing](../CONTRIBUTING.md) → [prompt catalog](../prompts/README.md) → suite README and existing code |

## Maintained guides

| Document | Owns |
| --- | --- |
| [Root README](../README.md) | Project purpose, onboarding, and first commands |
| [AGENTS.md](../AGENTS.md) | Repository rules and an agent's reading / verification workflow |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Change workflow, validation expectations, and documentation maintenance |
| [Architecture](ARCHITECTURE.md) | Directory / component map, fixtures, page objects, and data flow |
| [Configuration](CONFIGURATION.md) | Environment variables, precedence, runtime modes, and address boundaries |
| [Testing](TESTING.md) | Suite selection, tags, browser projects, prerequisites, and verification limits |
| [Local Docker](../docker/README.md) | Existing OpenCart/MySQL container lifecycle and initialization |
| [CI and full Docker stack](CI.md) | GitHub settings, workflow, test image, isolated local stack, and CI artifacts |
| [Reporting](TESTING.md#docker-ci-and-reports) | Current HTML/JUnit paths and viewing, raw Allure results, and the separate generator guide |
| [Web suite](../tests/web/README.md) | Storefront scenarios, reusable customer, and web-specific conventions |
| [API suite](../tests/api/README.md) | Contract coverage, fixtures, and public FakeStore behavior assumptions |
| [DB suite](../tests/db/README.md) | MySQL and UI/admin/DB scenarios, privileges, state changes, and cleanup |
| [Controlled FakeStore](../docker/fakestore/README.md) | Service provenance, synthetic data, compatibility differences, and bootstrap |
| [Prompt catalog](../prompts/README.md) | Original scenario requirements and reusable generation guidance |

## Authoritative implementation sources

| Fact being checked or changed | Owning files |
| --- | --- |
| Declared and locked dependency versions | [package.json](../package.json), [root lockfile](../package-lock.json), [service manifest](../docker/fakestore/package.json), [service lockfile](../docker/fakestore/package-lock.json) |
| npm commands / dependency upgrade helper | [package.json](../package.json), [env_setup.sh](../env_setup.sh) |
| Browser projects, timeouts, parallelism, retries, reporters | [playwright.config.ts](../playwright.config.ts) |
| TypeScript scope and strictness | [tsconfig.json](../tsconfig.json) |
| Test variable names and actual consumers | [.env.example](../.env.example), [configuration guide](CONFIGURATION.md) and its source links |
| Suite labels and tag filtering | [run-tests.sh](../scripts/ci/run-tests.sh), actual titles under [tests/](../tests/) |
| Page objects, fixture lifecycle, routes, schemas, SQL, data readers | [Architecture source map](ARCHITECTURE.md) |
| Existing local OpenCart/MySQL services and initialization | [base Compose](../docker-compose.yml), [OpenCart entrypoint](../docker/opencart/entrypoint.sh) and helpers in [docker/opencart/](../docker/opencart/) |
| Controlled API and MongoDB services | [CI application overlay](../docker-compose.ci.yml), [service sources](../docker/fakestore/) |
| Containerized test execution | [test Compose overlay](../docker-compose.test.yml), [test Dockerfile](../docker/playwright/Dockerfile), [Docker runner](../scripts/ci/run-tests-in-docker.sh) |
| Isolated local stack and its private configuration | [local-docker.mjs](../scripts/ci/local-docker.mjs) |
| CI triggers, repository settings, uploaded artifacts, cleanup | [workflow](../.github/workflows/playwright.yml), [environment validator](../scripts/ci/validate-env.mjs) |
| Separate local Allure implementation | [Report guide](https://github.com/gurevmark/opencart-playwright-framework/blob/a299c994ce375dcddf3f86116a88ff2fd9f7187c/docs/REPORTS.md), [Compose](https://github.com/gurevmark/opencart-playwright-framework/blob/a299c994ce375dcddf3f86116a88ff2fd9f7187c/docker-compose.allure.yml), [helper](https://github.com/gurevmark/opencart-playwright-framework/blob/a299c994ce375dcddf3f86116a88ff2fd9f7187c/scripts/allure.mjs); delivered independently of this documentation branch |
| Files excluded from Git / test images | [.gitignore](../.gitignore), [root .dockerignore](../.dockerignore), [service .dockerignore](../docker/fakestore/.dockerignore) |

## Requirements, tooling references, and history

[prompts/](../prompts/README.md) contains scenario requirements and a reusable
framework template. These explain intent and generation conventions. Their examples
do not establish which files exist, what environment is running, or whether a test
currently passes. Repository-specific rules in [AGENTS.md](../AGENTS.md) take
precedence over generic template defaults.

Optional browser-automation tooling has its own
[Playwright CLI skill](../.agents/skills/playwright-cli/SKILL.md) and
[reference documents](../.agents/skills/playwright-cli/references/). It is not a
prerequisite for running the framework through its shell runner.

Implementation records live in [docs/superpowers/plans/](superpowers/plans/):

- [Container CI plan](superpowers/plans/2026-11-04-playwright-container-ci.md).
- [Local Allure plan](https://github.com/gurevmark/opencart-playwright-framework/blob/a299c994ce375dcddf3f86116a88ff2fd9f7187c/docs/superpowers/plans/2026-11-04-local-allure.md) in the separate Allure change.

Plans, checked boxes, dated suite verification sections, and CI acceptance notes are
historical evidence. They are not instructions to rerun completed work or proof of
current service health. Report a fresh result with its date, command, browser,
target service, and limitations. Test discovery establishes coverage, not a passing
integration run.

## Keep this map current

Update the owning guide in the same change as its implementation. Add or remove its
entry here when a documentation topic changes. The
[documentation update matrix](../CONTRIBUTING.md#documentation-updates) lists which
guides need review for common changes. Avoid copying complete variable lists or
operational procedures into several guides; link the owner instead.

Generated HTML/JUnit/Allure files, browser traces, local `.env`, and private
`.docker-local/` state are runtime outputs rather than repository documentation.
They remain ignored and must not become prerequisites for understanding the project.
