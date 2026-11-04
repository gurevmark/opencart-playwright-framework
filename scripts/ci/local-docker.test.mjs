import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { loadLocalConfig, localEnvironment } from './local-docker.mjs';

test('local credentials persist between runs and are stored privately', t => {
  const directory = mkdtempSync(path.join(tmpdir(), 'opencart-local-config-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const first = loadLocalConfig(directory);
  assert.deepEqual(loadLocalConfig(directory), first);
  assert.equal(new Set(Object.values(first.credentials)).size, 8);
  assert.ok(Object.values(first.credentials).every(value => value.length >= 32));
  assert.equal(statSync(path.join(directory, 'runtime.json')).mode & 0o777, 0o600);
});

test('changing published ports preserves internal service endpoints and credential mappings', t => {
  const directory = mkdtempSync(path.join(tmpdir(), 'opencart-local-env-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const config = loadLocalConfig(directory);
  config.ports = { opencart: 18087, mysql: 13317, fakestore: 16407 };
  const env = localEnvironment(config, '1.64.1', { uid: 501, gid: 20 });
  assert.equal(env.WEB_APP_URL, 'http://opencart/opencart/upload/');
  assert.equal(env.OPENCART_HTTP_SERVER, 'http://localhost:18087/opencart/upload/');
  // An explicit expected container URL catches accidental use of host port 16407.
  assert.equal(env.API_BASE_URL, 'http://fakestore:6400');
  assert.equal(env.FAKESTORE_PORT, '16407');
  assert.equal(env.DB_HOST, 'database');
  assert.equal(env.DB_PORT, '13317');
  assert.equal(env.DB_PASSWORD, config.credentials.database);
  assert.equal(env.OPENCART_DB_PASSWORD, env.DB_PASSWORD);
  assert.equal(env.OPENCART_TEST_PASSWORD, env.APP_PASSWORD);
  assert.equal(env.OPENCART_ADMIN_PASSWORD, env.ADMIN_PASSWORD);
  assert.equal(env.TEST_UID, '501');
  assert.equal(env.TEST_GID, '20');
});

test('invalid configuration fails without revealing stored credentials', t => {
  const directory = mkdtempSync(path.join(tmpdir(), 'opencart-local-invalid-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  loadLocalConfig(directory);
  const filename = path.join(directory, 'runtime.json');
  writeFileSync(filename, '{ private-password-marker');
  assert.throws(() => loadLocalConfig(directory), error => {
    assert.match(error.message, /Invalid local Docker configuration/);
    assert.ok(!error.message.includes('private-password-marker'));
    return true;
  });
  assert.equal(readFileSync(filename, 'utf8'), '{ private-password-marker');
});

test('invalid or conflicting host ports are rejected before startup', t => {
  const directory = mkdtempSync(path.join(tmpdir(), 'opencart-local-ports-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const config = loadLocalConfig(directory);
  for (const port of [0, 65536, '13316oops']) {
    assert.throws(() => localEnvironment({ ...config, ports: { ...config.ports, mysql: port } }, '1.64.1'), /Invalid local Docker configuration/);
  }
  assert.throws(() => localEnvironment({ ...config, ports: { opencart: 18086, mysql: 18086, fakestore: 16406 } }, '1.64.1'), /Invalid local Docker configuration/);
});
