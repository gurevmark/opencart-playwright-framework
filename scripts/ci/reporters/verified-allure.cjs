const { createHash } = require('node:crypto');
const { existsSync, lstatSync, readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const safeAllureFilename = (bytes, kind) => `safe-${digest(bytes)}-${kind}.json`;

function verifiedResults(directory, project) {
  let count = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && (entry.name === 'history' || (project === 'host' && entry.name === 'local-docker'))) continue;
    if (entry.isFile() && entry.name === 'executor.json') continue;
    const match = /^safe-[a-f0-9]{64}-(result|container)\.json$/.exec(entry.name);
    if (!entry.isFile() || !match || entry.name !== safeAllureFilename(readFileSync(join(directory, entry.name)), match[1])) {
      throw new Error('Unverified Allure input. Remove legacy results and attachments from this project before generation.');
    }
    if (match[1] === 'result') count++;
  }
  return count;
}

// The Docker service copies latest/history into the next report and writes its
// own executor.json. Detect legacy or replaced metadata before the next build.
function historyDigest(results, reports) {
  const entries = [];
  function collect(path, label) {
    if (!existsSync(path)) return;
    const stat = lstatSync(path);
    if (stat.isDirectory()) {
      for (const name of readdirSync(path).sort()) collect(join(path, name), label + '/' + name);
    } else if (stat.isFile()) {
      entries.push([label, digest(readFileSync(path))]);
    } else {
      throw new Error('Unexpected file type in Allure history.');
    }
  }
  collect(join(results, 'executor.json'), 'executor');
  collect(join(results, 'history'), 'inputs');
  collect(join(reports, 'latest', 'history'), 'latest');
  return entries.length ? digest(JSON.stringify(entries)) : '';
}

module.exports = { safeAllureFilename, verifiedResults, historyDigest };
