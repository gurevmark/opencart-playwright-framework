import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const configuration = {
  APP_EMAIL: 'customer@example.test', APP_PASSWORD: 'synthetic-password-canary',
  ADMIN_USERNAME: 'ci-admin', ADMIN_PASSWORD: 'synthetic-admin-canary',
  DB_HOST: '127.0.0.1', DB_PORT: '3306', DB_NAME: 'ci_store', DB_USER: 'ci_user',
  DB_PASSWORD: 'synthetic-db-canary', OPENCART_DB_ROOT_PASSWORD: 'synthetic-root-canary',
  WEB_APP_URL: 'http://localhost:8080/opencart/upload/',
  PRODUCT_NAME: 'MacBook', PRODUCT_QUANTITY: '1', TOTAL_PRICE: '$602.00',
};

function validate(env, args = []) {
  return spawnSync(process.execPath, ['scripts/ci/validate-env.mjs', ...args], {
    env, encoding: 'utf8',
  });
}

test('missing CI configuration fails without using the local .env or printing supplied secrets', () => {
  const result = validate({ DB_PASSWORD: configuration.DB_PASSWORD });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /APP_EMAIL/);
  assert.match(result.stderr, /OPENCART_DB_ROOT_PASSWORD/);
  assert.doesNotMatch(result.stdout + result.stderr, /synthetic-db-canary/);
});

test('full CI rejects missing API and Mongo settings without printing supplied values', () => {
  const result = validate(configuration, ['--with-api']);
  assert.equal(result.status, 1);
  for (const name of ['API_BASE_URL', 'USERNAME', 'PASSWORD', 'FAKESTORE_JWT_SECRET', 'FAKESTORE_MONGO_PASSWORD', 'FAKESTORE_MONGO_ROOT_PASSWORD']) {
    assert.ok(result.stderr.includes(name));
  }
  assert.doesNotMatch(result.stdout + result.stderr, /synthetic-/);
});

test('full CI accepts a complete controlled API environment', () => {
  const result = validate({ ...configuration,
    API_BASE_URL: 'http://localhost:6400', USERNAME: 'synthetic-api-user', PASSWORD: 'synthetic-api-canary',
    USER_ID: '1', PRODUCT_ID: '1', CART_ID: '1', LIMIT: '3', START_DATE: '2020-01-01', END_DATE: '2020-03-02',
    FAKESTORE_JWT_SECRET: 'synthetic-jwt-canary', FAKESTORE_MONGO_PASSWORD: 'synthetic-mongo-canary',
    FAKESTORE_MONGO_ROOT_PASSWORD: 'synthetic-mongo-root-canary',
  }, ['--with-api']);
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout + result.stderr, /synthetic-/);
});

test('OpenCart CI works without FakeStore settings or a CI .env file', () => {
  const result = validate(configuration);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  for (const key of ['APP_PASSWORD', 'ADMIN_PASSWORD', 'DB_PASSWORD', 'OPENCART_DB_ROOT_PASSWORD']) {
    assert.ok(!(result.stdout + result.stderr).includes(configuration[key]));
  }
});

test('a blank required password fails and identifies only its name', () => {
  const result = validate({ ...configuration, DB_PASSWORD: '   ' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /DB_PASSWORD/);
  assert.doesNotMatch(result.stdout + result.stderr, /synthetic-/);
});
