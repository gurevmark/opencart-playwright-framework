# Project instructions

- Use the latest stable versions of dependencies and tools when adding or explicitly updating them. Check compatibility and document any necessary exception.
- Keep the lockfile committed for reproducible installs. When using the Playwright Docker image, match its version to the Playwright version resolved in the lockfile; update both together.
- Run browser tests headlessly by default. Use tags to select suites rather than a global tag filter.
- Reuse the existing OpenCart and MySQL containers when configuring integration tests; verify their addresses and configuration before connecting.
- Ensure CI reporter settings produce the artifacts that the workflow uploads.
