# Project instructions

- Use the latest stable versions of dependencies and tools when adding or explicitly updating them. Check compatibility and document any necessary exception.
- Keep the lockfile committed for reproducible installs. When using the Playwright Docker image, match its version to the Playwright version resolved in the lockfile; update both together.
- Run browser tests headlessly by default. Use tags to select suites rather than a global tag filter.
- Reuse the existing OpenCart and MySQL containers when configuring integration tests; verify their addresses and configuration before connecting.
- Ensure CI reporter settings produce the artifacts that the workflow uploads.
- Write all project documentation in English, including headings, tables, example comments and link text.

## Read before working

1. Read [README.md](README.md) for the project and execution modes.
2. Use [docs/README.md](docs/README.md) as the canonical documentation index and
   source-of-truth map. Read only the guides and owning implementation files
   relevant to the task.
3. Read [CONTRIBUTING.md](CONTRIBUTING.md) and the affected suite guide:
   [web](tests/web/README.md), [API](tests/api/README.md), or [DB](tests/db/README.md).
4. Use the [prompt catalog](prompts/README.md) for scenario intent and generation
   conventions. Generic prompt defaults do not override these project rules.
5. Use the [development guide](docs/DEVELOPMENT.md) to trace a change through the
   framework and the [issue register](docs/KNOWN_ISSUES.md) for reproductions and
   acceptance criteria. Use the [Playwright CLI skill](.agents/skills/playwright-cli/SKILL.md)
   for interactive locator investigation when needed.

## Work and verification

- Run `git status --short --branch` and `git worktree list` before editing. If the
  task specifies a branch, work in the directory that has it checked out. Reuse existing
  fixtures, page objects, routes, schemas, datasets, and utilities before adding new ones.
- Use [.env.example](.env.example) and [configuration](docs/CONFIGURATION.md) to
  understand settings. Do not print or commit `.env`, private generated credentials,
  or sensitive report contents.
- Establish the target before running tests. Host runs may use the public FakeStore
  API and persistent OpenCart data; the explicit full Docker helper uses its own
  controlled services. See [CI / full Docker setup](docs/CI.md).
- Use `npm run test:<suite>` for Docker or pass the suite to
  `scripts/ci/run-tests.sh` on the host. The direct Docker helper accepts
  the same suite names. Select a browser explicitly. Of the 26
  `@web` cases, 14 also require MySQL. The standalone `tests/db/db-client.spec.ts`
  exercises a real MySQL connection.
- For discovery and offline helper checks, use:

  ```sh
  bash scripts/ci/run-tests.sh test:web chromium tests/web --output=test-results/host --list
  node --test scripts/ci/*.test.mjs
  ```

- A normal host run clears its capture directory. Use `--output=test-results/host`
  to preserve Docker captures. Ordinary `--list` replaces host HTML/JUnit and
  adds skipped cases to Allure. Follow [CI](docs/CI.md#existing-host-side-local-runs)
  for a catalog that preserves reports. Keep private captures and credential-bearing
  assertion payloads out of logs and shared artifacts.
- Discovery does not prove tests pass. Follow [testing](docs/TESTING.md) for live
  prerequisites and the current standalone TypeScript compiler limitation. Report
  which commands ran, against which service/browser, and any verification limits.
- Keep the topic's owning guide current in the same change; use the
  [documentation update matrix](CONTRIBUTING.md#documentation-updates). Update
  [docs/README.md](docs/README.md) when adding, moving, or removing documentation.
- Plans under `docs/superpowers/plans/` and dated verification sections are
  historical records. Check the current source and environment instead of treating
  old checkboxes or pass counts as current state.

## Secret checks before commits

- Before committing, use the local `check-secrets` skill at `/Users/mark/.codex/skills/check-secrets/SKILL.md`.
- After the final `git add`, run `python3 /Users/mark/.codex/skills/check-secrets/scripts/secrets_check.py` from the current worktree. Only exit code 0 permits an otherwise authorized commit. For code 1, resolve the finding and stage the fix; for code 2, resolve the incomplete check. Rerun after either.
- Preserve the user's staged selection. Do not bypass the check with `--no-verify`, disable the hook, or print secret values.
- This machine has a local `pre-commit` hook in the repository's shared Git directory, covering linked worktrees. New clones need their own hook installation; check existing hooks and `core.hooksPath` first.
