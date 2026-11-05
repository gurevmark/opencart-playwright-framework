import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { devNull } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import paths from './reporters/paths.cjs';

const project = 'opencart-local-ci';
const root = fileURLToPath(new URL('../../', import.meta.url));
const credentialNames = ['database', 'databaseRoot', 'customer', 'admin', 'api', 'mongo', 'mongoRoot', 'jwt'];

function validate(config) {
  const ports = Object.values(config?.ports ?? {});
  if (config?.version !== 1 || ports.length !== 3 ||
      !['opencart', 'mysql', 'fakestore'].every(name => Number.isInteger(config.ports[name]) && config.ports[name] > 0 && config.ports[name] <= 65535) ||
      new Set(ports).size !== 3 ||
      !credentialNames.every(name => typeof config.credentials?.[name] === 'string' && config.credentials[name].length >= 32)) {
    throw new Error('Invalid local Docker configuration. Check .docker-local/runtime.json.');
  }
}

export function loadLocalConfig(directory) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const filename = path.join(directory, 'runtime.json');
  if (!existsSync(filename)) {
    const config = {
      version: 1,
      ports: { opencart: 18086, mysql: 13316, fakestore: 16406 },
      credentials: Object.fromEntries(credentialNames.map(name => [name, randomBytes(32).toString('hex')])),
    };
    writeFileSync(filename, JSON.stringify(config, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  }
  let config;
  try {
    config = JSON.parse(readFileSync(filename, 'utf8'));
  } catch {
    throw new Error('Invalid local Docker configuration. Check .docker-local/runtime.json.');
  }
  validate(config);
  return config;
}

export function localEnvironment(config, playwrightVersion, ids = { uid: process.getuid?.() ?? 1000, gid: process.getgid?.() ?? 1000 }) {
  validate(config);
  const { ports: publishedPorts, credentials } = config;
  return {
    CI: 'true', APP_ENV: 'local-docker', PLAYWRIGHT_VERSION: playwrightVersion,
    TEST_UID: String(ids.uid), TEST_GID: String(ids.gid),
    PLAYWRIGHT_TEST_IMAGE: 'opencart-playwright:local',
    PLAYWRIGHT_REPORTS_DIR: './reports/local-docker',
    PLAYWRIGHT_ALLURE_DIR: './allure-results/local-docker',
    PLAYWRIGHT_RESULTS_DIR: './test-results/local-docker',
    WEB_APP_URL: 'http://opencart/opencart/upload/',
    OPENCART_HTTP_SERVER: `http://localhost:${publishedPorts.opencart}/opencart/upload/`,
    OPENCART_PORT: String(publishedPorts.opencart),
    // DB_PORT publishes MySQL on the host; the test service always uses 3306.
    DB_HOST: 'database', DB_PORT: String(publishedPorts.mysql), DB_NAME: 'openshop', DB_USER: 'opencart_local',
    DB_PASSWORD: credentials.database, OPENCART_DB_PASSWORD: credentials.database,
    OPENCART_DB_NAME: 'openshop', OPENCART_DB_USER: 'opencart_local',
    OPENCART_DB_ROOT_PASSWORD: credentials.databaseRoot,
    APP_EMAIL: 'local-docker@example.test', APP_PASSWORD: credentials.customer,
    OPENCART_TEST_EMAIL: 'local-docker@example.test', OPENCART_TEST_PASSWORD: credentials.customer,
    ADMIN_USERNAME: 'localadmin', ADMIN_PASSWORD: credentials.admin,
    OPENCART_ADMIN_USER: 'localadmin', OPENCART_ADMIN_PASSWORD: credentials.admin,
    OPENCART_ADMIN_EMAIL: 'admin@example.test',
    PRODUCT_NAME: 'MacBook', PRODUCT_QUANTITY: '1', TOTAL_PRICE: '$602.00',
    // FakeStore listens on container port 6400. The configurable published
    // port is used only for access from the Mac, not service-to-service traffic.
    API_BASE_URL: 'http://fakestore:6400', FAKESTORE_PORT: String(publishedPorts.fakestore),
    USERNAME: 'localdocker', PASSWORD: credentials.api,
    USER_ID: '1', PRODUCT_ID: '1', CART_ID: '1', LIMIT: '3',
    START_DATE: '2020-01-01', END_DATE: '2020-03-02',
    FAKESTORE_MONGO_PASSWORD: credentials.mongo,
    FAKESTORE_MONGO_ROOT_PASSWORD: credentials.mongoRoot,
    FAKESTORE_JWT_SECRET: credentials.jwt,
  };
}

function main() {
  const [action = 'test', suite = 'test:master', browser = 'chromium', ...extra] = process.argv.slice(2);
  if (!['test', 'up', 'status', 'stop', 'down'].includes(action)) {
    console.error('Usage: node scripts/ci/local-docker.mjs [test [suite browser [Playwright args...]] | up | status | stop | down]');
    return 2;
  }
  if (action === 'test' && (!['test:master', 'test:opencart', 'test:sanity', 'test:regression', 'test:e2e', 'test:api', 'test:web', 'test:db', 'test:datadriven'].includes(suite) || !['chromium', 'firefox', 'webkit'].includes(browser))) {
    console.error('Unsupported test suite or browser.');
    return 2;
  }
  const config = loadLocalConfig(path.join(root, '.docker-local'));
  const lock = JSON.parse(readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  const env = { ...process.env, ...localEnvironment(config, lock.packages['node_modules/@playwright/test'].version) };
  const compose = ['compose', '--env-file', devNull, '--project-name', project,
    '-f', 'docker-compose.yml', '-f', 'docker-compose.ci.yml', '-f', 'docker-compose.test.yml'];
  function docker(args) {
    const result = spawnSync('docker', [...compose, ...args], { cwd: root, env, stdio: 'inherit' });
    if (result.error) throw new Error('Cannot run Docker. Start Docker Desktop and check that the docker command is available.');
    return result.status ?? 1;
  }
  if (action === 'status') return docker(['ps', '--all']);
  if (action === 'stop') return docker(['stop']);
  if (action === 'down') return docker(['down', '--remove-orphans']);

  const directories = ['reports/local-docker', 'allure-results/local-docker', 'test-results/local-docker'];
  paths.verifyDockerMounts(...directories.map(directory => path.join(root, directory)), root);
  for (const directory of directories) {
    mkdirSync(path.join(root, directory), { recursive: true });
  }
  if (action === 'test') {
    const built = docker(['build', 'playwright-tests']);
    if (built) return built;
  }
  const started = docker(['up', '--build', '--wait', '--wait-timeout', '300', 'database', 'opencart', 'fakestore-database', 'fakestore']);
  if (started) return started;
  console.log(`Docker Desktop project: ${project}`);
  console.log(`OpenCart: ${env.OPENCART_HTTP_SERVER}`);
  console.log(`Controlled FakeStore: http://127.0.0.1:${config.ports.fakestore}`);
  if (action === 'up') return 0;
  const integration = docker(['exec', '-T', 'fakestore', 'npm', 'test']);
  if (integration) return integration;
  const urls = docker(['exec', '-T', 'opencart', 'php', '/usr/local/lib/opencart/http-server.test.php']);
  if (urls) return urls;
  const result = docker(['run', '--rm', '--no-deps', '-T', 'playwright-tests',
    'bash', 'scripts/ci/run-tests.sh', suite, browser, '--output=test-results/run', ...extra]);
  console.log('Reports: reports/local-docker/; application containers remain running.');
  return result;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
