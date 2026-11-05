# Developing and running the framework

[First run](../README.md) · [Architecture](ARCHITECTURE.md) · [Configuration](CONFIGURATION.md) · [Agent instructions](../AGENTS.md) · [Known issues](KNOWN_ISSUES.md)

## From command to result

1. For the full local stack, the [Docker helper](../scripts/ci/local-docker.mjs) reads the Playwright version from the lockfile, builds the test image, waits for four services, checks FakeStore and the OpenCart URL rules, then starts a one-off test container. The default selection is `test:master` on Chromium.
2. The [suite runner](../scripts/ci/run-tests.sh) maps the suite to a tag and selects one Playwright project. Both the Docker and host entry points use it. The [Playwright config](../playwright.config.ts) sets a 30-second test timeout, headless browsers and parallel execution. With a nonempty `CI` value it uses one worker and two retries. A direct CLI call without `--project` collects all three browser projects, including the HTTP- and SQL-only tests.
3. OpenCart UI tests use page objects. DB journeys query MySQL to check the effect of an action performed through the UI. FakeStore tests use the HTTP `request` fixture. In the full stack the controlled service reads from MongoDB and simulates writes. The test container reaches OpenCart at `opencart:80`, MySQL at `database:3306` and FakeStore at `fakestore:6400`.
4. The [artifact reporter](../scripts/ci/reporters/artifacts.cjs) produces HTML, JUnit XML and Allure data from filtered events. Screenshots, videos and traces stay in the capture directory. Actions builds a separate, reduced public report when verified results are available. See [reports and publication](REPORTS.md).

## Choose the right layer

| Change | Source and tests |
| --- | --- |
| A locator or browser action | [Page objects](../pages/) contain locators and actions. [Page fixtures](../fixtures/pageFixtures.ts) expose them on the current test's page. Keep outcome assertions in the [web specs](../tests/web/README.md). |
| A storefront, Admin or database consistency check | [DB fixtures](../fixtures/dbFixtures.ts) extend the UI fixtures with an independent customer. [customerDb](../utils/customerDb.ts) reads and cleans customer records. [dbClient](../utils/dbClient.ts) opens a connection per query. The [DB guide](../tests/db/README.md) explains privileges and cleanup boundaries. |
| An HTTP contract | Start with the [routes](../api/endpoints/routes.ts), [response schemas](../api/schemas/), [shared API assertions](../utils/fakestoreTestSupport.ts) and [test data](../testdata/fakestore_api_data.json). Check a change to an expected response against the [controlled service](../docker/fakestore/README.md) and [API tests](../tests/api/README.md). |
| External input | [DataProvider](../utils/DataReader.ts) reads JSON, CSV and Excel. The five login rows come from [JSON](../testdata/opencart_logindata.json). [RandomDataUtil](../utils/dataGenerator.ts) generates unique customer addresses with Faker-selected domains, including real mail providers. [Helper](../utils/helper.ts) reads account and product settings. |
| A suite name or execution setting | Keep selections aligned across the [Docker helper](../scripts/ci/local-docker.mjs), [tag runner](../scripts/ci/run-tests.sh), [workflow](../.github/workflows/playwright.yml) and [Compose test service](../docker-compose.test.yml). The root [manifest](../package.json) defines the npm commands. |

The [course prompts](../prompts/README.md) describe the original intent. Use the executable specs and config to resolve questions about current behavior. For example, `utils/CustomReporter.ts` is present in the tree, while the configured reporters are `list` and `scripts/ci/reporters/artifacts.cjs`.

## Reproduce one case from the host

After `npm ci`, install the selected browser for UI tests. Work from the repository root. Exported variables take precedence over the ignored root `.env`. `APP_ENV` labels a run. The target systems are selected by `WEB_APP_URL`, `API_BASE_URL` and `DB_*`. The [configuration reference](CONFIGURATION.md) lists the account, product, query and initialization settings.

```sh
docker compose ps
docker compose port opencart 80
docker compose port database 3306

# Run the 12 storefront cases without importing the API files.
bash scripts/ci/run-tests.sh test:web chromium tests/web --output=test-results/host

# List 27 OpenCart cases without executing fixtures.
bash scripts/ci/run-tests.sh test:opencart chromium tests/web tests/db --output=test-results/host --list

# Check the runner helpers without a browser or running services.
node --test scripts/ci/*.test.mjs
```

A file or directory filter limits imports before tag filtering. A tag alone can import the FakeStore configuration and require `PRODUCT_ID` even when you selected OpenCart. Use a dedicated host capture directory. Ordinary `--list` still replaces HTML/JUnit and appends skipped Allure results. To preserve the previous report, use the clean, credential-free catalog procedure in [CI](CI.md#existing-host-side-local-runs). The [known issues](KNOWN_ISSUES.md) document the reproductions.

## Verify a change

Start with a comparable scenario in the relevant suite. Keep `@master` and the appropriate selection tags in its title. Give each test ownership of its data. Check discovery for the affected file on one browser, then run the scenario and nearby cases against the same target. Use `node scripts/ci/local-docker.mjs test test:master chromium` for a cross-suite change.

Record the command, target, browser, result and verification limits. A catalog lists tests. A run executes assertions. A strict TypeScript check needs a separately provisioned compiler because the root manifest has neither a standalone compiler dependency nor a `typecheck` script. Update the suite guide with behavior changes and follow the [contribution guide](../CONTRIBUTING.md) for verification and documentation ownership.
