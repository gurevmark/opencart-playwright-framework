const { spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { createWriteStream, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { basename, dirname, join, relative, sep } = require('node:path');
const { pipeline } = require('node:stream/promises');
const { stripVTControlCharacters } = require('node:util');
const { yazl } = require('playwright-core/lib/utilsBundle');
const { credentialVariables } = require('./options.cjs');
const { safeAllureFilename } = require('./verified-allure.cjs');

function redactConfiguredValues() {
  const values = credentialVariables.map(key => process.env[key]).filter(Boolean).flatMap(value => [
    value, JSON.stringify(value).slice(1, -1), encodeURIComponent(value), new URLSearchParams({ v: value }).toString().slice(2),
    Buffer.from(value).toString('base64'), Buffer.from(value).toString('base64url'),
  ]);
  const secrets = [...new Set(values)].sort((a, b) => b.length - a.length);
  const mask = ['[redacted]', '***', '…', ''].find(candidate => !secrets.some(secret => candidate.includes(secret)));
  return text => {
    for (const secret of secrets) text = text.replaceAll(secret, mask);
    return secrets.some(secret => text.includes(secret)) ? mask : text;
  };
}

// Write through a sibling file so the report service always reads complete JSON.
// Only files from this run's private rendering directory enter the public paths.
function installFile(folder, name, bytes) {
  mkdirSync(folder, { recursive: true });
  const temporary = join(folder, '.' + randomUUID() + '.tmp');
  try {
    writeFileSync(temporary, bytes, { flag: 'wx' });
    renameSync(temporary, join(folder, name));
  } finally {
    rmSync(temporary, { force: true });
  }
}

// Playwright 1.64's v2 blob stream is consumed by its own merge-reports CLI.
// Explicitly construct the fields that leave the runner. New reporter fields,
// attachment resources, stdout/stderr and source snippets are private by default.
function safeEvents(config, suite, run, globalErrors, sourceRoot, redact) {
  const events = [];
  const add = (method, params) => events.push(JSON.stringify({ method, params }));
  const location = loc => loc && { file: redact(relative(config.rootDir, loc.file)), line: loc.line, column: loc.column };
  const errorSummary = error => {
    // Assertion diffs, stacks and page snapshots can all echo form or API data.
    const matcher = stripVTControlCharacters(error.message ?? '').match(/\bexpect\([^()\n]*\)\.(?:not\.)?(to[A-Z][A-Za-z]*)\(/)?.[1];
    const loc = location(error.location);
    const where = loc ? ` at ${loc.file}:${loc.line}:${loc.column}` : '';
    return { message: `${matcher ? 'expect(received).' + redact(matcher) + '(expected) failed' : 'Test error'}${where}` };
  };
  function entry(item) {
    const common = { title: redact(item.title), location: location(item.location) };
    if (item.type !== 'test') return { ...common, entries: item.entries().map(entry) };
    return { ...common, testId: item.id, retries: item.retries, repeatEachIndex: item.repeatEachIndex,
      tags: item.tags.map(redact), annotations: [] };
  }
  add('onBlobReportMetadata', { version: 2, pathSeparator: sep, userAgent: 'Playwright' });
  add('onConfigure', { config: { rootDir: sourceRoot, version: config.version, workers: config.workers, metadata: {} } });
  for (const projectSuite of suite.suites) {
    const project = projectSuite.project();
    add('onProject', { project: {
      name: redact(project.name), suites: projectSuite.suites.map(entry), metadata: {},
      testDir: '.', outputDir: '../private-output', snapshotDir: '.', use: {}, dependencies: [],
      grep: [], grepInvert: [], testMatch: [], testIgnore: [], repeatEach: project.repeatEach,
      retries: project.retries, timeout: project.timeout,
    } });
  }
  add('onBegin');
  for (const error of globalErrors) add('onError', { error: errorSummary(error) });
  for (const test of suite.allTests()) {
    for (const result of test.results) {
      const testId = test.id;
      const resultId = randomUUID();
      add('onTestBegin', { testId, result: { id: resultId, retry: result.retry, workerIndex: result.workerIndex,
        parallelIndex: result.parallelIndex, startTime: +result.startTime } });
      function addSteps(steps, parentStepId) {
        for (const step of steps) {
          if (step.category !== 'test.step') {
            addSteps(step.steps, parentStepId);
            continue;
          }
          const id = randomUUID();
          add('onStepBegin', { testId, resultId, step: { id, parentStepId, category: 'test.step',
            title: redact(step.title), startTime: +step.startTime } });
          addSteps(step.steps, id);
          add('onStepEnd', { testId, resultId, step: { id, duration: step.duration,
            error: step.error && errorSummary(step.error) } });
        }
      }
      addSteps(result.steps);
      add('onTestEnd', { test: { testId, timeout: test.timeout, expectedStatus: test.expectedStatus, annotations: [] },
        result: { id: resultId, duration: result.duration, status: result.status, errors: result.errors.map(errorSummary) } });
    }
  }
  add('onEnd', { result: { status: run.status, startTime: +run.startTime, duration: run.duration } });
  return events.join('\n') + '\n';
}

module.exports = class ArtifactReporter {
  constructor() { this.globalErrors = []; }
  onBegin(config, suite) {
    this.config = config;
    this.suite = suite;
    this.marker = join(config.projects[0].outputDir, 'report-artifacts.ready');
    rmSync(this.marker, { force: true });
  }
  onError(error) { this.globalErrors.push(error); }
  printsToStdio() { return false; }

  async onEnd(run) {
    const temp = mkdtempSync(join(tmpdir(), 'pw-safe-report-'));
    try {
      // No test sources, attachments or environment file exist under this root.
      const redact = redactConfiguredValues();
      const sourceRoot = join(temp, basename(this.config.rootDir));
      mkdirSync(sourceRoot);
      // Allure includes the package name in its historical test ID. Supply only
      // that field, so the renderer resolves the same IDs without opening sources.
      const packageName = require('../../../package.json').name;
      writeFileSync(join(temp, 'package.json'), JSON.stringify({ name: redact(packageName) }));
      const zip = new yazl.ZipFile();
      zip.addBuffer(Buffer.from(safeEvents(this.config, this.suite, run, this.globalErrors, sourceRoot, redact)), 'report.jsonl');
      const written = pipeline(zip.outputStream, createWriteStream(join(temp, 'results.zip')));
      zip.end();
      await written;
      const cli = join(dirname(require.resolve('playwright/package.json')), 'cli.js');
      const root = dirname(this.config.configFile);
      const merge = spawnSync(process.execPath, [cli, 'merge-reports', '--config', join(__dirname, 'merge.config.cjs'), temp], {
        // Docker runs as the host UID, which can have no entry in /etc/passwd.
        cwd: root, env: { PATH: process.env.PATH, HOME: temp, REPORT_SOURCE_ROOT: sourceRoot, REPORT_STAGE: temp, ALLURE_HOST_NAME: 'runner' },
        stdio: 'inherit',
      });
      if (merge.error || merge.status !== 0) throw new Error('Could not render the sanitized test reports.');
      for (const name of ['index.html', 'results.xml']) {
        installFile(join(root, 'reports'), name, readFileSync(join(temp, 'reports', name)));
      }
      const raw = join(temp, 'allure-results');
      // No tests may have started (for example, a suite discovery error).
      mkdirSync(raw, { recursive: true });
      for (const entry of readdirSync(raw, { withFileTypes: true })) {
        const kind = entry.name.match(/^[\da-f-]+-(result|container)\.json$/i)?.[1];
        if (!entry.isFile() || !kind) throw new Error('Unexpected file in the isolated Allure output.');
        const bytes = readFileSync(join(raw, entry.name));
        installFile(join(root, 'allure-results'), safeAllureFilename(bytes, kind), bytes);
      }
      mkdirSync(dirname(this.marker), { recursive: true });
      writeFileSync(this.marker, 'ready\n', { flag: 'wx' });
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  }
};
