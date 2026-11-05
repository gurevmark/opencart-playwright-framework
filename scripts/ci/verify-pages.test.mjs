import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('./verify-pages.sh', import.meta.url));
const pageUrl = 'https://example.test/reports/runs/123/1/index.html';
const artifactUrl = 'https://github.com/owner/project/actions/runs/123/artifacts/456';

function verify(t, overrides = {}, response = 'current report') {
  const directory = mkdtempSync(join(tmpdir(), 'pages-verification-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const bin = join(directory, 'bin');
  mkdirSync(bin);
  const site = join(directory, 'site/runs/123/1');
  mkdirSync(site, { recursive: true });
  writeFileSync(join(site, 'index.html'), 'current report');
  const body = join(directory, 'response');
  writeFileSync(body, response);
  writeFileSync(join(bin, 'curl'), `#!/bin/bash
set -eu
while [[ "$1" != --output ]]; do shift; done
cp "$CURL_RESPONSE" "$2"
exit "\${CURL_EXIT:-0}"
`, { mode: 0o755 });
  const summary = join(directory, 'summary');
  const output = join(directory, 'output');
  writeFileSync(summary, '');
  writeFileSync(output, '');
  const result = spawnSync('bash', [script], {
    encoding: 'utf8',
    env: {
      ...process.env, PATH: `${bin}:${process.env.PATH}`, RUNNER_TEMP: directory,
      GITHUB_RUN_ID: '123', TEST_ATTEMPT: '1', PAGE_URL: 'https://example.test/reports/',
      GITHUB_STEP_SUMMARY: summary, GITHUB_OUTPUT: output,
      REPORT_ARTIFACT_URL: artifactUrl, ALLOW_REPORT_FALLBACK: 'false',
      PAGES_DEPLOY_OUTCOME: 'success', CURL_RESPONSE: body, ...overrides,
    },
  });
  return { ...result, summary: readFileSync(summary, 'utf8'), output: readFileSync(output, 'utf8') };
}

test('a matching live report produces the verified Pages link', t => {
  const result = verify(t);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.summary.includes(`[Open Allure report](${pageUrl})`));
  assert.equal(result.output, `url=${pageUrl}\n`);
});

test('a repeated commit with a missing live report links the downloadable artifact', t => {
  const result = verify(t, { ALLOW_REPORT_FALLBACK: 'true', CURL_EXIT: '22' });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.summary.includes(`[Download Allure report](${artifactUrl})`));
  assert.ok(!result.summary.includes(pageUrl));
  assert.match(result.stdout, /::warning::/);
});

test('stale HTML on a repeated commit also uses the artifact', t => {
  const result = verify(t, { ALLOW_REPORT_FALLBACK: 'true' }, 'older report');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.output, `url=${artifactUrl}\n`);
});

test('a failed native deployment can fall back only for a previously deployed commit', t => {
  const result = verify(t, { ALLOW_REPORT_FALLBACK: 'true', PAGES_DEPLOY_OUTCOME: 'failure', PAGE_URL: '' });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.summary.includes(artifactUrl));
});

test('first-time missing, stale or failed deployments remain failures', t => {
  for (const [overrides, body] of [
    [{ CURL_EXIT: '22' }, 'current report'],
    [{}, 'older report'],
    [{ PAGES_DEPLOY_OUTCOME: 'failure', PAGE_URL: '' }, 'current report'],
  ]) {
    const result = verify(t, overrides, body);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /::error::/);
    assert.equal(result.summary, '');
  }
});
