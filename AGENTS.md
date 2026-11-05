# Project instructions

- Use the latest stable versions of dependencies and tools when adding or explicitly updating them. Check compatibility and document any necessary exception.
- Keep the lockfile committed for reproducible installs. When using the Playwright Docker image, match its version to the Playwright version resolved in the lockfile; update both together.
- Run browser tests headlessly by default. Use tags to select suites rather than a global tag filter.
- Reuse the existing OpenCart and MySQL containers when configuring integration tests; verify their addresses and configuration before connecting.
- Ensure CI reporter settings produce the artifacts that the workflow uploads.


## Secret checks before commits

- Before committing, use the local `check-secrets` skill at `/Users/mark/.codex/skills/check-secrets/SKILL.md`.
- After the final `git add`, run `python3 /Users/mark/.codex/skills/check-secrets/scripts/secrets_check.py` from the current worktree. Only exit code 0 permits an otherwise authorized commit. For code 1, resolve the finding and stage the fix; for code 2, resolve the incomplete check. Rerun after either.
- Preserve the user's staged selection. Do not bypass the check with `--no-verify`, disable the hook, or print secret values.
- This machine has a local `pre-commit` hook in the repository's shared Git directory, covering linked worktrees. New clones need their own hook installation; check existing hooks and `core.hooksPath` first.
