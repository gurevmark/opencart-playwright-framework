# OpenCart storefront tests

The three specs in this directory exercise the storefront through a real browser. They register **12 tests per browser project**. To check whether an existing store is reachable, start with product search. A full run also registers two customers and leaves their records in the store.

[Project overview](../../README.md) · [Development guide](../../docs/DEVELOPMENT.md) · [Known issues](../../docs/KNOWN_ISSUES.md)

## Run the suite

Run commands from the repository root. Choose where the browser and the store will run.

| Target | Command | What it does |
| --- | --- | --- |
| Existing local OpenCart | `docker compose ps` | Shows services for the base project, `framework1-opencart`. Check the storefront address and published port before using it. |
| Playwright on the host | `bash scripts/ci/run-tests.sh test:web chromium tests/web --output=test-results/host` | Runs the 12 storefront tests against the URL in your host environment. Install the project dependencies and the chosen browser first. |
| Isolated Docker stack | `node scripts/ci/local-docker.mjs test test:web chromium tests/web` | Builds the runner, starts or reuses the four services in `opencart-local-ci`, checks them, and runs the same 12 tests. The application and database containers stay up. |

The `test:web` suite selects the **tag** `@web`. The path `tests/web` limits collection to this directory. Without the path, the tag selects **26 tests** per browser project, including 14 [UI tests that also use MySQL](../db/README.md). Tag-only host discovery also imports the API specs, which require their six fixture selectors. Paths likewise narrow `test:sanity`, `test:datadriven` and `test:e2e` to a single directory. [Runner](../../scripts/ci/run-tests.sh) · [Host configuration](../../docs/CONFIGURATION.md)

```sh
# List this directory on the host. The storefront and browser are not used.
bash scripts/ci/run-tests.sh test:web chromium tests/web --list --output=test-results/host

# Run just the product search against the configured host storefront.
npx --no-install playwright test tests/web/shopping.spec.ts --project=chromium --grep 'Product search' --output=test-results/host

# Five storefront smoke tests, or the five login rows.
bash scripts/ci/run-tests.sh test:sanity chromium tests/web --output=test-results/host
bash scripts/ci/run-tests.sh test:datadriven chromium tests/web --output=test-results/host

# Run the complete shopping journey in the Docker stack on WebKit.
node scripts/ci/local-docker.mjs test test:e2e webkit tests/web/shopping.spec.ts
```

Host examples use `--output=test-results/host` because Playwright cleans its capture directory before a run. The shared `test-results` directory can include captures from an earlier Docker run. With the configured reporters, even `--list` replaces the host HTML and JUnit reports and adds **skipped** results to Allure. Use a separate checkout for discovery if you need to preserve the previous reports. Passing `--list` to the Docker helper still builds the runner and checks the services. [Report locations](../../docs/REPORTS.md) · [Known report issues](../../docs/KNOWN_ISSUES.md)

The Docker helper accepts the suite, then the browser, followed by paths or Playwright options. Chromium is its default. A direct Playwright CLI run with no `--project` selects Chromium, Firefox and WebKit, or 36 storefront cases with the current data. Tests run headlessly, have a 30-second timeout and use `fullyParallel`. A nonempty `CI` enables one worker and up to two retries. Ordinary host runs use Playwright's default worker count and zero retries. [Playwright configuration](../../playwright.config.ts) · [Docker setup](../../docker/README.md)

## What the tests check

All 12 cases carry `@master`, `@web` and `@regression`. The prompt number identifies the original course requirement. [Storefront prompts](../../prompts/opencart_web_test_prompts.md)

| Prompt | Spec and test | Observable result | Additional tag |
| --- | --- | --- | --- |
| 1 | [account.spec.ts](account.spec.ts) · `Customer registration` | A new customer accepts the privacy policy, reaches `account/success`, continues to the account and sees the edit link. | `@sanity` |
| 2 | [account.spec.ts](account.spec.ts) · `Valid customer login` | The configured customer reaches `account/account` and can edit the account. | `@sanity` |
| 3 | [account.spec.ts](account.spec.ts) · `Invalid customer login` | The login form and guest menu remain available. A fresh, unregistered email produces the exact warning `Warning: No match for E-Mail Address and/or Password.` | — |
| 4 | [account.spec.ts](account.spec.ts) · `Customer logout` | The customer signs in, sees the logout confirmation, and uses Continue to return home. The menu shows Login and Register and hides Logout and Transactions. | `@sanity` |
| 5 | [shopping.spec.ts](shopping.spec.ts) · `Product search` | A guest searches for a known product. The route, heading and exact result name distinguish MacBook from MacBook Air and MacBook Pro. | `@sanity` |
| 6 | [shopping.spec.ts](shopping.spec.ts) · `Add product to cart` | A guest sets a quantity, sees confirmation and finds one matching cart row with that quantity. | `@sanity` |
| 7 | [shopping.spec.ts](shopping.spec.ts) · `Complete customer shopping journey` | A new customer registers, logs out, signs back in and adds a product. The scenario ends at cart review, checking quantity, unit price, line total and the displayed cart total. | `@end-to-end` |
| 8 | [login-data-driven.spec.ts](login-data-driven.spec.ts) · `Login row N` | Five JSON rows register five independent cases, each with its own result and retries. One expects success and four expect rejection. | `@datadriven` |

## Storefront and account data

| Setting | Requirement |
| --- | --- |
| `WEB_APP_URL` | Supply the storefront directory as the browser sees it. The base host setup typically uses `http://localhost/opencart/upload/`. The test container uses `http://opencart/opencart/upload/`. |
| `APP_EMAIL`, `APP_PASSWORD` | Valid login, logout and the successful JSON row share one enabled, unlocked customer. On startup the [OpenCart seed script](../../docker/opencart/seed-customer.php) creates the configured customer if the email is absent. Existing customers keep their password and status. Match any `OPENCART_TEST_*` overrides to these settings. |
| `PRODUCT_NAME`, `PRODUCT_QUANTITY`, `TOTAL_PRICE` | Defaults are `MacBook`, `1` and `$602.00`. The shopping journey expects an English storefront, a product available under that exact name, and a dollar total for the selected quantity. Update the expected total when the price or quantity changes. |

Host tests read exported variables and the root `.env`. The Docker helper supplies its own settings. [Environment template](../../.env.example) · [Account and product helpers](../../utils/helper.ts) · [Docker helper](../../scripts/ci/local-docker.mjs)

Registration and the shopping journey use `RandomDataUtil.generateCustomerPayload()` to generate a first name, last name, email, telephone and password. Each email starts with `pw-` and a UUID. The names and phone number are capped at 32 characters. Browser teardown closes the page and context. Each successful registration persists in OpenCart, including new records from retries after registration. The standalone invalid-login case generates fresh details without registering them. [Customer generator](../../utils/dataGenerator.ts) · [Page fixtures](../../fixtures/pageFixtures.ts)

### Login rows

The spec reads [opencart_logindata.json](../../testdata/opencart_logindata.json) relative to its own file during discovery. Each row contains a name (`testName` or `TestName`), string `email` and `password` fields, and an `expected` value of `success` or `failure`. The row number keeps test titles unique.

- **Success.** The checked-in row uses the markers `${APP_EMAIL}` and `${APP_PASSWORD}`. `DataProvider` reads them literally. The spec selects `Helper.getLoginDetails()` whenever `expected` is `success`. Adding a second successful row with a different email still exercises the same configured account. See COV-03 in [known issues](../../docs/KNOWN_ISSUES.md).
- **Failure.** The four rows supply a wrong pair, blank email, blank password, or both blank. `LoginPage.login()` converts whitespace-only values to empty strings and preserves other strings. The test verifies rejection, the guest menu and the value of any blank input.
- **Repeated attempts.** OpenCart counts failed logins. Repeated rows can receive its one-hour lockout warning. The table accepts that warning or the no-match warning. The standalone invalid-login case uses a fresh email to verify the specific no-match message.

The [CSV](../../testdata/opencart_logindata.csv) and [Excel](../../testdata/opencart_logindata.xlsx) examples each contain two data rows. `DataProvider.readCsv()` treats the header as property names and skips empty lines. `readExcel()` returns arrays from the first sheet, including its header. Map those arrays to named fields before switching the login spec to Excel. The current five cases come from JSON. [Data readers](../../utils/DataReader.ts)

## Add a storefront test

1. Choose a nearby scenario and the result a customer can observe. For direct SQL verification or scoped database cleanup, start with the [database fixtures](../../fixtures/dbFixtures.ts) and [DB suite](../db/README.md).
2. Import `test` and `expect` from [pageFixtures.ts](../../fixtures/pageFixtures.ts). Fixtures share the isolated `page` and context for the current test. Request `homePage` to open `WEB_APP_URL`. Other fixtures wrap the current page. Register a new object in the fixture type and implementation when an existing object cannot perform the action.
3. Keep locators private in the corresponding [page object](../../pages/). Document the parameters and return values of public methods. Known transitions such as `homePage.openLogin()` return the destination object. Conditional submissions such as `loginPage.login()` and `registerPage.completeRegistration()` return `Promise<void>`. Composite actions that catch errors log the operation and error type and rethrow the original error.
4. Put assertions in the spec. Use `expect(page).toHaveURL(...)` for navigation and `expect.poll(() => pageObject.method())` for changing state. Use stable `test.step` titles, `@master`, `@web` and the applicable selection tags. List the file on one project, then run the scenario against the intended store. [Architecture](../../docs/ARCHITECTURE.md) · [Course implementation conventions](../../prompts/playwright-mcp-context.md)

| Page fixtures | What they cover |
| --- | --- |
| [homePage](../../pages/HomePage.ts), [registerPage](../../pages/RegisterPage.ts), [loginPage](../../pages/LoginPage.ts), [myAccountPage](../../pages/MyAccountPage.ts), [logoutPage](../../pages/LogoutPage.ts) | Storefront navigation, registration, login and account state. |
| [searchPage](../../pages/SearchPage.ts), [productPage](../../pages/ProductPage.ts), [cartPage](../../pages/CartPage.ts) | Search results, product details and cart rows. |
| [accountEditPage](../../pages/AccountEditPage.ts), [changePasswordPage](../../pages/ChangePasswordPage.ts), [adminLoginPage](../../pages/AdminLoginPage.ts), [adminCustomersPage](../../pages/AdminCustomersPage.ts) | Profile, password and administrator actions used by the DB suite. |

## Diagnose a failure

| Symptom | First check |
| --- | --- |
| Failure before the first named step | `homePage` reads `WEB_APP_URL` and navigates during fixture setup. Verify the URL from the browser's network and check store readiness. |
| Valid login, logout and login row 1 fail together | Check the shared customer's status, password and lockout message. A failure in the logout test's authentication step occurs before it attempts logout. |
| Search passes but totals differ | Check the selected product, quantity, currency and `TOTAL_PRICE`. The spec compares the product price to the cart unit price, unit price times quantity to the line total, and the displayed cart total to the configured string. The current numeric parser can discard a line total's sign or currency. See COV-02 in [known issues](../../docs/KNOWN_ISSUES.md). |
| Unexpected cases or browser | Check the path, tag and project. Host HTML is in `reports/index.html` and Docker HTML in `reports/local-docker/index.html`. |

On November 2, 2026, the initial Chromium run had nine passes and three authentication failures. The captures showed a lockout for valid login, a failure before logout and a no-match warning for login row 1. After a dedicated customer was registered and checked through logout and login, all 24 storefront cases passed across Chromium and WebKit. The nine independent scenarios had also passed twice on both browsers (36 executions). A host Firefox reproduction stopped at launch with `Could not find profile folder`. That day's strict type check used a separately installed TypeScript 5.9.3. On November 4, browser startup was recorded for all three projects in Docker. These results identify the environments and dates of those checks. [Dependencies](../../package.json) · [CI verification history](../../docs/CI.md)
