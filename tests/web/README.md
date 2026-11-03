# OpenCart web tests

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

- All eight page objects are exposed through `fixtures/pageFixtures.ts`.
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
npx --no-install playwright test tests/web --grep @master
npx --no-install playwright test tests/web --project=chromium --grep @master
npx --no-install playwright test tests/web --grep @datadriven
```

Tests are headless through the existing configuration. The `.env` customer (`APP_EMAIL` / `APP_PASSWORD`) and the successful external-data row must each identify an enabled customer with the matching password. The successful external-data row resolves the same environment credentials; failure rows remain synthetic data.

## Verification on 2026-11-02

- Full Chromium run: **9 passed, 3 failed**. Configured valid login, configured-customer logout, and the successful external-data row were rejected by OpenCart.
- Independent scenarios in Chromium and WebKit, twice each: **36 passed** (nine scenarios × two browsers × two repetitions).
- Firefox single-test reproduction: browser exits before test execution with `Could not find profile folder`.
- Strict TypeScript check passed using the existing TypeScript 5.9.3 compiler installed in the local BuildingOS workspace. This project still does not declare TypeScript as a dependency; `npx --no-install tsc --noEmit` is therefore not yet a self-contained project check.
- Live Playwright CLI inspection reconfirmed that blank email/password remain empty and produce the no-match warning.

At that verification point, full-suite success criteria were not met. See the reusable-customer setup below for the subsequent fix. No tests are skipped or marked expected-to-fail.

## Reading the reported authentication failures

The report reviewed before the documentation pass was timestamped
`2026-11-02T18:19:52.336Z` (20:19:52 in Israel).
Its three failures occur before successful authentication:

- **Valid customer login:** the captured page reports the one-hour login-attempt lockout.
- **Customer logout:** the initial authenticated-dashboard check fails, so the logout action is never reached.
- **Login data row 1:** the captured page reports no matching email/password.

Check the enabled customer and password corresponding to `APP_EMAIL` / `APP_PASSWORD`
for the first two scenarios, and the separate success row in `testdata/opencart_logindata.json`
for the third. Repeated attempts against bad credentials can cause lockout; increasing
assertion timeouts does not repair either prerequisite. The tests do not provision or reset
these configured accounts. Newly generated registration/journey customers are separate.

The documentation pass adds JSDoc to each scenario and page class, plus comments about
fixture lifecycle, retrying assertions, exact product matching, blank credentials, and price
calculations. It does not change API/DB code, credentials, or test expectations.

## Reusable customer setup

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
