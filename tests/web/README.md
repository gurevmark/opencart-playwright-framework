# OpenCart web tests

[Documentation index](../../docs/README.md) · [Testing commands](../../docs/TESTING.md)
· [Configuration](../../docs/CONFIGURATION.md)

Implementation context: [`../../prompts/playwright-mcp-context.md`](../../prompts/playwright-mcp-context.md).
Scenarios: [`../../prompts/opencart_web_test_prompts.md`](../../prompts/opencart_web_test_prompts.md).

## Scenario mapping

| Prompt | Spec | Data |
| --- | --- | --- |
| 1. Registration | `account.spec.ts` | `RandomDataUtil.generateCustomerPayload()` |
| 2. Valid login | `account.spec.ts` | `Helper.getLoginDetails()` / `.env` |
| 3. Invalid login | `account.spec.ts` | Unique unregistered customer |
| 4. Logout | `account.spec.ts` | `Helper.getLoginDetails()` / `.env` |
| 5. Search | `shopping.spec.ts` | `Helper.getProductDetails()` |
| 6. Add to cart | `shopping.spec.ts` | `Helper.getProductDetails()` |
| 7. Full shopping journey | `shopping.spec.ts` | Unique customer and configured product |
| 8. Data-driven login | `login-data-driven.spec.ts` | Five rows from `testdata/opencart_logindata.json` via `DataProvider` |

## Conventions

- Page objects are exposed through [`fixtures/pageFixtures.ts`](../../fixtures/pageFixtures.ts); see the [architecture map](../../docs/ARCHITECTURE.md) for the current storefront/account/Admin layers.
- Page objects keep locators private and expose typed actions, boolean checks, and value readers.
- Navigation with a known destination returns its page-object type. Login and registration submission remain `Promise<void>` actions; tests explicitly verify the outcome rather than assuming submission succeeded.
- Specs use `expect.poll()` for retried checks through the page-object interface, and `expect(page).toHaveURL()` for navigation. Assertions remain in specs.
- Composite actions log their operation and error type, then rethrow the original error. Logs do not explicitly include supplied credentials.
- Public methods document parameters and return values. No new browser contexts or page objects are constructed in specs.
- Each test starts with an isolated browser context. Registration creates a unique persistent customer; no existing database records are reset or deleted.
- The data-driven failure rows accept either the no-match warning or the observed one-hour login-attempt-limit warning. This checks rejected authentication under repeated runs. The standalone invalid-login scenario uses a unique email and requires the exact no-match warning.

## Running

From the project root, with the existing OpenCart/MySQL containers running:

```sh
bash scripts/ci/run-tests.sh test:web chromium tests/web
bash scripts/ci/run-tests.sh test:web webkit tests/web
bash scripts/ci/run-tests.sh test:datadriven chromium tests/web
```

Tests are headless through the existing configuration. `APP_EMAIL` / `APP_PASSWORD` must identify an enabled, unlocked customer with the matching password. The successful external-data row resolves these same environment credentials; failure rows remain synthetic data. Tests do not provision or repair that reusable account. The commands above select only `tests/web`; selecting the `@web` tag across the repository also includes DB-backed journeys.

## Historical verification notes

The following notes record earlier runs and a one-time account setup. They are
retained as diagnostic history, not proof of current credentials, browser health,
or a passing suite. Use the prerequisites above and a fresh run for current status.

### Initial verification on 2026-11-02

- Full Chromium run: **9 passed, 3 failed**. Configured valid login, configured-customer logout, and the successful external-data row were rejected by OpenCart.
- Independent scenarios in Chromium and WebKit, twice each: **36 passed** (nine scenarios × two browsers × two repetitions).
- Firefox single-test reproduction: browser exits before test execution with `Could not find profile folder`.
- Strict TypeScript check passed using the existing TypeScript 5.9.3 compiler installed in the local BuildingOS workspace. This project still does not declare TypeScript as a dependency; `npx --no-install tsc --noEmit` is therefore not yet a self-contained project check.
- Live Playwright CLI inspection reconfirmed that blank email/password remain empty and produce the no-match warning.

At that verification point, full-suite success criteria were not met. See the reusable-customer setup below for the subsequent fix. No tests are skipped or marked expected-to-fail.

### Reading those authentication failures

The report reviewed before the documentation pass was timestamped
`2026-11-02T18:19:52.336Z` (20:19:52 in Israel).
Its three failures occur before successful authentication:

- **Valid customer login:** the captured page reports the one-hour login-attempt lockout.
- **Customer logout:** the initial authenticated-dashboard check fails, so the logout action is never reached.
- **Login data row 1:** the captured page reports no matching email/password.

At that point, the first two failures required checking the configured customer
and the third required checking the separate success-row credentials used then.
The current successful JSON row resolves `APP_EMAIL` / `APP_PASSWORD`, sharing
the same account as the standalone login/logout tests. Repeated attempts against
bad credentials can cause lockout; increasing assertion timeouts does not repair
credentials or account state. The tests do not provision or reset this configured
account. Newly generated registration/journey customers are separate.

The documentation pass adds JSDoc to each scenario and page class, plus comments about
fixture lifecycle, retrying assertions, exact product matching, blank credentials, and price
calculations. It does not change API/DB code, credentials, or test expectations.

### Reusable customer setup recorded in that session

A dedicated customer was registered through the storefront and verified by logging out
and logging in with the new credentials. The successful JSON row and `.env` login
credentials now refer to that same customer. Negative JSON rows were preserved.
This was a one-time setup: ordinary registration tests do not overwrite the dataset.
The account remains in OpenCart so login tests can run independently and in any order.
Earlier missing-account failures above describe the reports before this setup.

After this setup, the complete Chromium and WebKit web suites passed: **24/24 tests**.
Firefox was not rerun; its previously reported browser-launch issue remains unverified.

The reusable login account is configured by `APP_EMAIL` and `APP_PASSWORD`.
The successful data row references these environment variables instead of storing credentials.
