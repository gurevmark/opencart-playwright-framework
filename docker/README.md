# Local OpenCart containers

The course's OpenCart 3.0.3.8 runtime remains on PHP 7.4 for compatibility. Its Debian 11 package sources now use the official Debian archive so fresh CI builds can download packages after Bullseye's retirement. Expiry checks are disabled only for the archived source metadata; package signature verification remains enabled. A PHP/OpenCart runtime upgrade is a separate change. See [Debian's archive](https://www.debian.org/distrib/archive) and [Bullseye LTS dates](https://wiki.debian.org/LTS/Bullseye).

The root `docker-compose.yml` manages the existing `framework1-opencart` Compose project. Its project name preserves the existing `framework1-opencart_opencart_database` and `framework1-opencart_opencart_files` named volumes. The storefront is at http://localhost/opencart/upload/.

From the project root, use `docker compose ps` to inspect the services, `docker compose stop` to stop them, and `docker compose start` to start existing containers. `docker compose up -d` can create or recreate containers; review configuration and volume names before using it. Never use `docker compose down --volumes` if the current data must be preserved.

On OpenCart startup, the entrypoint can install into an empty database, write configuration files, remove the installer, and create a test customer if absent. Review `opencart/entrypoint.sh` and its helper scripts before recreating or starting the service when these changes are not wanted.

Compose reads the root `.env`. Container settings use `OPENCART_` overrides when supplied, otherwise they inherit the framework's `DB_`, `APP_`, and `ADMIN_` settings. There are no usable password defaults. MySQL is published on `127.0.0.1` at `DB_PORT` (default `3306`) so host-side tests can reach it. The database health check authenticates as the application account and executes `SELECT 1`.

For a new database volume, also supply `OPENCART_DB_ROOT_PASSWORD` in your ignored local environment. MySQL requires this initialization password; it is separate from `DB_PASSWORD`. The OpenCart startup helpers require supplied database, administrator, and test-customer credentials before changing files or data. The installer email defaults to the synthetic `admin@example.test`.

For host-side tests, set `DB_HOST=127.0.0.1` and configure `DB_USER`, `DB_PASSWORD`, and `DB_NAME` in `.env` for an existing MySQL account. Updating a MySQL container's environment variables does not change accounts/passwords already stored in its volume. Preserve the application's working credentials unless intentionally rotating them.

GitHub Actions creates a separate four-service stack by adding `docker-compose.ci.yml`: OpenCart/MySQL plus a controlled FakeStore API/MongoDB pair. It passes credentials through process environment variables, without a `.env` file. The default local Compose command still manages only OpenCart/MySQL. See [GitHub Actions setup](../docs/CI.md) for the complete Secrets/Variables list. Do not run CI cleanup commands against this local project.

CI additionally builds `playwright/Dockerfile` from the repository root and runs
the selected tests in that image. Browser binaries come from the version-matched
official Playwright base; npm dependencies are cached in a separate Buildx layer
between runs. The image is loaded locally on the Ubuntu runner without registry
publication. Test code comes from the checked-out commit, credentials arrive only
at runtime, and reports are written to host-mounted output directories. See the
[image and cache notes](../docs/CI.md#playwright-image-and-build-cache).

For a complete local pre-push replica in Docker Desktop, run
`node scripts/ci/local-docker.mjs` from the repository root. It explicitly adds
`docker-compose.ci.yml` and `docker-compose.test.yml`, builds/runs the Playwright
service alongside all four application/database containers, and uses the
controlled API instead of the public endpoint. Its `opencart-local-ci` project,
ports, volumes and private generated credentials are separate from the existing
local OpenCart installation. After tests, the four application services remain
available in Docker Desktop; use the helper's `stop` or `down` command to stop or
remove only that project. See [full local setup](../docs/CI.md#full-docker-desktop-stack).

The shared test service joins the same Compose bridge network as the applications.
It uses `opencart:80`, `database:3306` and `fakestore:6400`, with private browser
shared memory. Docker Desktop's host-networking option is not needed. OpenCart
selects the configured internal base URL for internal service requests and retains
the external localhost URL for access from the Mac. The original two-service
runtime keeps its previous URL behavior when no internal URL is configured.

After changing the port mapping, `docker compose up -d --no-deps database` recreates only the database container and retains its named volume. Wait for its health check before running the headless database journey:

```sh
npx --no-install playwright test tests/db/customer-registration.spec.ts --grep @db --project=chromium
```
