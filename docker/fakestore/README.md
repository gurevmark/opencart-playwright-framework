# Controlled FakeStore API

GitHub Actions and the local full Docker stack run the 67 Playwright API scenarios against this MongoDB-backed test service. To run the API suite against its synthetic data, use the following command from the repository root.

```sh
node scripts/ci/local-docker.mjs test test:api chromium
```

A passing run describes this service and its fixtures. To exercise the public deployment, configure the host-side tests with the public API URL and its own demo credentials. [API suite guide](../../tests/api/README.md) · [Local Docker guide](../README.md)

## Runtime and provenance

The fork adapts `keikaavousi/fake-store-api` at commit `d03d27dff14e48fbb612dd070e55d26d99fcc79e`. The upstream copyright and MIT license accompany the source. The controllers were adapted in `app.mjs`, and the server and database initialization were rewritten for this test service. [Upstream source at the pinned commit](https://github.com/keikaavousi/fake-store-api/tree/d03d27dff14e48fbb612dd070e55d26d99fcc79e) · [License](LICENSE)

The versions recorded on 2026-11-04 were Node.js 26.13.0 LTS, MongoDB 9.0.4, Express 5.3.0, MongoDB Node.js driver 7.8.0 and jsonwebtoken 9.0.3. The image installs the service's dependencies using `npm ci` and its own committed lockfile. The server runs as the unprivileged `node` user. [Dockerfile](Dockerfile) · [Service dependencies](package.json) · [MongoDB image](../../docker-compose.ci.yml)

The fork implements the public API behavior recorded while developing the suite. The following details matter when writing assertions. [Route handlers](app.mjs) · [API tests](../../tests/api/README.md)

| Operation | Expected behavior |
| --- | --- |
| Login | Successful login returns 201 and an HS256 JWT signed with the runtime key, expiring after 15 minutes. Missing or empty fields return a plain-text 400 response. Wrong credentials return 401. |
| Read a missing ID | Selecting a missing product returns HTTP 200 with an empty body. A missing user or cart returns HTTP 200 with JSON `null`. |
| Create or edit a user | Creation returns 201 and only the new `id`. Updates echo the submitted user fields, including nested name and address. |
| Product, user and cart lists | Products include `rating`. Users and carts include `__v`. Products take the requested limit from ascending IDs before reversing for descending order. Users and carts sort before limiting. |
| Cart date filters | Both bounds are inclusive. The fixture for the single day `2020-01-01` returns cart 4. |

GET and DELETE responses read stored MongoDB records. POST, PUT, PATCH and DELETE simulate write responses. For example, creating a user returns an ID, and a later login with that user's credentials returns 401. The service checks compare the collections before and after simulated writes. [Service integration checks](integration.test.mjs)

## Synthetic fixture data

The `fakestore-ci-v1` dataset contains six products, five users and five carts. Product, user and cart ID 1 and limit 3 match the test configuration. The category strings include `electronics`, `jewelery`, `men's clothing` and `women's clothing`. Cart 4 is the only cart on `2020-01-01`. The suite also checks a date interval containing zero carts. [Fixture records](seed.json)

Bootstrap assigns user 1's username and password from the runtime environment and generates random passwords for the other fixture users. User responses expose a `password` field to match the demo API. Use disposable credentials and keep traces containing response bodies private. [Fixture initialization](seed.mjs)

On a fresh volume, bootstrap requires the products, users and carts collections to be empty. It inserts the fixtures and records a dataset version. On a later start, it checks the version and user 1's credentials. Unrecognized populated collections or a mismatch stop startup. CI provisions a new project and volumes for each attempt. For the persistent local stack, preserve the generated credentials with the volumes.

## Containers and configuration

The full local stack and CI add two services through the application Compose overlay. [Compose services](../../docker-compose.ci.yml)

| Service | From the test container | From the host |
| --- | --- | --- |
| `fakestore` | `http://fakestore:6400` | Local default `http://127.0.0.1:16406`. `/health` pings MongoDB and returns the fixture version. |
| `fakestore-database` | The API connects to `fakestore-database:27017`. | Accessible inside Compose only. The application user has `readWrite` privileges on the `fakestore` database. |

The API takes `MONGODB_URI`, `MONGODB_USER`, `MONGODB_PASSWORD`, `API_USERNAME`, `API_PASSWORD` and `JWT_SECRET` at runtime. Startup validates required settings and the signing key. Error messages identify invalid settings by name or report a generic startup failure. [Server startup](server.mjs) · [MongoDB initialization](mongo-init.js)

| GitHub Actions secret | Purpose |
| --- | --- |
| `FAKESTORE_CI_USERNAME` | Login name for synthetic user 1 |
| `FAKESTORE_CI_PASSWORD` | Login password for synthetic user 1 |
| `FAKESTORE_JWT_SECRET` | Random signing key of at least 32 bytes |
| `FAKESTORE_MONGO_PASSWORD` | MongoDB application password |
| `FAKESTORE_MONGO_ROOT_PASSWORD` | Separate MongoDB initialization password |

CI sets `API_BASE_URL=http://fakestore:6400`, the three IDs to 1, the limit to 3, and dates to `2020-01-01` through `2020-03-02`. It waits for all four services and runs four service checks covering JWT signatures and expiry, simulated writes, database permissions and repeatable initialization. The default Playwright run then executes 67 API and 27 OpenCart web/database scenarios. The root two-service Compose project serves the existing OpenCart installation. Host-side API tests choose their endpoint through the host environment. [GitHub Actions setup](../../docs/CI.md)
