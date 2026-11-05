const { existsSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { canonicalPath, overlap } = require('./paths.cjs');
const dotenv = require('dotenv');

const credentialVariables = ['APP_EMAIL', 'APP_PASSWORD', 'ADMIN_USERNAME', 'ADMIN_PASSWORD', 'DB_USER', 'DB_PASSWORD',
  'USERNAME', 'PASSWORD', 'FAKESTORE_CI_USERNAME', 'FAKESTORE_CI_PASSWORD', 'FAKESTORE_JWT_SECRET',
  'FAKESTORE_MONGO_PASSWORD', 'FAKESTORE_MONGO_ROOT_PASSWORD', 'OPENCART_DB_USER', 'OPENCART_DB_PASSWORD',
  'OPENCART_DB_ROOT_PASSWORD', 'OPENCART_ADMIN_USER', 'OPENCART_ADMIN_EMAIL', 'OPENCART_ADMIN_PASSWORD',
  'OPENCART_TEST_EMAIL', 'OPENCART_TEST_PASSWORD'];

function configureReportRun(args, root) {
  const envFile = join(root, '.env');
  if (args.some(arg => /^--(?:add-)?reporter(?:=|$)/.test(arg))) {
    // Only the literal catalog invocation may bypass the configured writers.
    // In particular --list can otherwise be consumed as a value of --grep.
    const catalog = args[0] === 'test' && args[1] === '--list' && args[2] === '--reporter=json'
      && (args.length === 3 || (args.length === 4 && /^--project=(chromium|firefox|webkit)$/.test(args[3])));
    const outputOverride = Object.keys(process.env).some(key => /^(PW_TEST_REPORTER$|PLAYWRIGHT_(JSON|JUNIT|HTML|BLOB)_|PW_TEST_HTML_)/.test(key));
    if (catalog && !outputOverride && !credentialVariables.some(key => process.env[key])
      && !existsSync(envFile) && !existsSync(resolve('.env'))) return;
    throw new Error('Use the configured report writers. JSON discovery requires a credential-free checkout and environment.');
  }
  dotenv.config({ path: envFile, quiet: true });
  if (process.env.PW_TEST_REPORTER) throw new Error('Use the configured report writers.');
  const reports = ['reports', 'allure-results'].map(name => canonicalPath(join(root, name)));
  const outputs = [join(root, 'test-results')];
  for (const [i, arg] of args.entries()) {
    if (arg === '--output') outputs.push(args[i + 1]);
    if (arg.startsWith('--output=')) outputs.push(arg.slice('--output='.length));
  }
  for (const output of outputs) {
    const scratch = canonicalPath(output);
    if (reports.some(report => overlap(report, scratch))) {
      throw new Error('Keep Playwright capture output separate from report artifacts.');
    }
  }
}

module.exports = { credentialVariables, configureReportRun };
