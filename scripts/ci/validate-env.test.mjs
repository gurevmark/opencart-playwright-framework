import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const configuration = {
  APP_EMAIL: 'customer@example.test', APP_PASSWORD: 'synthetic-password-canary',
  ADMIN_USERNAME: 'ci-admin', ADMIN_PASSWORD: 'synthetic-admin-canary',
  DB_HOST: '127.0.0.1', DB_PORT: '3306', DB_NAME: 'ci_store', DB_USER: 'ci_user',
  DB_PASSWORD: 'synthetic-db-canary', OPENCART_DB_ROOT_PASSWORD: 'synthetic-root-canary',
  WEB_APP_URL: 'http://localhost:8080/opencart/upload/',
  API_BASE_URL: 'https://fakestoreapi.com', USERNAME: 'ci-api-user', PASSWORD: 'synthetic-api-canary',
  PRODUCT_NAME: 'MacBook', PRODUCT_QUANTITY: '1', TOTAL_PRICE: '$602.00',
  PRODUCT_ID: '1', USER_ID: '1', CART_ID: '1', LIMIT: '3',
  START_DATE: '2020-01-01', END_DATE: '2020-03-02',
};

function validate(env) {
  return spawnSync(process.execPath, ['scripts/ci/validate-env.mjs'], {
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

test('a complete process environment works without a CI .env file', () => {
  const result = validate(configuration);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  for (const key of ['APP_PASSWORD', 'ADMIN_PASSWORD', 'DB_PASSWORD', 'PASSWORD']) {
    assert.ok(!(result.stdout + result.stderr).includes(configuration[key]));
  }
});

test('a blank required password fails and identifies only its name', () => {
  const result = validate({ ...configuration, DB_PASSWORD: '   ' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /DB_PASSWORD/);
  assert.doesNotMatch(result.stdout + result.stderr, /synthetic-/);
});
