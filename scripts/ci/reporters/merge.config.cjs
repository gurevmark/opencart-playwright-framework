// This config runs in a separate credential-free process against sanitized events.
const { join } = require('node:path');
const stage = process.env.REPORT_STAGE;
module.exports = {
  testDir: process.env.REPORT_SOURCE_ROOT,
  reporter: [
    ['html', { open: 'never', noSnippets: true, outputFolder: join(stage, 'reports') }],
    ['junit', { includeRetries: true, outputFile: join(stage, 'reports/results.xml') }],
    ['./merged-allure.cjs', { resultsDir: join(stage, 'allure-results') }],
  ],
};
