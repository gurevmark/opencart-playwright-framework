import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../../../', import.meta.url));
const { ZipFile } = require('playwright-core/lib/coreBundle').utils;
const keys = ['APP_EMAIL', 'APP_PASSWORD', 'ADMIN_USERNAME', 'ADMIN_PASSWORD', 'USERNAME', 'PASSWORD', 'DB_PASSWORD'];
const canaries = Object.fromEntries(keys.map(key => [key, randomUUID()]));
canaries.APP_EMAIL += '@example.invalid';
canaries.APP_PASSWORD += '-!<&>"'; // Exercise escaping in HTML/JSON and JUnit.
const spec = `
const { test, expect } = require('@playwright/test');
test('passing calibration @master', () => expect(2 + 2).toBe(4));
test('failing calibration @master ' + process.env.ADMIN_USERNAME, async ({ page }, info) => {
  await page.setContent('<label>Customer <input></label><label>Password <input></label>');
  await test.step('Validate customer account', async () => {
    await test.step('Fill ' + process.env.APP_EMAIL, async () => {
      await page.getByLabel('Customer').fill(process.env.APP_EMAIL);
      await page.getByLabel('Password').fill(process.env.APP_PASSWORD);
    });
    console.log(process.env.USERNAME);
    console.error(process.env.DB_PASSWORD);
    info.annotations.push({ type: 'probe', description: process.env.PASSWORD });
    await info.attach('text-' + process.env.APP_EMAIL, {body: process.env.APP_PASSWORD, contentType: 'text/plain'});
    await info.attach('binary-' + process.env.ADMIN_USERNAME, {body: Buffer.from(process.env.ADMIN_PASSWORD), contentType: 'application/octet-stream'});
    expect(process.env.APP_PASSWORD, 'Checking ' + process.env.ADMIN_PASSWORD).toBe('intentionally different');
  });
});
`;

function project(t) {
  const dir = mkdtempSync(join(tmpdir(), 'pw-report-privacy-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  symlinkSync(resolve(root, 'node_modules'), join(dir, 'node_modules'), 'dir');
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'report-fixture' }));
  cpSync(join(root, 'playwright.config.ts'), join(dir, 'playwright.config.ts'));
  const reporterDir = 'scripts/ci/reporters';
  cpSync(join(root, reporterDir), join(dir, reporterDir), { recursive: true });
  mkdirSync(join(dir, 'tests'));
  writeFileSync(join(dir, 'tests/probe.spec.cjs'), spec);
  return dir;
}

function playwright(dir, args, extraEnv = {}) {
  const env = { PATH: process.env.PATH, HOME: process.env.HOME || tmpdir(), TMPDIR: tmpdir() };
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH;
  const cli = join(dirname(require.resolve('playwright/package.json')), 'cli.js');
  const result = spawnSync(process.execPath, [cli, 'test', ...args],
    { cwd: dir, env: { ...env, ...extraEnv }, encoding: 'utf8' });
  assert.ifError(result.error);
  return result;
}

function run(dir, args, ci = true, env = {}) {
  return playwright(dir, ['--project=chromium', '--workers=1', '--output=test-results/run', ...args],
    { ...canaries, ...(ci && { CI: 'true' }), ...env });
}

function assertClean(text, label) {
  for (const value of Object.values(canaries)) {
    for (const representation of [value, JSON.stringify(value).slice(1, -1), encodeURIComponent(value), Buffer.from(value).toString('base64')]) {
      assert.ok(!text.includes(representation), `Configured credential in ${label}`);
    }
  }
}

test('failed and retried tests produce native reports without credential-bearing diagnostics', async t => {
  const dir = project(t);
  const result = run(dir, ['--retries=1']);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /1 passed/);
  const index = readFileSync(join(dir, 'reports/index.html'), 'utf8');
  const encoded = index.match(/id="playwrightReportBase64">data:application\/zip;base64,([^<]+)<\/template>/);
  assert.ok(encoded, 'Playwright report must contain its data ZIP');
  const archivePath = join(dir, 'report-data.zip');
  writeFileSync(archivePath, Buffer.from(encoded[1], 'base64'));
  const archive = new ZipFile(archivePath);
  try {
    const summary = JSON.parse(await archive.read('report.json'));
    assert.equal(summary.stats.expected, 1);
    assert.equal(summary.stats.unexpected, 1);
    const suite = JSON.parse(await archive.read(summary.files[0].fileId + '.json'));
    const failed = suite.tests.find(test => test.title.includes('failing calibration'));
    assert.deepEqual(failed.results.map(result => result.status), ['failed', 'failed']);
    assert.ok(failed.results.every(result => result.steps.some(step => step.title === 'Validate customer account')),
      'Each failure must execute the real browser test body');
    for (const entry of await archive.entries()) assertClean((await archive.read(entry)).toString(), 'embedded HTML report');
  } finally {
    archive.close();
  }
  assertClean(index, 'HTML');
  const junit = readFileSync(join(dir, 'reports/results.xml'), 'utf8');
  assert.match(junit, /passing calibration/);
  assert.match(junit, /failing calibration/);
  assert.match(junit, /<(failure|error)\b/);
  assertClean(junit, 'JUnit');
  assert.deepEqual(readdirSync(join(dir, 'reports')).sort(), ['index.html', 'results.xml']);
  const results = [];
  for (const name of readdirSync(join(dir, 'allure-results'))) {
    assert.match(name, /-(result|container)\.json$/, 'Only structured Allure data may be published');
    assertClean(name, 'Allure filename');
    const raw = readFileSync(join(dir, 'allure-results', name), 'utf8');
    const digest = createHash('sha256').update(raw).digest('hex');
    assert.ok(name.startsWith(`safe-${digest}-`), 'Local service can verify this exact Allure result');
    assertClean(raw, 'raw Allure');
    if (name.endsWith('-result.json')) results.push(JSON.parse(raw));
  }
  assert.equal(results.filter(result => result.name.includes('passing calibration') && result.status === 'passed').length, 1);
  assert.equal(results.filter(result => result.name.includes('failing calibration') && result.status === 'failed').length, 2);
  const privateFiles = readdirSync(join(dir, 'test-results/run'), { recursive: true });
  for (const expected of ['trace.zip', 'video.webm', 'test-failed-1.png', 'error-context.md']) {
    assert.ok(privateFiles.some(name => name.endsWith(expected)), `The test must exercise the private ${expected} payload`);
  }
  assert.ok(existsSync(join(dir, 'test-results/run/report-artifacts.ready')));
});

test('a passing local run returns success and produces all three reports', t => {
  const dir = project(t);
  const raw = join(dir, 'allure-results');
  mkdirSync(raw);
  writeFileSync(join(raw, 'pre-existing-result.json'), JSON.stringify({ name: 'legacy report' }));
  mkdirSync(join(dir, 'reports/local-docker'), { recursive: true });
  writeFileSync(join(dir, 'reports/local-docker/old'), 'other local project');
  const result = run(dir, ['--grep', 'passing calibration'], false);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.ok(existsSync(join(dir, 'reports/index.html')));
  assert.match(readFileSync(join(dir, 'reports/results.xml'), 'utf8'), /tests="1"/);
  assert.ok(readdirSync(raw).includes('pre-existing-result.json'));
  assert.equal(readdirSync(raw).filter(name => /^safe-.*-result\.json$/.test(name)).length, 1);
  assert.equal(readFileSync(join(dir, 'reports/local-docker/old'), 'utf8'), 'other local project');
  assert.ok(existsSync(join(dir, 'test-results/run/report-artifacts.ready')));
  // A preexisting local Allure installation must still recognize this test's history.
  writeFileSync(join(dir, 'native.config.cjs'), `module.exports = { testDir: './tests', projects: [{ name: 'chromium' }],
    reporter: [['allure-playwright', { resultsDir: './native-results' }]] };`);
  assert.equal(run(dir, ['--config=native.config.cjs', '--grep', 'passing calibration'], false).status, 0);
  function identity(output) {
    const folder = join(dir, output);
    const filename = readdirSync(folder).find(name => name.endsWith('-result.json') && name !== 'pre-existing-result.json');
    const { fullName, testCaseId, historyId } = JSON.parse(readFileSync(join(folder, filename)));
    return { fullName, testCaseId, historyId };
  }
  assert.deepEqual(identity('allure-results'), identity('native-results'));
});

test('unsafe reporter overrides are rejected and JSON catalog discovery still works', t => {
  const dir = project(t);
  for (const [args, env] of [
    [['--reporter=html'], {}], [['--add-reporter', 'html'], {}], [[], { PW_TEST_REPORTER: 'html' }],
    [['--list', '--reporter=json', '--reporter=html'], {}],
  ]) {
    const result = run(dir, args, true, env);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /configured report writers/);
    assert.ok(!existsSync(join(dir, 'test-results/run/report-artifacts.ready')));
  }
  const catalog = ['--list', '--reporter=json', '--project=chromium'];
  const discovery = playwright(dir, catalog);
  assert.equal(discovery.status, 0);
  assert.equal(JSON.parse(discovery.stdout).suites[0].specs.length, 2);
  for (const [args, env] of [
    [catalog, canaries], [catalog, { PLAYWRIGHT_JSON_OUTPUT_FILE: 'credential-report.json' }],
    [['--reporter=json', '--grep-invert', '--list'], {}],
  ]) {
    assert.notEqual(playwright(dir, args, env).status, 0);
  }
  assert.ok(!existsSync(join(dir, 'credential-report.json')));
  writeFileSync(join(dir, '.env'), `APP_PASSWORD=${canaries.APP_PASSWORD}\n`);
  assert.notEqual(playwright(dir, catalog).status, 0);
  mkdirSync(join(dir, 'allure-results'));
  symlinkSync(join(dir, 'allure-results'), join(dir, 'alias'), 'dir');
  for (const path of ['allure-results/scratch', 'alias/not-created/yet', 'RePoRtS/scratch']) {
    const overlapping = run(dir, ['--output', path]);
    assert.notEqual(overlapping.status, 0);
    assert.match(overlapping.stderr, /capture output separate/);
  }
});

test('rendering failure revokes a stale ready marker and fails the run', t => {
  const dir = project(t);
  const output = join(dir, 'test-results/run');
  mkdirSync(output, { recursive: true });
  const marker = join(output, 'report-artifacts.ready');
  writeFileSync(marker, 'ready\n');
  writeFileSync(join(dir, 'allure-results'), 'unrelated existing file');
  const result = run(dir, ['--grep', 'passing calibration']);
  assert.notEqual(result.status, 0);
  assert.ok(!existsSync(marker));
  assert.equal(readFileSync(join(dir, 'allure-results'), 'utf8'), 'unrelated existing file');
});
