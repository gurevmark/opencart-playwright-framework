# Known issues and test coverage limits

Reviewed on November 5, 2026. The IDs below are local to this register. Run reproductions involving installation, browser captures or deliberate failures in an isolated checkout with synthetic data.

## Data loss and disclosure

### OC-01. A partial database can trigger OpenCart reinstallation

The startup probe uses `SHOW TABLES LIKE 'oc_setting'`. If the query finds zero matches, the probe returns `10` and the entrypoint starts the installer, even when other tables exist. The SQL bundled with OpenCart 3.0.3.8 includes `DROP TABLE IF EXISTS oc_customer`. In a partially populated database without `oc_setting`, reinstallation could therefore remove existing customer rows. The opposite failure is also possible. SQL `LIKE` treats `_` as any single character, so `ocXsetting` can make an incomplete installation appear ready. [Database probe](../docker/opencart/database-state.php) · [Installer invocation](../docker/opencart/entrypoint.sh) · [Distribution source](../docker/opencart/Dockerfile)

**Evidence and regression check.** The review inspected the startup branches and the installer SQL from the image. The read-only MySQL query `SELECT 'ocXsetting' LIKE 'oc_setting', 'ocXsetting' = 'oc_setting'` returned `1, 0`. The potential loss of customer rows follows from the installer code. Test with three disposable schemas. Leave one empty, give the second an `oc_customer` table without `oc_setting`, and give the third the lookalike `ocXsetting`. A fix should install only into a verified empty database, stop on an unknown or partial schema, and preserve existing rows. Until then, check the target schema and volume before starting the base OpenCart service.

### API-01. A failed user-count assertion prints passwords to the console

Several tests pass an entire user array to `toHaveLength`. On a length mismatch, the standard console reporter prints the received value, including each controlled FakeStore user's `password` field. The project processes console output separately from HTML, JUnit and Allure artifacts. [User list tests](../tests/api/users.spec.ts) · [Reporter configuration](../playwright.config.ts) · [Artifact generation](../scripts/ci/reporters/artifacts.cjs)

**Evidence and regression check.** In an isolated copy, the original test received a stub HTTP response containing one user with a unique synthetic marker in its `password` field while `LIMIT=3`. The test failed and stdout contained the marker. A search of that run's JUnit and Allure JSON found zero occurrences. A fix should report the expected and actual counts while keeping the marker out of both console output and artifacts. Until then, use synthetic credentials and review logs before sharing them.

### RPT-01. A host run can erase Docker diagnostics

The host script defaults to `--output=test-results`. Local Docker runs store their browser captures under `test-results/local-docker/run/`. A subsequent host run clears the parent directory before it starts. [Host test entry point](../scripts/ci/run-tests.sh) · [Local Docker output paths](../scripts/ci/local-docker.mjs)

**Evidence and regression check.** In a temporary copy, a marker file placed under `test-results/local-docker/run/` disappeared after a successful host run of `GET - All products`. Pass `--output=test-results/host` to host runs. A fix should preserve both sets of captures when host and Docker runs alternate using their defaults.

### RPT-02. Browser captures can overwrite a local Allure report

The CLI rejects an `--output` path that overlaps `reports/` or `allure-results/`. It accepts a path under `allure-report/`, where the local service serves generated HTML. In an isolated copy, a synthetic failing test with `--output=allure-report/host` removed a pre-existing `latest/index.html` and wrote a raw file into the served directory. The experiment exercised the local Allure directory only. [Path validation](../scripts/ci/reporters/options.cjs) · [Allure mounts](../docker-compose.allure.yml)

**Regression check.** A direct path to `allure-report/host`, or a symlink resolving to it, should be rejected before cleanup or test execution. The marker HTML should survive and the directory should receive zero diagnostic files. Until then, use `--output=test-results/host` for host captures.

## Test execution and service behavior

### RUN-01. Selecting OpenCart by tag requires FakeStore settings

Playwright loads spec files before applying the tag filter. Importing `fakestoreTestSupport.ts` immediately requires six API selectors. In a clean copy without `.env`, `bash scripts/ci/run-tests.sh test:opencart chromium --list` exited with code 1 and reported a missing `PRODUCT_ID`. Supplying the paths `tests/web tests/db` listed 27 scenarios and exited with code 0. Collecting the auth spec alone also requires resource selectors it never uses. [API initialization](../utils/fakestoreTestSupport.ts) · [Tag selection](../scripts/ci/run-tests.sh)

**Workaround and regression check.** Supply explicit test paths for host runs. After a fix, collecting OpenCart by tag or collecting the auth file should work with just the relevant settings. A test that needs a missing variable should still identify it by name. [Host command examples](DEVELOPMENT.md)

### RPT-03. Listing tests replaces reports and adds skipped Allure results

In a normal checkout, `--list` invokes the configured reporter. In an isolated directory, `bash scripts/ci/run-tests.sh test:api chromium tests/api/products.spec.ts --list` wrote `reports/index.html`, `reports/results.xml` and the completion marker without executing the test bodies. It also appended one `skipped` Allure result per listed test. In a controlled example, one successful test run followed by listing two tests produced one `passed` and two `skipped` Allure results. [Artifact writer](../scripts/ci/reporters/artifacts.cjs) · [Reporter selection](../scripts/ci/reporters/options.cjs)

**Workaround and regression check.** Save the report before listing tests, or use another checkout. A separate `--output` directory protects browser captures, while HTML and JUnit still go to `reports/`. A fix should preserve the previous report, completion marker and Allure result set during discovery.

### API-02. An invalid cart date returns HTTP 503

On the local `controlled-fakestore` service, `POST /carts` with `date: "invalid-date"` and `PATCH /carts/1` with a `products` field but no date both returned `503 Fixture service unavailable`. A `PUT` with a valid date and `GET /health` each returned 200. The cart handler calls `toISOString()` on an invalid date, and the shared error handler classifies the exception as a service failure. Cart writes on this service are simulated. [Request handlers](../docker/fakestore/app.mjs) · [FakeStore contract](../docker/fakestore/README.md)

**Regression check.** An invalid date should return a client error. Specify the intended behavior for a partial PATCH that omits `date` and cover it with a test. Reserve service-unavailable responses for failures of the service itself.

### API-03. An interrupted first MongoDB seed blocks the next startup

`seedDatabase` populates the collections sequentially and writes the dataset marker last. If the process stops between inserts, the next startup finds populated collections without a marker and refuses to seed. [Seeding algorithm](../docker/fakestore/seed.mjs) · [Service startup](../docker/fakestore/server.mjs)

**Evidence and regression check.** In a model of the collections, forcing the `users` insert to fail after the `products` insert left six products, zero users, zero carts and no marker. A second call was rejected. A fix should safely complete or roll back a partial seed it can identify as **its own**, while preserving an unrelated populated database.

## What a passing test can miss

These entries describe gaps in the assertions. A finding about OpenCart itself would require separate product evidence.

| ID | Evidence | Regression check |
| --- | --- | --- |
| COV-01 | Two duplicate-registration tests compare snapshots of fields that omit the password. In a model where the UI showed the expected warning but only the existing customer's password changed, both checks passed. [Duplicate tests](../tests/db/customer-validation.spec.ts) · [Selected customer fields](../utils/customerDb.ts) | Changing only the stored password should fail both variants without exposing the password or its hash in diagnostics. |
| COV-02 | The shopping test compares the **line total** numerically. `convertPriceToNumber` maps `$602.00`, `-$602.00` and `€602.00` to the same number. If the overall `Total` is correct, the line check can miss a sign or currency error. [Shopping test](../tests/web/shopping.spec.ts) · [Price conversion](../utils/helper.ts) | Changing only the sign or currency of the line total should fail the test even when the overall total is correct. |
| COV-03 | Every JSON row with `expected: "success"` uses `APP_EMAIL` and `APP_PASSWORD`. In an isolated check, adding a row for a second customer caused the scenario to submit the first customer's credentials. The checked-in success row is intended for the shared account. [Row selection](../tests/web/login-data-driven.spec.ts) · [Login data](../testdata/opencart_logindata.json) | Define the supported format. Either validate an explicit reference to the shared account or distinguish successful rows by customer. Reject a malformed row before it can silently test a different account. |

Further scenario-specific limits are documented in the [web guide](../tests/web/README.md), [MySQL guide](../tests/db/README.md) and [API guide](../tests/api/README.md).
