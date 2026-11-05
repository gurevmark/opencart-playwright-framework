# Test reports

## Open a CI report

Open the workflow run's **Summary** and click **Открыть Allure-отчёт**. The link
appears after GitHub Pages deploys the report and CI retrieves and verifies the
published HTML. It opens directly in a browser. The URL contains the run ID and
the attempt that produced the test results, for example `runs/12345/2/index.html`.

| Run | Browser-ready Allure HTML |
| --- | --- |
| Push to `main` or manual run on the `main` branch | Pages link in Summary and an `allure-html-<run>-<attempt>` artifact |
| Same-repository PR or manual run on another ref | `allure-preview-<run>-<attempt>` artifact in Actions |
| Fork PR or Dependabot | The secret-dependent tests are skipped |

A failed test still produces a report when Playwright writes a result. The
test job and the overall run stay red. Cancellation or missing results skip
publication. A failed deployment produces no Summary link.

The Pages home lists up to ten attempts. Each deployment includes the current
attempt and the nine newest other eligible HTML artifacts still available.
The HTML artifacts expire after 30 days. The site is pruned on the next
deployment, so an evicted Summary URL returns 404. It never points to a newer
run. The two original diagnostic artifacts retain their seven-day lifetime.

### What is public

The page shows test names, suite files and tags from credential-free Playwright
discovery, plus statuses, retries and timing from the matching results.
Unrecognized cases receive numbered names. Public reports omit attachments,
Playwright steps, submitted values, error text, stacks, host labels and executor
metadata. For the test author's named steps, retries and failure location, open
`playwright-report` or `allure-results` in Actions. These files are downloadable
by signed-in readers of this public repository.

The configured reporter builds the three downloadable formats from a filtered
event stream. It drops low-level browser actions (including form values),
attachments, stdout/stderr, page snapshots and assertion payloads. It redacts
configured credentials from retained names. CI opens the ZIP inside the
Playwright HTML and checks its JSON, the JUnit XML and raw Allure JSON before
either artifact can be uploaded. A failed privacy check blocks both uploads.

Reports generated with the previous reporter can contain the OpenCart customer
and administrator credentials. Rotate exposed values and remove affected copies,
including local Allure history and downloaded ZIPs, before generating reports
from an existing results directory. Keep `test-results/` private.

The local generator accepts the reporter's `safe-<sha256>-result.json` and
`safe-<sha256>-container.json` files and verifies their contents. It rejects
legacy attachments and changed history. On an existing installation, clear
only the affected project's old input files, input `history/`, `executor.json`
and generated `allure-report/<project>/` contents before the first safe run.
Keep the mount directories themselves. The `host` input also contains the
independent `local-docker/` directory.

CI generates a single HTML file with the SHA-256-verified Allure 2.46.1 CLI
and the hosted runner's Java runtime. The existing `allure-playwright` adapter
produces compatible results. The report displays its run and attempt and uses
[Allure's analytics opt-out](https://github.com/allure-framework/allure2/blob/2.46.1/Analytics.md#opting-out).
The local Docker service displays the filtered Allure results and their history. See the
[CI setup and failure check](CI.md#github-pages-deployment) and the
[Allure 2 release](https://github.com/allure-framework/allure2/releases/tag/2.46.1).

## Local reports

The configured Playwright reporters already produce three formats:

| Format | Host-side test run | Local Docker test run | How to view |
| --- | --- | --- | --- |
| Playwright HTML | `reports/index.html` | `reports/local-docker/index.html` | `npx --no-install playwright show-report reports` (or `reports/local-docker`) |
| JUnit XML | `reports/results.xml` | `reports/local-docker/results.xml` | An XML viewer or test-result importer |
| Allure raw results | `allure-results/` | `allure-results/local-docker/` | Generate an Allure report using the service below |

The Allure input consists of filtered JSON files. Docker supplies the generator and HTTP server, so
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
find allure-results -maxdepth 1 -type f -name 'safe-*.json' -delete

# Or, for a local Docker run only:
find allure-results/local-docker -maxdepth 1 -type f -name 'safe-*.json' -delete
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
