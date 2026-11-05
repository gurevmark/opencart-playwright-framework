const { lstatSync, realpathSync } = require('node:fs');
const { basename, dirname, join, resolve, sep } = require('node:path');

// Include missing leaves and compare conservatively on case-insensitive host mounts.
function canonicalPath(pathname) {
  let dir = resolve(pathname);
  const missing = [];
  while (!lstatSync(dir, { throwIfNoEntry: false })) {
    missing.unshift(basename(dir));
    dir = dirname(dir);
  }
  const path = join(realpathSync(dir), ...missing).normalize('NFC').toLowerCase();
  return path.endsWith(sep) ? path : path + sep;
}

const overlap = (a, b) => a.startsWith(b) || b.startsWith(a);

function verifyDockerMounts(htmlPath, allurePath, capturePath, root = process.cwd()) {
  const [html, allure, capture] = [htmlPath, allurePath, capturePath].map(canonicalPath);
  const published = [html, allure, ...['reports', 'allure-results', 'allure-report'].map(p => canonicalPath(join(root, p)))];
  if (overlap(html, allure) || published.some(path => overlap(path, capture))) {
    throw new Error('Use separate host directories for reports, Allure results and private Playwright captures.');
  }
}

module.exports = { canonicalPath, overlap, verifyDockerMounts };
if (require.main === module) verifyDockerMounts(...process.argv.slice(2));
