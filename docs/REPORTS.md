# Local test reports

The configured Playwright reporters already produce three formats:

| Format | Host-side test run | Local Docker test run | How to view |
| --- | --- | --- | --- |
| Playwright HTML | `reports/index.html` | `reports/local-docker/index.html` | `npx --no-install playwright show-report reports` (or `reports/local-docker`) |
| JUnit XML | `reports/results.xml` | `reports/local-docker/results.xml` | An XML viewer or test-result importer |
| Allure raw results | `allure-results/` | `allure-results/local-docker/` | Generate an Allure report using the service below |

Allure results are the reporter's JSON and attachments; they are not yet a
viewable HTML report. Docker supplies the Allure generator and HTTP server, so
Java and the Allure CLI do not need to be installed on the Mac.

## Start the local Allure service

From the repository root, with Docker Desktop running:

```sh
npm run allure:up
npm run allure:status
```

This creates the separate `opencart-allure` Compose project and its `allure`
container, listening only on `127.0.0.1:5051`. The existing
`sections346-playwright` Allure container uses port 5050 and its own results;
it can run alongside this service. No OpenCart, MySQL, FakeStore or MongoDB
containers are started or recreated by these commands.

The image is pinned to `frankescobar/allure-docker-service:2.44.0`, the current
stable tag documented upstream when this setup was added. This is the same
Allure version as the older project's locally cached image. See the
[upstream image and multi-project documentation](https://github.com/fescobar/allure-docker-service#docker-versions).
No npm dependencies or reporter versions change.

## Generate and view reports

After an ordinary host-side test run:

```sh
# Example: reuse the existing local OpenCart configuration and containers.
bash scripts/ci/run-tests.sh test:web chromium
npm run allure:generate
npm run allure:open
```

After a run using the existing full local Docker helper:

```sh
node scripts/ci/local-docker.mjs test test:master chromium
npm run allure:generate -- local-docker
npm run allure:open -- local-docker
```

The helper can also generate a report from results already on disk; rerunning
tests is not required. Both commands accept `host` or `local-docker` and default
to `host`. On macOS, `allure:open` attempts to open the default browser. If no
browser is available, or on other platforms, use the printed URL. Opening a
report does not regenerate it.

| Allure project | Report URL | Persisted reports/history |
| --- | --- | --- |
| `host` | [Host report](http://127.0.0.1:5051/allure-docker-service/projects/host/reports/latest/index.html) | `allure-report/host/` |
| `local-docker` | [Docker report](http://127.0.0.1:5051/allure-docker-service/projects/local-docker/reports/latest/index.html) | `allure-report/local-docker/` |

Generate only after the test process exits, including after a failed run.
Automatic watching is disabled (`CHECK_RESULTS_EVERY_SECONDS=NONE`) to avoid
generating incomplete reports while a run is writing files. Each explicit
generation adds a history entry, even if you have not rerun tests. The most
recent 20 numbered reports are retained per project, along with `latest`.
History and trends are kept separately for the two sources.

Allure reads result files directly inside each input directory; the `host`
report excludes files in the nested `local-docker` directory. Existing output
paths and reporter configuration stay unchanged. The service also writes
`executor.json` and a `history/` directory into each input directory as part of
its normal history handling.

## Fresh runs versus accumulated results

The Allure Playwright reporter adds files to its results directory. If results
from several executions remain, Allure can group repeated tests as retries or
include tests that were not selected in the last execution. Generating a report
does not clean those inputs.

When you want the report to represent only the next execution, first generate
the current report if it needs to be retained, then remove only the selected
source's top-level raw files **before** starting tests:

```sh
# Host-side results only; preserves nested Docker results and history directories.
find allure-results -maxdepth 1 -type f -delete

# Or, for a local Docker run only:
find allure-results/local-docker -maxdepth 1 -type f -delete
```

Choose one command for the run you are about to execute. Do not recursively
remove `allure-results/`: that would also delete the other source and the saved
input history. HTML/JUnit and Allure HTML reports have separate lifecycles;
these cleanup commands do not remove `allure-report/`.

## Stop and restart

```sh
npm run allure:stop   # Stop only this reporting service.
npm run allure:up     # Start it again and wait for health.
npm run allure:down   # Remove only opencart-allure containers/network.
```

Results and reports are bind-mounted from the repository and survive `down`
and container recreation. `allure-results/` and `allure-report/` are already
ignored by Git. To inspect service logs:

```sh
docker compose --env-file /dev/null -p opencart-allure -f docker-compose.allure.yml logs --tail=100 allure
```

If port 5051 is occupied, identify the owner before starting this service.
Report publishing and history on CI are a separate follow-up; this Compose
file and the npm commands are local only.
