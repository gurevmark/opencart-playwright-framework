# Project instructions

- Use the latest stable versions of dependencies and tools when adding or explicitly updating them. Check compatibility and document any necessary exception.
- Keep the lockfile committed for reproducible installs. When using the Playwright Docker image, match its version to the Playwright version resolved in the lockfile; update both together.
- Run browser tests headlessly by default. Use tags to select suites rather than a global tag filter.
- Reuse the existing OpenCart and MySQL containers when configuring integration tests; verify their addresses and configuration before connecting.
- Ensure CI reporter settings produce the artifacts that the workflow uploads.

## Read before working

1. Read [README.md](README.md) for the project and execution modes.
2. Use [docs/README.md](docs/README.md) as the canonical documentation index and
   source-of-truth map. Read only the guides and owning implementation files
   relevant to the task.
3. Read [CONTRIBUTING.md](CONTRIBUTING.md) and the affected suite guide:
   [web](tests/web/README.md), [API](tests/api/README.md), or [DB](tests/db/README.md).
4. Use the [prompt catalog](prompts/README.md) for scenario intent and generation
   conventions. Generic prompt defaults do not override these project rules.

## Work and verification

- Inspect `git status --short` and preserve unrelated changes. Reuse existing
  fixtures, page objects, routes, schemas, datasets, and utilities before adding new ones.
- Use [.env.example](.env.example) and [configuration](docs/CONFIGURATION.md) to
  understand settings. Do not print or commit `.env`, private generated credentials,
  or sensitive report contents.
- Establish the target before running tests. Host runs may use the public FakeStore
  API and persistent OpenCart data; the explicit full Docker helper uses its own
  controlled services. See [CI / full Docker setup](docs/CI.md).
- `test:*` suite names are positional arguments to `scripts/ci/run-tests.sh`, not
  npm scripts. Select a browser project explicitly. `@web` includes some MySQL-backed
  journeys; `tests/db/db-client.spec.ts` is also a live integration test.
- For discovery and offline helper checks, use:

  ```sh
  bash scripts/ci/run-tests.sh test:master chromium --list --reporter=list
  node --test scripts/ci/*.test.mjs
  ```

- Discovery does not prove tests pass. Follow [testing](docs/TESTING.md) for live
  prerequisites and the current standalone TypeScript compiler limitation. Report
  which commands ran, against which service/browser, and any verification limits.
- Keep the topic's owning guide current in the same change; use the
  [documentation update matrix](CONTRIBUTING.md#documentation-updates). Update
  [docs/README.md](docs/README.md) when adding, moving, or removing documentation.
- Plans under `docs/superpowers/plans/` and dated verification sections are
  historical records. Check the current source and environment instead of treating
  old checkboxes or pass counts as current state.
