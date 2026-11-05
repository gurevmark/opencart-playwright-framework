import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const workflow = readFileSync(new URL('../../.github/workflows/playwright.yml', import.meta.url), 'utf8');

test('PR openings, updates and reopening use the defaults, with manual runs and no push trigger', () => {
  const triggers = workflow.split('\npermissions:')[0];
  assert.match(triggers, /pull_request:\n    branches: \[main\]/);
  assert.doesNotMatch(triggers, /types:|\n  push:/);
  assert.match(triggers, /workflow_dispatch:/);
  const jobs = [...workflow.split('\njobs:\n')[1].matchAll(/^  (\w+):$/gm)].map(match => match[1]);
  assert.deepEqual(jobs, ['test', 'report', 'publish']);
});

test('the required test check fails for an untrusted source before checkout', () => {
  const stepName = 'Require a trusted test source';
  const step = workflow.split(`      - name: ${stepName}\n`)[1];
  assert.ok(step, 'The required test job must guard its source');
  const script = step.match(/        run: \|\n((?: {10}[^\n]*\n|\n)+)/)[1].replace(/^ {10}/gm, '');
  assert.ok(workflow.indexOf(stepName) < workflow.indexOf('- name: Checkout repository'));
  for (const [trusted, status] of [['true', 0], ['false', 1]]) {
    const result = spawnSync('bash', ['-e', '-c', script], {
      env: { ...process.env, TRUSTED_SOURCE: trusted },
    });
    assert.equal(result.status, status);
  }
});
