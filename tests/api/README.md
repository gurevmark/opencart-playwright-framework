# FakeStore API tests

These **67 tests** use Playwright's `request` fixture to exercise login, products, users and carts. The `chromium` argument selects a Playwright project. The HTTP tests run without launching a browser. The controlled FakeStore service has its own MongoDB database, separate from OpenCart's MySQL.

[Project overview](../../README.md) · [Development guide](../../docs/DEVELOPMENT.md) · [Known issues](../../docs/KNOWN_ISSUES.md)

## Choose the API and run the tests

Run commands from the repository root. For repeatable results, use the controlled service. Before a host run, check the destination in `API_BASE_URL`. The suite sends login credentials and makes POST, PUT and DELETE requests, including requests against configured existing records.

| Run | Command | Target |
| --- | --- | --- |
| All API tests in Docker | `node scripts/ci/local-docker.mjs test test:api chromium` | The `opencart-local-ci` runner uses `http://fakestore:6400` and the seeded records. |
| Just carts in Docker | `node scripts/ci/local-docker.mjs test test:api chromium tests/api/carts.spec.ts` | The same controlled service and dataset. |
| All API tests on the host | `bash scripts/ci/run-tests.sh test:api chromium tests/api --output=test-results/host` | Uses the host configuration. The default URL is `https://fakestoreapi.com`. Use an authorized test endpoint with the simulated-write behavior below. |
| Four host smoke cases | `bash scripts/ci/run-tests.sh test:sanity chromium tests/api --output=test-results/host` | The configured API handles a login and reads of the three collections. |

The Docker helper starts OpenCart, MySQL, FakeStore and MongoDB, runs the FakeStore integration checks and OpenCart URL checks, then starts the selected Playwright cases. Even a Docker command with `--list` goes through that preparation. From the host, the controlled API's default address is `http://127.0.0.1:16406`. Its `GET /health` response identifies `service` as `controlled-fakestore` and reports the dataset version. Inside Docker and CI the address is `http://fakestore:6400`. [Local containers](../../docker/README.md) · [CI setup](../../docs/CI.md) · [Controlled service](../../docker/fakestore/README.md)

To list cases without contacting an API or starting Docker, install the local dependencies with `npm ci`. In a clean checkout these six nonsecret selectors are sufficient for discovery.

```sh
PRODUCT_ID=1 USER_ID=1 CART_ID=1 LIMIT=3 START_DATE=2020-01-01 END_DATE=2020-03-02 \
  bash scripts/ci/run-tests.sh test:api chromium tests/api --list --output=test-results/host
```

The host `--output` keeps Playwright's capture cleanup away from `test-results/local-docker/`. With the configured reporters, `--list` still replaces the host HTML and JUnit reports and adds skipped results to Allure. Use a separate checkout to keep an earlier report intact. [Report behavior](../../docs/REPORTS.md) · [Known report issues](../../docs/KNOWN_ISSUES.md)

## Coverage

The original 34 course prompts produced 36 cases. Prompts 35 through 43 added another 31. Counts are for one Playwright project. [Course API requirements](../../prompts/fakestore_api_test_prompts.md)

| Spec | Cases | Prompts | What it checks |
| --- | ---: | --- | --- |
| [auth.spec.ts](auth.spec.ts) | 7 | 1–2, 35 | Successful login, invalid username and password separately, missing and empty credentials. |
| [products.spec.ts](products.spec.ts) | 21 | 3–12, 29, 32, 36–40 | Lists, IDs, limits, sorting, encoded categories with spaces or apostrophes, unknown category, missing product, schema and CRUD. |
| [users.spec.ts](users.spec.ts) | 16 | 13–19, 30, 33, 36–38 | Lists, IDs, limits, sorting, missing user, schema, CRUD and distinct response shapes when writing. |
| [carts.spec.ts](carts.spec.ts) | 23 | 20–28, 31, 34, 36–38, 41–43 | Lists, IDs, limits, sorting, owner, missing owner, date boundaries, multiple products and quantity changes, schema and CRUD. |

Every case has `@master` and `@api`. Four carry `@sanity`, and the other 63 carry `@regression`. The additional `@datadriven` tag selects 21 parameterized cases. Three `@end-to-end` workflows create, update and delete one resource inside a single test. To run only those three against your selected host API, use `bash scripts/ci/run-tests.sh test:e2e chromium tests/api --output=test-results/host`.

## Data and configuration

| Source | Responsibility |
| --- | --- |
| [Routes](../../api/endpoints/routes.ts) | Relative paths and parameter templates. Each spec calls `test.use({ baseURL: apiConfig.baseURL })`. |
| [API support](../../utils/fakestoreTestSupport.ts) | `apiConfig` reads the environment. `apiData` loads deterministic JSON through `DataProvider`. `expectSchema` uses AJV and reports schema errors without the response body. `expectGeneratedId` requires a positive integer. |
| [Request data](../../testdata/fakestore_api_data.json) | Payloads and filters specified by the course prompts. `additionalCoverage` holds limit cases, a missing ID, encoded categories, date intervals with expected IDs, and two-product cart bodies. |
| [Response schemas](../../api/schemas/) | Shapes for stored records returned by reads, including product `rating` and user/cart `__v`. Write responses have their own operation-specific expectations. |
| [Controlled seed](../../docker/fakestore/seed.json) | The `fakestore-ci-v1` dataset has six products, five users and five carts. The [seed loader](../../docker/fakestore/seed.mjs) assigns the dedicated credentials to user 1. The local Docker helper supplies the corresponding login inputs. |

For a host run, use exported variables or the root `.env`. [Environment template](../../.env.example) · [Configuration guide](../../docs/CONFIGURATION.md)

- `API_BASE_URL` selects the destination for **all** requests. The Docker runner explicitly selects its controlled service. A direct host run falls back to public FakeStore when the variable is empty.
- `PRODUCT_ID`, `USER_ID` and `CART_ID` must identify existing records. The chosen user needs at least one cart. `USER_ID` selects records for user/cart reads. Login uses `USERNAME` and `PASSWORD`.
- The ordinary limit case expects exactly `LIMIT` entries in each collection. The controlled seed uses ID `1` for all three selectors and limit `3`. `START_DATE` and `END_DATE` are inclusive bounds. The controlled range `2020-01-01` through `2020-03-02` includes seeded carts. All three IDs, the limit and both dates are required when any API spec is imported, including during discovery.
- `USERNAME` and `PASSWORD` belong to an existing synthetic FakeStore account. The user write payloads also read the password from the environment. A user returned by `POST /users` exists only in that response, so logging in as the newly created user yields `401`. Keep actual credentials in the local environment or CI Secrets.

## Expected responses

| Operation | Controlled FakeStore behavior |
| --- | --- |
| Login | Valid credentials return `201` and JSON containing a nonempty token. Incorrect supplied credentials return `401`. Missing or empty fields return `400`. Read the plain-text errors with `response.text()`. |
| Missing record | A missing numeric ID returns `200`. The product body is empty. User and cart bodies contain JSON `null`. An unknown category or cart owner returns `[]`. |
| Limit and sort | Both `limit=0` and a limit larger than the collection return the full list. With `sort=desc&limit=3`, products reverse the first three ascending IDs (`3, 2, 1` in the seed). Users and carts take the highest IDs first (`5, 4, 3`). Combined tests check count, distinct IDs, direction and schema. |
| Date ranges | The generic range test permits an empty result. Separate cases require the exact IDs. January 1, 2020 returns only cart `4`. January 3 through February 29, 2020 returns `[]`. |
| Create and update | `POST` returns `201` with a generated ID. A new user's body consists only of `{ id }`. `PUT` returns `200`. Its user response echoes the submitted fields. Product and cart responses also include the ID from the path. |
| Delete | An existing ID returns `200` with the stored record, which is checked against its schema. Deleting an ID returned by a simulated create gives an empty product body or JSON `null` for users and carts. |

Writes are simulated. MongoDB retains its original records without per-test cleanup. Each collection generates an ID by adding one to its highest **stored** ID, so successive creates can return the same number. A workflow reuses its returned ID in the next HTTP request and checks the response for that operation.

The four separate [service integration checks](../../docker/fakestore/integration.test.mjs) cover JWT signatures and expiry, preservation of seeded data after CRUD, MongoDB permissions and a second initialization with credential checks. They run in addition to the 67 Playwright cases.

## Add a case and diagnose a failure

1. Start in the spec for the resource. For a filter or boundary case, add a named row and its expected outcome to an existing `additionalCoverage` array when appropriate. Match exact-ID expectations to the [controlled seed](../../docker/fakestore/seed.json).
2. Use `request`, a route from `Routes`, and a deterministic payload. Encode category path parameters with `encodeURIComponent`. Check status before parsing the body, then assert the contract for that operation. Put applicable tags in the test title.
3. Keep standalone update/delete cases independent by using a configured existing ID. For a workflow, capture the generated ID inside one `test` and record the stages with `test.step`. Verify persistence in the service integration tests when that is the behavior under test.
4. List the chosen file on one project, then execute it against the controlled service. For example, use `node scripts/ci/local-docker.mjs test test:api chromium tests/api/carts.spec.ts`. Confirm the case appears under its intended tags.
5. Keep raw captures and console output private. A failed `toHaveLength` on an array of user objects can print their `password` fields to the console even when the stored reports are filtered. Compare array lengths as numbers and password equality as a boolean. Use a field name, status and expected result in diagnostics. Keep credentials, response bodies and tokens out of titles, step names and attachments. See API-01 in [known issues](../../docs/KNOWN_ISSUES.md).

On November 3, 2026, all 67 cases passed against the public API with two workers in the Chromium project. That run used a console reporter and a separately cached TypeScript compiler for strict type checking. The project manifest does not declare a standalone compiler. A separate run on GitHub received Cloudflare `403` responses from the public service. The current workflow tests the controlled service on its own dataset. [Project dependencies](../../package.json) · [CI verification history](../../docs/CI.md)
