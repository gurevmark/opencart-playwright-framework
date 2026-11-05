import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { retainedReports } from './allure-pages.mjs';
import { writePublicResults } from './public-allure.mjs';
import verified from './reporters/verified-allure.cjs';
import paths from './reporters/paths.cjs';

test('local Allure rejects legacy and altered inputs while retaining verified history', t => {
  const root = mkdtempSync(join(tmpdir(), 'allure-history-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const input = join(root, 'raw');
  const output = join(root, 'reports');
  mkdirSync(input);
  mkdirSync(output);
  const bytes = Buffer.from('{"status":"passed"}');
  const safe = join(input, verified.safeAllureFilename(bytes, 'result'));
  writeFileSync(safe, bytes);
  assert.equal(verified.verifiedResults(input, 'host'), 1);
  writeFileSync(join(input, 'old-result.json'), bytes);
  assert.throws(() => verified.verifiedResults(input, 'host'), /Unverified/);
  rmSync(join(input, 'old-result.json'));
  writeFileSync(safe, '{"status":"failed"}');
  assert.throws(() => verified.verifiedResults(input, 'host'), /Unverified/);
  assert.equal(verified.historyDigest(input, output), '');
  writeFileSync(join(input, 'executor.json'), '{}');
  const prior = verified.historyDigest(input, output);
  writeFileSync(join(input, 'executor.json'), '{"different":true}');
  assert.notEqual(verified.historyDigest(input, output), prior);
});

test('Docker captures cannot overlap a report directory through a host alias', t => {
  const root = mkdtempSync(join(tmpdir(), 'report-mounts-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const html = join(root, 'reports'), raw = join(root, 'allure-results');
  mkdirSync(raw);
  symlinkSync(raw, join(root, 'alias'), 'dir');
  assert.doesNotThrow(() => paths.verifyDockerMounts(html, raw, join(root, 'test-results'), root));
  assert.throws(() => paths.verifyDockerMounts(html, raw, join(root, 'alias', 'captures'), root));
  assert.throws(() => paths.verifyDockerMounts(html, raw, join(root, 'ALLURE-RESULTS', 'captures'), root));
});

test('only catalog titles, outcomes and timings survive public report generation', t => {
  const temp = mkdtempSync(join(tmpdir(), 'public-allure-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const raw = join(temp, 'raw');
  const clean = join(temp, 'public');
  mkdirSync(raw);
  const file = 'web/login.spec.ts';
  const title = 'Customer login @web';
  const catalog = { suites: [{ title: file, specs: [{ title, file, tags: ['web'] }] }] };
  const privateText = 'CANARY-PRIVATE-user@example.invalid';
  const fullName = `${file} › ${title}`;
  const input = {
    fullName, status: 'failed', start: 10, stop: 20, name: privateText, uuid: privateText,
    historyId: privateText, testCaseId: privateText, descriptionHtml: privateText,
    statusDetails: { message: privateText, trace: privateText },
    parameters: [{ name: 'password', value: privateText }], labels: [{ name: 'host', value: privateText }],
    steps: [{ name: privateText }], links: [{ url: privateText }],
    attachments: [{ name: privateText, source: 'trace.zip' }],
  };
  for (const [name, data] of Object.entries({
    'one-result.json': input, 'retry-result.json': { ...input, status: 'passed' },
    'unknown-result.json': { ...input, fullName: privateText, status: privateText, start: privateText },
    'fixture-container.json': input, 'executor.json': input,
  })) writeFileSync(join(raw, name), JSON.stringify(data));
  writeFileSync(join(raw, 'trace.zip'), privateText);

  assert.deepEqual(writePublicResults(catalog, raw, clean, 'chromium'), { count: 3, unlisted: 1 });
  const files = readdirSync(clean);
  assert.equal(files.length, 3);
  const results = files.map(name => {
    assert.match(name, /^[a-f0-9-]+-result\.json$/);
    const json = readFileSync(join(clean, name), 'utf8');
    assert.ok(!json.includes(privateText));
    return JSON.parse(json);
  });
  const [first, retry] = results.filter(result => result.name === title);
  assert.equal(first.historyId, retry.historyId);
  assert.notEqual(first.uuid, retry.uuid);
  const failed = results.find(result => result.status === 'failed');
  assert.equal(failed.stop - failed.start, 10);
  assert.match(failed.statusDetails.message, /Actions run/);
  const unlisted = results.find(result => result.status === 'unknown');
  assert.equal(unlisted.name, 'Unlisted test 1');
  assert.equal(unlisted.start, undefined);
  assert.throws(() => writePublicResults(catalog, raw, clean, 'chromium'), /EEXIST/);
  assert.deepEqual(writePublicResults({ suites: [] }, raw, join(temp, 'without-catalog'), 'chromium'),
    { count: 3, unlisted: 2 });
});

const repo = 'owner/project';
const trusted = { path: '.github/workflows/playwright.yml', head_branch: 'main', head_repository: { full_name: repo }, head_sha: 'trusted', event: 'push' };
function artifact(id, run, attempt = 1) {
  return { name: `allure-html-${run}-${attempt}`, id,
    workflow_run: { id: run, head_branch: 'main', repository_id: 12, head_repository_id: 12 } };
}

test('history authenticates the source run before using an artifact with a plausible name', () => {
  const artifacts = [
    artifact(30, 30), artifact(29, 29), artifact(28, 28), artifact(27, 27), artifact(26, 26),
    { ...artifact(25, 25), name: 'allure-html-999-1' }, { ...artifact(24, 24), expired: true },
    artifact(23, 23, 2), artifact(22, 23, 1), artifact(21, 21),
  ];
  artifacts[0].workflow_run.head_repository_id = 99;
  artifacts[1].workflow_run.head_branch = 'feature';
  const runs = new Map([
    [28, { ...trusted, event: 'pull_request' }], [27, { ...trusted, path: '.github/workflows/other.yml' }],
    [26, { ...trusted, head_repository: { full_name: 'other/fork' } }],
    [23, { ...trusted, event: 'workflow_dispatch' }],
    [21, { ...trusted, event: 'workflow_dispatch', head_sha: 'tag-outside-main' }],
  ]);
  const selected = retainedReports('allure-html-31-1', artifacts, repo, id => runs.get(id), sha => sha === 'trusted');
  assert.deepEqual(selected, ['allure-html-31-1', 'allure-html-23-2', 'allure-html-23-1']);
});

test('keeps the current attempt and the nine newest eligible reports, including retries', () => {
  const artifacts = Array.from({ length: 15 }, (_, i) => artifact(i + 1, i + 1));
  const current = 'allure-html-1-1';
  const selected = retainedReports(current, artifacts, repo, () => trusted, () => true);
  assert.deepEqual(selected, [current, ...artifacts.slice(-9).reverse().map(a => a.name)]);
  assert.throws(() => retainedReports('../../site', [], repo, () => trusted, () => true));
});

test('retains a same-repository PR report after updates or merge empty the run PR list', () => {
  const item = artifact(40, 40);
  item.workflow_run.head_branch = 'feature';
  const run = { ...trusted, event: 'pull_request', head_branch: 'feature', head_sha: 'pr-commit', pull_requests: [] };
  const pull = {
    base: { ref: 'main', repo: { full_name: repo } },
    head: { ref: 'feature', repo: { full_name: repo } },
  };
  const selected = retainedReports('allure-html-41-1', [item], repo, () => run, () => false, sha => {
    assert.equal(sha, 'pr-commit');
    return [pull];
  });
  assert.deepEqual(selected, ['allure-html-41-1', 'allure-html-40-1']);
});

test('PR history rejects forks, other base branches and mismatched source metadata', () => {
  const item = artifact(40, 40);
  item.workflow_run.head_branch = 'feature';
  const run = { ...trusted, event: 'pull_request', head_branch: 'feature', head_sha: 'pr-commit' };
  const pull = {
    base: { ref: 'main', repo: { full_name: repo } },
    head: { ref: 'feature', repo: { full_name: repo } },
  };
  const rejected = [
    { ...pull, head: { ...pull.head, repo: { full_name: 'other/fork' } } },
    { ...pull, base: { ...pull.base, ref: 'release' } },
    { ...pull, base: { ...pull.base, repo: { full_name: 'other/project' } } },
    { ...pull, head: { ...pull.head, ref: 'other-feature' } },
  ];
  for (const source of rejected) {
    assert.deepEqual(retainedReports('allure-html-41-1', [item], repo, () => run, () => true, () => [source]),
      ['allure-html-41-1']);
  }
  assert.deepEqual(retainedReports('allure-html-41-1', [item], repo,
    () => ({ ...run, head_branch: 'other-feature' }), () => true, () => [pull]), ['allure-html-41-1']);
});
