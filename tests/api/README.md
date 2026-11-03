# FakeStore API coverage

67 independent tests implement the original 34 prompts and the extended regression
scenarios 35–43 in `prompts/fakestore_api_test_prompts.md`: 36 original cases plus
31 additional cases.

| Spec | Cases | Prompt numbers | Coverage |
| --- | --- | --- | --- |
| `auth.spec.ts` | 7 | 1–2, 35 | Login success, invalid username/password separately, missing and empty credentials |
| `products.spec.ts` | 21 | 3–12, 29, 32, 36–40 | Lists, ID, limit boundaries, sorting with limits, encoded/unknown categories, missing ID, CRUD, schema, workflow |
| `users.spec.ts` | 16 | 13–19, 30, 33, 36–38 | Lists, ID, limit boundaries, sorting with limits, missing ID, CRUD, schema, workflow |
| `carts.spec.ts` | 23 | 20–28, 31, 34, 36–38, 41–43 | Lists, ID, date boundaries, owner/missing owner, limit boundaries, sorting with limits, missing ID, multiple products, CRUD, schema, workflow |

Run locally from the project root (API requests do not launch a browser):

```sh
bash scripts/ci/run-tests.sh test:api chromium
```

The hosted GitHub workflow runs the 27 OpenCart web/database tests. This live API
suite is kept separate because FakeStore returned Cloudflare HTTP 403 challenge
pages to GitHub's hosted runner, including on public endpoints. Its assertions
remain unchanged. See [CI setup](../../docs/CI.md) for the coverage split.

Tags: `@master`, `@api`, `@sanity` for login/list smoke tests, `@regression`
for other tests, `@datadriven` for parameterized additional cases, and
`@end-to-end` for the three workflows.
Each workflow executes its steps inside one test, so it needs no cross-test serial dependency.

Configuration reuses `.env`: `API_BASE_URL`, `USERNAME`, `PASSWORD`, `PRODUCT_ID`,
`USER_ID`, `CART_ID`, `LIMIT`, `START_DATE`, and `END_DATE`.
`USERNAME` and `PASSWORD` must belong to an existing FakeStore demo user. Arbitrary
credentials or a user returned by `POST /users` cannot be used to log in, because
FakeStore does not persist created users. `USER_ID` selects an existing user for
user/cart tests; it does not create or authenticate that user.
The cart date filter accepts an empty result for a valid range. To exercise checks
on returned records, use a range covering the demo carts (for example,
`2020-01-01` through `2020-03-02`).
The deterministic payloads and filter values live in `testdata/fakestore_api_data.json`.
Its `additionalCoverage` section holds limit boundaries, missing IDs, category names,
date intervals with expected IDs, and two-product cart payloads. These fixtures
target FakeStore's demo dataset; update them when targeting a different dataset.
The user write payloads reuse the configured API password without putting it in the data file.
Routes, all three existing schemas, AJV, and `DataProvider` are reused.
The specific prompt's deterministic-data requirement takes precedence over the generic
context's randomized payload examples. Independent update/delete tests use configured IDs;
only the explicitly requested workflows chain created IDs.

Live response contracts verified during implementation:

- User creation returns only `{ id }`; user update echoes submitted fields without an ID.
- Writes are simulated. Workflows validate responses and reuse the generated ID, without
  assuming a subsequent GET can retrieve the created resource.
- Deleting a generated product returns an empty body; generated users/carts return `null`.
  Deleting configured existing IDs returns objects checked against the existing schemas.
- Invalid login returns plain text, parsed with `response.text()`.
- Missing/empty credentials return `400`; incorrect supplied credentials return `401`.
- `limit=0` returns all available records. An oversized limit also returns the full list.
- Combined sort/limit tests check count, distinct IDs, ordering, and item schemas.
  Products apply the limit before descending sorting in the observed live behavior;
  users and carts select the highest IDs first. Tests do not impose one selection
  policy across these endpoints.
- Missing numeric IDs return `200`: an empty body for products and JSON `null` for
  users/carts. An unknown category or cart owner returns an empty array.
- The single-day cart fixture requires a real match and checks inclusive boundaries;
  a separate empty-interval fixture verifies an empty array exactly.

Validation on 2026-11-03: all 67 tests passed against the configured live API with
two workers using the existing `chromium` project (no browser was launched).
Strict TypeScript checking passed using an existing cached compiler; this project does
not currently declare a `typescript` dependency, so plain `npx tsc` is not reliable here.
The verification run used `--reporter=list --output=/tmp/fakestore-api-extended-results` to preserve
existing report files. Normal runs use the project's configured reporters.
