import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const reportLimit = 10;
const reportName = /^allure-html-([1-9]\d*)-([1-9]\d*)$/;

export function retainedReports(current, artifacts, repo, getRun, isMainCommit, getPullRequests = () => []) {
  if (!reportName.test(current)) throw new Error('Invalid current report name');
  const selected = new Set([current]);
  const trusted = new Map();
  for (const artifact of artifacts.toSorted((a, b) => b.id - a.id)) {
    if (selected.size === reportLimit) break;
    const match = reportName.exec(artifact.name);
    const source = artifact.workflow_run;
    if (!match || artifact.expired || selected.has(artifact.name) ||
        String(source?.id) !== match[1] ||
        source.head_repository_id !== source.repository_id) continue;
    // Artifact names and branch names alone are forgeable by other workflows or PRs.
    if (!trusted.has(source.id)) {
      const run = getRun(source.id);
      let eligible = false;
      if (run?.path === '.github/workflows/playwright.yml' &&
          run.head_repository?.full_name === repo && run.head_branch === source.head_branch) {
        if (run.event === 'pull_request') {
          // run.pull_requests can be empty after the PR is merged or updated.
          eligible = getPullRequests(run.head_sha).some(pull =>
            pull.base.ref === 'main' && pull.base.repo?.full_name === repo &&
            pull.head.ref === run.head_branch && pull.head.repo?.full_name === repo);
        } else {
          eligible = run.head_branch === 'main' &&
            ['push', 'workflow_dispatch'].includes(run.event) && isMainCommit(run.head_sha);
        }
      }
      trusted.set(source.id, eligible);
    }
    if (trusted.get(source.id)) selected.add(artifact.name);
  }
  return [...selected];
}

function assemble(site, current) {
  const repo = process.env.GITHUB_REPOSITORY;
  function api(...args) {
    return JSON.parse(execFileSync('gh', ['api', ...args], { encoding: 'utf8' }));
  }
  const artifacts = [];
  for (let page = 1; ; page++) {
    const batch = api(`repos/${repo}/actions/artifacts?per_page=100&page=${page}`).artifacts;
    artifacts.push(...batch.filter(artifact => reportName.test(artifact.name)));
    if (batch.length < 100) break;
  }
  // The Actions API exposes a short head_branch even for manual runs on tags.
  const isMainCommit = sha => /^[a-f0-9]{40}$/.test(sha) &&
    spawnSync('git', ['merge-base', '--is-ancestor', sha, 'refs/remotes/origin/main']).status === 0;
  const getPullRequests = sha => api('--paginate', '--slurp',
    `repos/${repo}/commits/${sha}/pulls?per_page=100`).flat();
  const reports = retainedReports(current, artifacts, repo,
    id => api(`repos/${repo}/actions/runs/${id}`), isMainCommit, getPullRequests);
  mkdirSync(site);
  const links = [];
  for (const name of reports) {
    const [, run, attempt] = reportName.exec(name);
    const path = `runs/${run}/${attempt}/`;
    const directory = join(site, path);
    mkdirSync(directory, { recursive: true });
    execFileSync('gh', ['run', 'download', run, '--repo', repo, '--name', name, '--dir', directory], { stdio: 'inherit' });
    const files = readdirSync(directory, { withFileTypes: true });
    if (files.length !== 1 || files[0].name !== 'index.html' || !files[0].isFile() ||
        !statSync(join(directory, 'index.html')).size) throw new Error(`Invalid public report: ${name}`);
    links.push(`<li><a href="${path}">Run ${run}, attempt ${attempt}</a></li>`);
  }
  writeFileSync(join(site, 'index.html'), `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="data:,"><title>Allure reports</title>
</head><body><h1>Allure reports</h1><ul>
${links.join('\n')}
</ul></body></html>\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  assemble(process.argv[2], process.argv[3]);
}
