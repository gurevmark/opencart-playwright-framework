import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Titles come from Playwright discovery in a clean checkout without CI secrets.
// Runtime strings (even test names, steps and error messages) can contain credentials.
export function writePublicResults(catalog, rawDirectory, outputDirectory, browser) {
  if (!['chromium', 'firefox', 'webkit'].includes(browser)) throw new Error('Invalid project');
  const cases = new Map();
  function visit(suite, parents) {
    const path = [...parents, suite.title];
    for (const spec of suite.specs) {
      const fullName = [...path, spec.title].join(' › ');
      cases.set(fullName, { fullName, name: spec.title, suite: spec.file, tags: spec.tags });
    }
    for (const child of suite.suites ?? []) visit(child, path);
  }
  for (const suite of catalog.suites) visit(suite, []);

  // Require a new directory so stale attachments, history or executor metadata cannot enter it.
  mkdirSync(outputDirectory);
  const unknown = new Map();
  let count = 0;
  for (const entry of readdirSync(rawDirectory, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('-result.json')) continue;
    let raw;
    try {
      raw = JSON.parse(readFileSync(join(rawDirectory, entry.name), 'utf8'));
    } catch {
      throw new Error('Unreadable Allure result JSON');
    }
    let test = cases.get(raw.fullName);
    if (!test) {
      const key = raw.fullName ?? entry.name;
      if (!unknown.has(key)) unknown.set(key, `Unlisted test ${unknown.size + 1}`);
      const name = unknown.get(key);
      test = { fullName: name, name, suite: 'Unlisted tests', tags: [] };
    }
    const uuid = randomUUID();
    const id = createHash('sha256').update(`${browser}\n${test.fullName}`).digest('hex');
    const status = ['passed', 'failed', 'broken', 'skipped'].includes(raw.status) ? raw.status : 'unknown';
    const result = {
      uuid, testCaseId: id, historyId: id, name: test.name, fullName: test.fullName, status,
      labels: [
        { name: 'parentSuite', value: browser },
        { name: 'suite', value: test.suite },
        ...test.tags.map(value => ({ name: 'tag', value })),
      ],
    };
    if (Number.isSafeInteger(raw.start) && Number.isSafeInteger(raw.stop) && raw.stop >= raw.start) {
      result.start = raw.start;
      result.stop = raw.stop;
    }
    if (status === 'failed' || status === 'broken') {
      result.statusDetails = { message: 'See the Playwright and raw Allure artifacts in this Actions run for diagnostics.' };
    }
    writeFileSync(join(outputDirectory, `${uuid}-result.json`), JSON.stringify(result));
    count++;
  }
  return { count, unlisted: unknown.size };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [catalogFile, raw, output, browser] = process.argv.slice(2);
  const { count, unlisted } = writePublicResults(JSON.parse(readFileSync(catalogFile, 'utf8')), raw, output, browser);
  if (!count) throw new Error('No completed Allure test cases');
  console.log(`Prepared ${count} public results (${unlisted} unlisted tests).`);
}
