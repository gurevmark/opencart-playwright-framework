# OpenCart database integration tests

These tests verify OpenCart changes against real MySQL. Most also drive the
storefront or Admin through Playwright page objects. They create and remove
generated test customers; use the intended test database and verify its address
before running. See the [documentation index](../../docs/README.md),
[configuration](../../docs/CONFIGURATION.md), [testing](../../docs/TESTING.md)
and [Docker setup](../../docker/README.md).

## Coverage

| Spec | Behavior checked |
| --- | --- |
| [`customer-registration.spec.ts`](customer-registration.spec.ts) | Register through the storefront, find exactly that email in Admin, compare saved identity/status in MySQL and check a valid creation timestamp. |
| [`customer-lifecycle.spec.ts`](customer-lifecycle.spec.ts) | Profile updates preserve customer ID/creation date; Admin disable/enable changes SQL status and fresh login behavior; password changes replace the stored value and login credentials; Admin deletion removes the customer and the defined related records. |
| [`customer-validation.spec.ts`](customer-validation.spec.ts) | Duplicate registration with original/uppercase email preserves the existing row; missing required fields, mismatched passwords and missing privacy consent show the expected validation error without inserting a customer. |
| [`db-client.spec.ts`](db-client.spec.ts) | A deliberately rejected statement identifies its connection; that exact connection disappears from `information_schema.PROCESSLIST`, and a later parameterized query succeeds. No business data or browser is used. |

All specs carry `@master`, `@regression` and `@db`. UI/DB scenarios also carry
`@web` and `@end-to-end`; validation cases also carry `@datadriven`. As a result,
selecting `@web` or `@end-to-end` across the repository includes live SQL checks.

## Prerequisites and guards

- Reachable OpenCart and the same MySQL database it uses, with the `oc_` customer
  tables expected by [`customerDb.ts`](../../utils/customerDb.ts). The table
  prefix in these SQL helpers is fixed; changing Compose's schema alone does not
  change the queries.
- `WEB_APP_URL` for browser scenarios. Admin navigation resolves
  `admin/index.php` relative to this storefront URL, so retain its directory and
  trailing slash. Admin scenarios additionally need `ADMIN_USERNAME` and
  `ADMIN_PASSWORD` with customer view/edit/delete permissions.
- `DB_HOST`, `DB_USER`, `DB_PASSWORD` and `DB_NAME` for direct SQL access.
  The test account needs `SELECT` and `DELETE` privileges on the listed tables;
  test code scopes deletions to owned customer IDs/emails.
  `DB_PORT` is optional in the connection helper; omitting it leaves the driver
  default. Set it explicitly when connecting through a published host port.
  Host-side tests use the verified host address/mapped port; containerized tests
  use `database:3306` through the Compose network.
- The connection-error spec expects MySQL's `GTID_SUBSET`, the
  `ER_MALFORMED_GTID_SET_SPECIFICATION` error and visibility of the test user's
  own sessions in `information_schema.PROCESSLIST`. It is not a portable test for
  every MySQL-compatible server.
- Browser scenarios need the selected Playwright browser/runtime. Use existing
  OpenCart/MySQL containers for host-side work; check their actual configuration
  before connecting. [CI/local Docker guidance](../../docs/CI.md) describes the
  explicit isolated container-runner path.

`customerData` and the standalone registration scenario execute `SELECT 1`
before creating an account. Missing configuration, denied permissions or an
unavailable database fail the run; there is no automatic skip or `DB_ENABLED`
switch. The tests do not install/migrate OpenCart or provision Admin credentials.

Direct SQL access is unnecessary for the API suite and the specs under
`tests/web/`; OpenCart itself still needs its application database. `mysql2` is a
declared project dependency, not an optional driver or a mocked connection.

## Fixture ownership and cleanup

[`dbFixtures.ts`](../../fixtures/dbFixtures.ts) extends the page fixtures:

1. `customerData` preflights SQL, then generates unique registration details.
   Its `finally` removes rows for that generated email and checks it is absent.
2. `registeredCustomer` depends on those details, registers through the frontend
   and requires exactly one matching SQL row. The yielded record is the original
   snapshot for later assertions.
3. Its `finally` cleans by the captured customer ID and verifies that ID is gone.
   Keeping the ID allows cleanup after a profile changes the email or Admin
   removes the parent customer.

[`cleanupCustomer()`](../../utils/customerDb.ts) removes customer-ID rows from
`oc_customer_activity`, `oc_customer_ip`, `oc_customer_online`,
`oc_customer_approval`, `oc_customer_history`, `oc_customer_reward`,
`oc_customer_transaction`, `oc_customer_affiliate` and `oc_address`, then deletes
`oc_customer`. It also removes `oc_customer_login` rows for the owned email(s).
This is scoped teardown for generated customers, not a general database reset.

The standalone registration spec implements its own `try/finally` using the same
cleanup helper. The missing-email validation case uses a unique generated name
marker plus surname/telephone to find and clean an accidentally saved row; it
does not query or delete all customers with a blank email. The suite does not
edit the reusable `APP_EMAIL`/`APP_PASSWORD` customer used by ordinary login specs.

[`executeQuery()`](../../utils/dbClient.ts) creates a connection per statement
and closes it in `finally`, including after rejected SQL. There is no connection
pool, transaction rollback or cross-query transaction. Teardown can fail if the
database becomes unavailable, and a terminated process cannot guarantee cleanup.

## Running

From the repository root, after verifying the intended test environment:

```sh
# Discover this suite without opening a browser or running SQL.
bash scripts/ci/run-tests.sh test:db chromium tests/db --list

# Run the complete DB suite in one browser project, headlessly.
bash scripts/ci/run-tests.sh test:db chromium tests/db

# Run only the real-MySQL connection check; no browser is launched.
bash scripts/ci/run-tests.sh test:db chromium tests/db/db-client.spec.ts
```

The shell wrapper selects the `@db` tag and preserves configured reporters;
`test:db` is its suite argument, not an npm script. The explicit path confines
discovery to DB specs. Replace `chromium` with `firefox` or `webkit` for another
configured project. An unfiltered direct Playwright run uses every configured
project, repeating even the connection-only test.

These are integration tests, including `db-client.spec.ts`. Repository script
unit checks such as `node --test scripts/ci/*.test.mjs` validate configuration and
orchestration helpers; they do not establish MySQL connectivity or OpenCart
customer behavior. The controlled FakeStore/MongoDB service checks are separate
from this suite.

## Limits and troubleshooting

- UI text, immediate registration enablement, duplicate-email handling and
  related-table expectations target the installed OpenCart behavior. Check the
  actual version/schema/configuration when those contracts change.
- Admin deletion proves a child IP row exists before deleting. Other related
  tables are checked for absence but are not all seeded with child records.
  OpenCart's deletion does not remove `oc_customer_online` in this scenario;
  fixture teardown removes that test-owned state.
- The password scenario checks that storage changed and differs from plaintext,
  then checks old/new login behavior. It does not assert a particular hash
  algorithm.
- Connection failures should be resolved against the selected host/container
  address and SQL permissions. The preflight does not verify the full schema or
  all delete permissions; these are exercised later in the run.
- Assertions can fail before cleanup, and cleanup failures can be reported as
  additional errors. Inspect both the scenario step and teardown in the report.
  Use [report guidance](../../docs/TESTING.md#docker-ci-and-reports) for artifact locations and handling.

This page describes implemented coverage and prerequisites. It does not record
a fresh successful integration run; runtime evidence must come from the run
being reviewed.
