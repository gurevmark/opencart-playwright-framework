# Test reports

## Find the result

| Task | Where to look |
| --- | --- |
| Read a local Playwright report | After a run through the Docker helper, open `reports/local-docker/index.html`. After a host-side run, open `reports/index.html`. [Local reports](#local-reports) |
| Open Allure for a local Docker run | Run `npm run allure:up`, `npm run allure:generate -- local-docker`, then `npm run allure:open -- local-docker`. Use `host` for a host-side run. [Generate and view reports](#generate-and-view-reports) |
| Open an Actions result | For a same-repository PR or manual run on `main`, follow **Open Allure report** in **Summary**. You can also download its `allure-html-<run>-<attempt>` artifact and open `index.html`. [Publication conditions](#open-a-ci-report) |
| Locate a failed test step | Download `playwright-report` or `allure-results` from Actions for statuses, named steps and the failure location when available. Traces, screenshots, video and `error-context.md` stay in Playwright's capture directory. [What is public](#what-is-public) |

Use `--output=test-results/host` on host runs to preserve Docker captures.
Ordinary `--list` replaces the selected mode's HTML/JUnit and adds the listed
cases to Allure as `skipped`. Use the CI catalog command in a clean checkout
to preserve existing reports. Check assertion output before sharing console
logs. [Discovery without overwriting reports](CI.md#existing-host-side-local-runs)

## Open a CI report

Open the workflow run's **Summary** and follow the Allure report link. It
appears after GitHub Pages deploys the report and CI retrieves and verifies the
published HTML. It opens directly in a browser. The URL contains the run ID and
the attempt that produced the test results, for example `runs/12345/2/index.html`.

| Run | Browser-ready Allure HTML |
| --- | --- |
| Same-repository PR or manual run on `main` | Pages link in Summary and an `allure-html-<run>-<attempt>` artifact |
| PR merge or direct push to `main` | No workflow run |
| Manual run on another ref | `allure-preview-<run>-<attempt>` artifact in Actions |
| Fork PR or Dependabot | The required `test` check fails before executing untrusted code |

When tests fail but their result files pass the upload check, the report job
can still build HTML. The test job and the overall run stay red. Cancellation,
missing result files or a failed upload check skip publication. The Summary
link appears only after deployment and verification of the live HTML.

For a previously deployed commit, GitHub Pages can keep serving the earlier
site despite reporting deployment success. If CI cannot verify the new report,
Summary provides **Download Allure report** for this run's artifact and records
a warning. First-time deployment failures still fail the publication job.
[Publication verification](CI.md#github-pages-deployment)

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
`playwright-report` or `allure-results` in Actions. Readers with artifact
download access can retrieve them, including signed-in readers of a public
repository.

The configured reporter builds the three downloadable formats from a filtered
event stream. It drops low-level browser actions (including form values),
attachments, stdout/stderr, page snapshots and assertion payloads. It redacts
configured credentials from retained names. CI opens the ZIP inside the
Playwright HTML and checks its JSON, the JUnit XML and raw Allure JSON before
either artifact can be uploaded. A failed privacy check blocks both uploads.

The separate Playwright `list` reporter prints directly to the terminal or
Actions log. For example, a failed length assertion on the FakeStore users
array can print records with password fields. GitHub masks the configured
secret values it recognizes. Review logs independently of the downloaded files.
[Configured reporters](../playwright.config.ts) · [Upload verification](../scripts/ci/verify-report-privacy.py) · [Known issues](KNOWN_ISSUES.md)

Reports generated with the previous reporter can contain the OpenCart customer
and administrator credentials. Rotate exposed values and remove affected copies,
including local Allure history and downloaded ZIPs, before generating reports
from an existing results directory. Keep `test-results/` private.

The local generator requires `safe-<sha256>-result.json` or
`safe-<sha256>-container.json` filenames and compares their hashes to the file
contents. It also checks the saved checksum of the project's history and executor
metadata. Use the reporter's own files as input. The content scan in the Actions
upload step is separate. On an installation with legacy data, clear
only the affected project's old input files, input `history/`, `executor.json`
and generated `allure-report/<project>/` contents before the first safe run.
Keep the mount directories themselves. The `host` input also contains the
independent `local-docker/` directory.

CI generates a single HTML file with the SHA-256-verified Allure 2.46.1 CLI
and the hosted runner's Java runtime. It restores the versioned archive cache
and downloads only on a cache miss, then verifies the checksum before extraction.
[Cache and installation](CI.md#github-pages-deployment) The existing `allure-playwright` adapter
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

With `--output=test-results/host`, private host captures are under
`test-results/host/`. The Docker helper writes to `test-results/local-docker/run/`.
Expect screenshots and video on browser failures, and a trace on the first
retry when retries are enabled. Keep these directories separate from
`reports/`, `allure-results/` and the served `allure-report/` tree. Runs using
the same source share fixed report paths, so save the previous HTML/JUnit
before another run or `--list` if you need both. [Host-side commands](CI.md#existing-host-side-local-runs)

The Allure input consists of filtered JSON files. Docker supplies the generator and HTTP server, so
Java and the Allure CLI do not need to be installed on the Mac.

## Start the local Allure service

From the repository root, with Docker Desktop running:

```sh
npm run allure:up
npm run allure:status
```

This creates the separate `opencart-allure` Compose project and its `allure`
service. Docker publishes container port 5050 at `127.0.0.1:5051`.
The reporting stack has its own lifecycle and can display results already on
disk while the application stack is stopped. [Standalone Compose file](../docker-compose.allure.yml)

The service uses `frankescobar/allure-docker-service:2.44.0`. See the
[upstream image and multi-project documentation](https://github.com/fescobar/allure-docker-service#docker-versions).

## Generate and view reports

After an ordinary host-side test run:

```sh
# Run the 12 storefront cases against the existing local OpenCart setup.
bash scripts/ci/run-tests.sh test:web chromium tests/web --output=test-results/host
npm run allure:generate
npm run allure:open
```

After a run using the existing full local Docker helper:

```sh
npm run test:master
npm run allure:generate -- local-docker
npm run allure:open -- local-docker
```

The helper can also generate a report from results already on disk; rerunning
tests is not required. Both commands accept `host` or `local-docker` and default
to `host`. On macOS, `allure:open` attempts to open the default browser. If no
browser is available, or on other platforms, use the printed URL. Generate
first. The open command prints or opens that URL even when the service is stopped
or no report has been generated for the project.

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
report excludes files in the nested `local-docker` directory. The service writes
`executor.json` and a `history/` directory into each input directory as part of
its normal history handling.

## Fresh runs versus accumulated results

The Allure Playwright reporter adds files to its results directory. If results
from several executions remain, Allure can group repeated tests as retries or
include tests that were not selected in the last execution. A normal `--list`
also appends skipped results for listed tests. Generating a report retains
the existing inputs.

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
