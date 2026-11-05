import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const installer = fileURLToPath(new URL('./install-allure.sh', import.meta.url));

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'allure-install-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const bin = join(directory, 'bin');
  const distribution = join(directory, 'allure-2.46.1', 'bin');
  mkdirSync(bin);
  mkdirSync(distribution, { recursive: true });
  writeFileSync(join(distribution, 'allure'), '#!/bin/sh\necho fixture\n', { mode: 0o755 });
  const archive = join(directory, 'fixture.zip');
  execFileSync('zip', ['-qr', archive, 'allure-2.46.1'], { cwd: directory });
  const downloads = join(directory, 'downloads');
  writeFileSync(join(bin, 'curl'), `#!/bin/bash
set -eu
echo download >> "$DOWNLOAD_LOG"
if [[ "\${DOWNLOAD_FAIL:-false}" == true ]]; then exit 22; fi
while [[ "$1" != --output ]]; do shift; done
cp "$FIXTURE_ARCHIVE" "$2"
`, { mode: 0o755 });
  const env = {
    ...process.env, PATH: `${bin}:${process.env.PATH}`,
    ALLURE_VERSION: '2.46.1',
    ALLURE_SHA256: createHash('sha256').update(readFileSync(archive)).digest('hex'),
    ALLURE_CACHE_DIR: join(directory, 'cache'), ALLURE_HOME: join(directory, 'installed'),
    FIXTURE_ARCHIVE: archive, DOWNLOAD_LOG: downloads,
  };
  const run = (overrides = {}) => spawnSync('bash', [installer], {
    encoding: 'utf8', env: { ...env, ...overrides },
  });
  return { directory, env, downloads, run };
}

test('downloads on a cold cache and installs from the same verified archive on a cache hit', t => {
  const { directory, env, downloads, run } = fixture(t);
  const cold = run();
  assert.equal(cold.status, 0, cold.stderr);
  assert.ok(existsSync(join(env.ALLURE_HOME, 'allure-2.46.1/bin/allure')));
  const warm = run({ ALLURE_HOME: join(directory, 'next-run'), DOWNLOAD_FAIL: 'true' });
  assert.equal(warm.status, 0, warm.stderr);
  assert.equal(readFileSync(downloads, 'utf8'), 'download\n');
  assert.ok(existsSync(join(directory, 'next-run/allure-2.46.1/bin/allure')));
});

test('rejects a corrupted cache before extraction', t => {
  const { env, run } = fixture(t);
  mkdirSync(env.ALLURE_CACHE_DIR);
  writeFileSync(join(env.ALLURE_CACHE_DIR, 'allure-2.46.1.zip'), 'corrupted');
  const result = run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /checksum/i);
  assert.equal(existsSync(env.ALLURE_HOME), false);
});

test('a failed download fails installation', t => {
  const { env, run } = fixture(t);
  assert.notEqual(run({ DOWNLOAD_FAIL: 'true' }).status, 0);
  assert.equal(existsSync(env.ALLURE_HOME), false);
});
