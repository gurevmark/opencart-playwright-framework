# Local OpenCart environments

Run commands from the repository root. Choose the Compose project that owns the data you intend to use.

| Task | Compose project | Default addresses from the host |
| --- | --- | --- |
| Run the CI-style tests in Docker | `opencart-local-ci` runs OpenCart, MySQL, controlled FakeStore, MongoDB and a one-off Playwright container. | Storefront `http://localhost:18086/opencart/upload/`, MySQL `127.0.0.1:13316`, FakeStore `http://127.0.0.1:16406` |
| Use an existing store or run Playwright on the host | `framework1-opencart` runs OpenCart and MySQL. Host-side API tests use the endpoint configured in `API_BASE_URL`. | Storefront `http://localhost/opencart/upload/`, MySQL `127.0.0.1:3306` |

MySQL and FakeStore publish their ports on the loopback interface. MongoDB is reachable inside the Compose network only. The storefront port binds to all host interfaces, even when the configured storefront URL uses `localhost`.

## Run the full stack in Docker

Start Docker with Compose available and use Node.js on the host. The test image supplies the test dependencies and browsers. Choose one of these commands.

```sh
npm test                        # All scenarios in Chromium
npm run test:api                # Controlled FakeStore API
npm run test:sanity -- firefox  # Sanity tests in Firefox
```

These npm commands call `scripts/ci/local-docker.mjs`. You can also invoke it directly, for example `node scripts/ci/local-docker.mjs test test:api chromium`. The helper combines three Compose files, builds the Playwright image and waits for the four application and database services. It runs the FakeStore integration checks and OpenCart URL checks before the selected tests. The command returns the test exit code. The four services stay available for diagnosis after the test container exits. [Local helper](../scripts/ci/local-docker.mjs) · [OpenCart and MySQL](../docker-compose.yml) · [FakeStore and MongoDB](../docker-compose.ci.yml) · [Playwright](../docker-compose.test.yml)

Inside the Compose network, Playwright uses `http://opencart/opencart/upload/`, `database:3306` and `http://fakestore:6400`. OpenCart generates internal storefront and Admin links when the request host is `opencart` or `opencart:80`. Requests from the host browser use the configured external URL. The test container has 1 GB of private shared memory for browser processes.

```sh
node scripts/ci/local-docker.mjs up      # Start the four services without running tests
node scripts/ci/local-docker.mjs status  # Inspect this project's containers
node scripts/ci/local-docker.mjs stop    # Stop the services
node scripts/ci/local-docker.mjs down    # Remove containers and network, keep named volumes
```

The helper passes its own settings to Compose with `--env-file /dev/null`. Its first invocation creates an ignored, private `.docker-local/runtime.json` containing generated credentials and published ports. Keep this file for as long as you keep the volumes. If a host port is busy, edit the relevant entry under `ports`, then run `up` again.

HTML and JUnit reports go to `reports/local-docker/`, raw Allure results to `allure-results/local-docker/`, and browser captures to `test-results/local-docker/run/`. To view a Docker run in the separate Allure service, use the following commands after the tests finish. [Report formats and history](../docs/REPORTS.md)

```sh
npm run allure:up
npm run allure:generate -- local-docker
npm run allure:open -- local-docker
```

## Use the existing store from the host

Plain `docker compose` uses the root `.env` and the `framework1-opencart` project. For a new installation, populate `.env` from the template. For an existing installation, inspect its containers, volumes and published ports first. [Environment template](../.env.example)

```sh
docker compose ps --all
docker compose port opencart 80
docker compose port database 3306
docker volume ls --filter label=com.docker.compose.project=framework1-opencart
```

The `framework1-opencart_opencart_database` volume holds MySQL data. The `framework1-opencart_opencart_files` volume holds the store files. `docker compose stop` stops the containers. `docker compose start` starts existing containers with their existing images. Check the schema before starting OpenCart against an existing volume. The startup procedure below explains why. `docker compose up -d --wait` can create or recreate containers. `docker compose down --volumes` deletes the named volumes and their data.

| Environment settings | What to check |
| --- | --- |
| `WEB_APP_URL`, `OPENCART_HTTP_SERVER`, `OPENCART_PORT` | The web test URL and OpenCart's public URL should point to the same storefront and end in `/opencart/upload/`. Include the published port in both URLs if you change it from 80. |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Host-side tests use `DB_HOST=127.0.0.1` and the published port. The store container uses `database:3306`. The MySQL health check authenticates as the application user and executes `SELECT 1`. |
| `APP_EMAIL`, `APP_PASSWORD`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Supply the test customer and administrator for this store. If you set `OPENCART_DB_*`, `OPENCART_TEST_*` or `OPENCART_ADMIN_*` overrides, align the corresponding test settings with the accounts the container uses. |
| `OPENCART_DB_ROOT_PASSWORD` | A new MySQL volume requires a separate initialization password. An existing volume uses the accounts already stored in MySQL. Rotate credentials in the database itself. |

After changing only the published MySQL port, run `docker compose up -d --no-deps --wait database`, then check `docker compose port database 3306`. The following host-side Chromium test registers a customer in the test store, verifies it in Admin and MySQL, and cleans up its records. Install the host test dependencies and Chromium first. Give host runs their own `--output` directory because Playwright clears it before a run. [Database test guide](../tests/db/README.md)

```sh
npx --no-install playwright test tests/db/customer-registration.spec.ts --grep @db --project=chromium --output=test-results/host
```

## What OpenCart does at startup

1. The entrypoint built from this repository requires database, administrator and test customer credentials. If the store volume lacks `upload/index.php` or the expected `react/promise` vendor file, it copies the distribution into that volume. [Entrypoint](opencart/entrypoint.sh)
2. The database probe runs `SHOW TABLES LIKE 'oc_setting'` for the default `oc_` prefix. A match skips installation. Zero matches or a query error return exit code 10, which starts the OpenCart installer. The installer initializes the schema and creates the administrator, using `admin@example.test` as the default administrator email. [Database probe](opencart/database-state.php)
3. Each successful start writes `upload/config.php` and `upload/admin/config.php` and looks up the test customer by case-insensitive email. It creates a missing customer. Existing customers keep their stored passwords. The entrypoint then removes `upload/install`, assigns ownership to `www-data` and starts Apache. [Configuration writer](opencart/configure.php) · [Customer seeding](opencart/seed-customer.php)

**Check the schema before starting OpenCart on an existing volume.** A partial database containing `oc_customer` but no table matching `oc_setting` can trigger installation, which can drop and recreate `oc_customer`. Conversely, `ocXsetting` matches the pattern and skips installation because SQL `LIKE` treats `_` as any single character. Inspect an unfamiliar or partially restored schema before starting the store. If the existing database container is stopped, start MySQL alone with `docker compose start database`. Once it is ready, list the tables visible to the application account.

```sh
docker compose exec -T database sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" exec mysql --host=127.0.0.1 --user="$MYSQL_USER" "$MYSQL_DATABASE" --execute="SHOW TABLES"'
```

For a startup failure in the two-service project, inspect `docker compose ps --all` and `docker compose logs --tail=60 database opencart`. For the full stack, use the helper's `status` command and open the affected container's log in Docker Desktop. With the default ports, `curl -fsS http://127.0.0.1:16406/health` checks the controlled API and its MongoDB connection. If a login fails after an environment change, check the selected volume and the credentials stored in that installation.

## Images and CI

The course uses OpenCart 3.0.3.8 with PHP 7.4. The Dockerfile uses Debian's official archive for Bullseye packages and disables the expiry check for archived metadata while retaining signature verification. [OpenCart image](opencart/Dockerfile)

GitHub Actions creates a separate Compose project for each run attempt. The Playwright image uses the version resolved in the root lockfile and caches the npm dependency layer. CI loads the image into the runner's Docker engine and supplies credentials at runtime. Cleanup removes the volumes for that attempt. [Playwright image](playwright/Dockerfile) · [GitHub Actions setup](../docs/CI.md) · [Controlled FakeStore](fakestore/README.md)
