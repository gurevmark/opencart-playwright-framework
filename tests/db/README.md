# OpenCart database integration tests

This directory contains **15 tests per Playwright project**. Fourteen drive the storefront or Admin in a browser and verify the result in MySQL. The remaining test checks the SQL client's connection handling. Run the full group on a test store where creating, editing and removing customers is permitted.

[Project overview](../../README.md) · [Development guide](../../docs/DEVELOPMENT.md) · [Known issues](../../docs/KNOWN_ISSUES.md)

## Run the suite

From the repository root, use the separate `opencart-local-ci` Docker stack for a reproducible run.

```sh
# All 15 DB scenarios in Chromium.
node scripts/ci/local-docker.mjs test test:db chromium

# Just the four customer lifecycle scenarios in WebKit.
node scripts/ci/local-docker.mjs test test:db webkit tests/db/customer-lifecycle.spec.ts
```

The helper accepts a suite, a browser (`chromium`, `firefox` or `webkit`), then any paths or Playwright options. It builds the test runner, starts OpenCart, MySQL, FakeStore and MongoDB, and checks FakeStore and the OpenCart URL helper before running Playwright. Even a Docker command with `--list` performs that preparation. [Docker setup](../../docker/README.md) · [CI guide](../../docs/CI.md)

For local discovery, install the project dependencies with `npm ci`. For execution against existing services, first check the target below and install the chosen browser for the UI scenarios.

```sh
# List DB tests on the host without opening a browser or connecting to MySQL.
bash scripts/ci/run-tests.sh test:db chromium tests/db --list --output=test-results/host

# Run only the SQL client check against an already running test MySQL.
bash scripts/ci/run-tests.sh test:db chromium tests/db/db-client.spec.ts --output=test-results/host

# Run the complete DB suite through the existing test storefront, Admin and MySQL.
bash scripts/ci/run-tests.sh test:db chromium tests/db --output=test-results/host
```

An explicit path confines collection to DB specs. The dedicated host `--output` keeps Playwright's cleanup away from earlier Docker captures. A plain `--list` skips test bodies and fixtures, but the project's reporters still replace host HTML and JUnit and add skipped cases to Allure. Use a separate checkout if earlier reports must be preserved. [Report locations](../../docs/REPORTS.md) · [Known report issues](../../docs/KNOWN_ISSUES.md)

## Check the target

| Requirement | Where it matters |
| --- | --- |
| `WEB_APP_URL` points at the intended storefront directory and ends in `/`. | The `homePage` fixture opens this address. Admin navigation resolves `admin/index.php` relative to it. The test image uses OpenCart 3.0.3.8 with English forms and immediate activation after registration. |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` connect to **the database used by that storefront**. | The helpers use fixed `oc_*` table names. Set the published port explicitly for host runs if it differs from the driver's default. The initial `SELECT 1` confirms connectivity. Schema and cleanup permissions are exercised by later queries. |
| The MySQL account can `SELECT` from the checked tables and `DELETE` from the cleanup tables. | The project uses MySQL 8.0. The SQL-only case expects `GTID_SUBSET`, `CONNECTION_ID()`, error code `ER_MALFORMED_GTID_SET_SPECIFICATION` and visibility of the account's own sessions in `information_schema.PROCESSLIST`. |
| `ADMIN_USERNAME` and `ADMIN_PASSWORD` belong to a test administrator allowed to view, edit and delete customers. | Admin is used for registration verification, disabling and enabling a customer, and customer deletion. |

The runner inside Compose opens `http://opencart/opencart/upload/` and connects to `database:3306`. On the host, check the existing base project with `docker compose ps`, `docker compose port opencart 80` and `docker compose port database 3306`. Use the actual published port on `127.0.0.1` for MySQL. Match any `OPENCART_DB_*` and `OPENCART_ADMIN_*` overrides to the test settings. Container startup uses the configured shared customer's `APP_EMAIL` and `APP_PASSWORD`. DB scenarios create their own customers. [Environment template](../../.env.example) · [Test-service network](../../docker-compose.test.yml) · [Configuration guide](../../docs/CONFIGURATION.md)

An unavailable database or rejected query fails the test. There is no optional DB switch. The host must already have the test schema and the administrator account. The API suite and the storefront-only files in `tests/web/` run without a direct SQL connection from the test code. A passing run of `node --test scripts/ci/*.test.mjs` exercises the framework's script helpers. Use a DB integration run to verify the actual connection and customer behavior.

## What the 15 tests check

| Spec | Cases | Expected behavior |
| --- | ---: | --- |
| [customer-registration.spec.ts](customer-registration.spec.ts) | 1 | The storefront confirms registration. Admin finds exactly one customer by email and shows Enabled. MySQL contains the expected first and last name, email, `status = 1` and a valid creation timestamp. |
| [customer-validation.spec.ts](customer-validation.spec.ts) | 9 | Two duplicate attempts use the original email and its uppercase variant. The test checks the warning and compares the captured customer fields. Seven more cases omit first name, last name, email, telephone, password or privacy consent, or submit mismatched passwords. Each expects its specific error and zero inserted rows. |
| [customer-lifecycle.spec.ts](customer-lifecycle.spec.ts) | 4 | A profile update replaces the email while preserving ID, creation date and status. Disabling and enabling in Admin changes SQL status and fresh login behavior. A password change replaces the stored value, rejects the old password and accepts the new one. Admin deletion removes the parent and checks related rows by ID. |
| [db-client.spec.ts](db-client.spec.ts) | 1 | A deliberately malformed read-only `SELECT` returns an error containing its connection ID. The test waits for that exact ID to disappear from the process list and then executes `SELECT ? AS value` with `42`. |

All 15 have `@master`, `@regression` and `@db`. The 14 UI scenarios also carry `@web` and `@end-to-end`. All nine validation cases carry `@datadriven`. The `@sanity` selection covers other directories. Running the direct Playwright CLI without `--project` collects this suite for all three projects, even the SQL-only case. [Playwright configuration](../../playwright.config.ts) · [Course DB requirements](../../prompts/db_test_prompt.md)

## Fixtures and cleanup

- [`customerData`](../../fixtures/dbFixtures.ts) runs `SELECT 1`, then generates registration fields with an address of the form `pw-<UUID>@<domain>`. Faker chooses the domain and can use public mail domains. The fixture fits rejected registrations. Its `finally` cleans up using the original email and checks that no matching row remains. [Customer generator](../../utils/dataGenerator.ts)
- [`registeredCustomer`](../../fixtures/dbFixtures.ts) depends on `customerData`, registers through the [storefront form](../../pages/RegisterPage.ts), leaves the customer signed in, and yields a snapshot of exactly one MySQL row. In its `finally` it cleans up using the captured `customer_id` and checks it is gone. That ID survives email changes and lets the fixture find child rows after an Admin deletion. The outer `customerData` teardown then runs.
- The standalone registration case uses page fixtures, preflights SQL, and calls `cleanupCustomer` in its own `finally`. For the missing-email case, the validation spec uses part of its UUID-based address in the first name and locates a persisted attempt by that marker, surname and telephone. It cleans up only the matched IDs.
- [`cleanupCustomer`](../../utils/customerDb.ts) deletes owned rows by ID from `oc_customer_activity`, `oc_customer_ip`, `oc_customer_online`, `oc_customer_approval`, `oc_customer_history`, `oc_customer_reward`, `oc_customer_transaction`, `oc_customer_affiliate`, `oc_address` and `oc_customer`. It uses email for `oc_customer_login`. When an ID is known, both the supplied address and the current address read from the row are considered.
- [`executeQuery`](../../utils/dbClient.ts) opens a separate `mysql2` connection for each statement and closes it in `finally`, including after SQL errors. The deletes span multiple connections and can finish only partially if execution is interrupted. Inspect both the scenario step and teardown errors. Keep the generated ID or email to look up the affected records.

## Add or diagnose a DB test

1. For SQL alone, import `test` and `expect` from `@playwright/test`, as in the connection test. For a customer journey, import them from [dbFixtures.ts](../../fixtures/dbFixtures.ts) and request `customerData` or `registeredCustomer`. That module also provides the [page fixtures](../../fixtures/pageFixtures.ts).
2. Perform the user action through the storefront or [Admin](../../pages/AdminCustomersPage.ts). Clear cookies and sign in again when checking a changed status or password. In SQL, locate the generated row by email or captured ID. Check the row count before comparing fields and pass values as `?` parameters.
3. Establish the state that the action must change. The deletion scenario requires an `oc_customer_ip` row before the Admin action. For other child tables it checks only final absence. The installed Admin deletion leaves `oc_customer_online` cleanup to the fixture. Seed and verify a child row first if its removal matters to the new test.
4. `getCustomersByEmail` returns ID, names, email, telephone, status and date. A change limited to the stored password can escape the duplicate-email comparison. For password behavior, assert a boolean comparison in memory and exercise a fresh login. The password-change scenario checks that storage changed and differs from plaintext. See COV-01 in [known issues](../../docs/KNOWN_ISSUES.md).
5. Add the suite tags in the title, list the file for one browser, then run it on the verified target. Extend the ID-scoped teardown whenever a new scenario owns records in another table.
