# Controlled FakeStore API for CI

This is a MongoDB-backed **compatibility fork for testing**, adapted from
[keikaavousi/fake-store-api](https://github.com/keikaavousi/fake-store-api/tree/d03d27dff14e48fbb612dd070e55d26d99fcc79e),
commit `d03d27dff14e48fbb612dd070e55d26d99fcc79e` (MIT). The upstream copyright and
license are retained in [LICENSE](LICENSE). Controllers have been adapted into
`app.mjs` and the server/bootstrap rewritten for current runtime libraries.

The 67 existing Playwright API assertions execute unchanged against this service.
These results verify the controlled application and fixtures; they do not prove
availability or behavior of the public `https://fakestoreapi.com` deployment.
Local tests still default to that public endpoint through the ignored local `.env`.

## Runtime and provenance

Verified stable versions on 2026-11-04: Node 26.13.0 LTS, MongoDB 9.0.4,
Express 5.3.0, MongoDB Node driver 7.8.0, and jsonwebtoken 9.0.3. Dependencies are
installed with `npm ci` from this directory's committed lockfile. The root test
framework dependency versions and lockfile are unchanged. The service runs as the
unprivileged `node` user.

The published 2022 source is not identical to the deployed public API contracts
already recorded in `tests/api/README.md`. This fork deliberately implements:

- HTTP 201 for successful login and simulated creation; missing/empty login fields
  return 400 with the established plain-text error; incorrect credentials return 401.
- Real HS256 JWTs with a runtime signing key and a 15-minute expiration. The old
  source's embedded signing key is not retained.
- Current product `rating`, user `__v`, and cart `__v` fields in the synthetic seed.
- User creation returning only `{id}` and update echoing the nested submitted fields.
- Missing products returning an empty body; missing users/carts returning JSON null.
- Inclusive cart date bounds, including the single-day `2020-01-01` fixture.
- Product limiting before descending order, with users/carts sorted before limiting.

GET and DELETE responses read actual MongoDB records. POST/PUT/PATCH/DELETE keep
FakeStore's simulated-write behavior and do not persist changes. This preserves
independent repeatable tests; the service integration checks verify non-persistence
rather than merely assuming it from the Playwright assertions.

## Synthetic fixture data

`seed.json` is a versioned, synthetic dataset (`fakestore-ci-v1`): six products,
five users, and five carts. Product/user/cart ID 1 and limit 3 match the CI test
configuration. Cart 4 is the only cart on `2020-01-01`; no carts fall within the
explicit empty-range test. Product categories include electronics, jewelery, and
both clothing categories.

No working passwords are stored in the seed. Bootstrap sets user 1's username and
password from the runtime environment and generates random passwords for the
remaining synthetic users. Like the public demo API, user response objects contain
a password field. Use only dedicated CI credentials and treat report/trace access
accordingly; no real customer or local/public API account is imported.

Seeding requires empty fixture collections. A recognized existing dataset is
accepted only when its version and configured login account still match. Unrecognized
populated fixture collections or changed fixture credentials fail startup rather than
being reset. Normal CI runs use a unique Compose project and new volumes.

## Containers and configuration

The root `docker-compose.ci.yml` adds two services only when combined explicitly
with `docker-compose.yml`:

- `fakestore-database`: authenticated MongoDB, no published host port. Initialization
  creates an application user with `readWrite` on the `fakestore` database only.
- `fakestore`: serves HTTP on container port 6400 and a loopback-only published port.
  `/health` verifies the MongoDB connection and identifies the controlled dataset.

The API receives `MONGODB_URI`, `MONGODB_USER`, `MONGODB_PASSWORD`, `API_USERNAME`,
`API_PASSWORD`, and `JWT_SECRET` through runtime environment variables. Passwords
are never build arguments. Startup validates required names and the signing key;
it does not print request bodies, credentials, JWTs or connection strings.

GitHub Actions supplies these additional repository secrets:

| Name | Use |
| --- | --- |
| `FAKESTORE_CI_USERNAME` | Dedicated synthetic user 1 login name |
| `FAKESTORE_CI_PASSWORD` | Dedicated synthetic user 1 login password |
| `FAKESTORE_JWT_SECRET` | Random signing key containing at least 32 bytes |
| `FAKESTORE_MONGO_PASSWORD` | MongoDB application account password |
| `FAKESTORE_MONGO_ROOT_PASSWORD` | Separate MongoDB initialization/root password |

The workflow fixes `API_BASE_URL=http://127.0.0.1:6400`, IDs 1, limit 3, and dates
`2020-01-01` through `2020-03-02`. Existing public FakeStore repository settings are
unused. The local `.env` and the default two-service Compose setup are unchanged.

CI builds and waits for all four services, runs this service's four integration
checks using `docker compose ... exec -T fakestore npm test`, then runs the selected
Playwright suite (all 94 tests by default). The service checks verify JWT signatures,
MongoDB fixture non-persistence, restricted database access, and bootstrap safety.
They are separate from the 67 API and 27 OpenCart/database framework scenarios.

This service is intended only for disposable development/test environments.
