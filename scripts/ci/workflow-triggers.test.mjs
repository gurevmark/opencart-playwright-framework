import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const workflow = readFileSync(new URL('../../.github/workflows/playwright.yml', import.meta.url), 'utf8');

function stepScript(name) {
  const step = workflow.split(`      - name: ${name}\n`)[1];
  assert.ok(step, `Missing workflow step ${name}`);
  const script = step.match(/        run: \|\n((?: {10}[^\n]*\n|\n)+)/)?.[1];
  assert.ok(script, `Missing shell script for ${name}`);
  return script.replace(/^ {10}/gm, '');
}

const selector = stepScript('Skip tests for a push produced by merging a PR');
const guard = stepScript('Require a successful selector and a trusted test source');
const merged = { merged_at: '2026-11-05T11:40:25Z', base: { ref: 'main' }, merge_commit_sha: 'tested-sha' };

function selectRun(t, event, pages, apiExit = 0) {
  const directory = mkdtempSync(join(tmpdir(), 'opencart-trigger-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const bin = join(directory, 'bin');
  mkdirSync(bin);
  const response = join(directory, 'response');
  const output = join(directory, 'output');
  writeFileSync(response, pages.map(page => JSON.stringify(page)).join('\n'));
  writeFileSync(output, '');
  writeFileSync(join(bin, 'gh'), `#!/bin/bash
[[ "$#" == 3 && "$1" == api && "$2" == --paginate ]] || exit 64
[[ "$3" == 'repos/example/project/commits/tested-sha/pulls?per_page=100' ]] || exit 65
cat "$SELECTOR_RESPONSE"
exit "$SELECTOR_API_EXIT"
`, { mode: 0o755 });
  const result = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', selector], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      EVENT_NAME: event,
      GITHUB_REPOSITORY: 'example/project',
      GITHUB_SHA: 'tested-sha',
      GITHUB_OUTPUT: output,
      GITHUB_STEP_SUMMARY: join(directory, 'summary'),
      SELECTOR_RESPONSE: response,
      SELECTOR_API_EXIT: String(apiExit),
    },
  });
  return { ...result, output: readFileSync(output, 'utf8') };
}

test('a PR merge skips tests even when the match is on a later API page', t => {
  const result = selectRun(t, 'push', [[], [merged]]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.output, 'run-tests=false\n');
});

test('direct pushes run tests despite unrelated or open PR associations', t => {
  const result = selectRun(t, 'push', [[
    { ...merged, merged_at: null },
    { ...merged, base: { ref: 'release' } },
    { ...merged, merge_commit_sha: 'older-merge' },
  ]]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.output, 'run-tests=true\n');
});

test('a direct push without any associated PR runs tests', t => {
  assert.equal(selectRun(t, 'push', [[]]).output, 'run-tests=true\n');
});

for (const event of ['pull_request', 'workflow_dispatch']) {
  test(`${event} runs tests without requiring an API lookup`, t => {
    const result = selectRun(t, event, [], 1);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.output, 'run-tests=true\n');
  });
}

test('a failing API request cannot mark the run as skipped', t => {
  const result = selectRun(t, 'push', [[merged]], 1);
  assert.notEqual(result.status, 0);
  assert.equal(result.output, '');
});

test('invalid API output fails the selector', t => {
  const result = selectRun(t, 'push', [{ message: 'Invalid response' }]);
  assert.notEqual(result.status, 0);
  assert.equal(result.output, '');
});

test('the required check fails before checkout for a failed selector or untrusted source', () => {
  for (const [trigger, trusted, status] of [
    ['success', 'true', 0],
    ['failure', 'true', 1],
    ['skipped', 'true', 1],
    ['success', 'false', 1],
  ]) {
    const result = spawnSync('bash', ['-e', '-c', guard], {
      env: { ...process.env, TRIGGER_RESULT: trigger, TRUSTED_SOURCE: trusted },
    });
    assert.equal(result.status, status, `${trigger}, trusted=${trusted}`);
  }
});
