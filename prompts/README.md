# Prompt catalog

[Documentation index](../docs/README.md) · [Contribution workflow](../CONTRIBUTING.md)

These files record scenario requirements and reusable instructions for generating
framework code. For current setup and behavior, use the
[maintained guides and implementation source map](../docs/README.md).

| File | Purpose | Current implementation / guide |
| --- | --- | --- |
| [playwright-mcp-context.md](playwright-mcp-context.md) | Reusable framework structure, generation order, and coding conventions | [AGENTS.md](../AGENTS.md), [architecture](../docs/ARCHITECTURE.md), [contributing](../CONTRIBUTING.md) |
| [opencart_web_test_prompts.md](opencart_web_test_prompts.md) | Storefront registration, authentication, search, cart, and data-driven scenarios | [tests/web/README.md](../tests/web/README.md) |
| [fakestore_api_test_prompts.md](fakestore_api_test_prompts.md) | FakeStore authentication / product / user / cart contracts and extended regression requirements | [tests/api/README.md](../tests/api/README.md) |
| [db_test_prompt.md](db_test_prompt.md) | OpenCart storefront/admin/MySQL journey and additional customer database scenarios | [tests/db/README.md](../tests/db/README.md) |
| [utilitis_prompt.md](utilitis_prompt.md) | Original helper, generator, database client, and data-reader requirements; filename retained | [utils/](../utils/), [architecture](../docs/ARCHITECTURE.md) |

Read the relevant scenario prompt when implementing or reviewing its requirement.
Inspect the actual code before generating anything: components requested by an
older prompt may already exist or may have been extended. A prompt is not a test
result or a list of work still to do.

The generic context deliberately contains cross-project examples. For this
repository, [AGENTS.md](../AGENTS.md) governs project rules. Variable names and
example defaults are listed in [.env.example](../.env.example); values come from
the configured runtime. Suite selection belongs on the command line, and ordinary
installation uses `npm ci`. Neither example code nor a historical report overrides
the owning implementation.
