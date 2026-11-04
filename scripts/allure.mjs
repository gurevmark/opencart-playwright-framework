import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { devNull } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const serviceUrl = 'http://127.0.0.1:5051/allure-docker-service';
const projects = { host: 'allure-results', 'local-docker': 'allure-results/local-docker' };
const [action, project = 'host', ...extra] = process.argv.slice(2);
const lifecycle = {
  up: ['up', '-d', '--wait', '--wait-timeout', '90'],
  status: ['ps', '--all'],
  stop: ['stop'],
  down: ['down'],
};

async function main() {
  if (!(Object.hasOwn(lifecycle, action) || ['generate', 'open'].includes(action)) ||
      extra.length || !Object.hasOwn(projects, project) ||
      (Object.hasOwn(lifecycle, action) && process.argv.length > 3)) {
    console.error('Usage: node scripts/allure.mjs up|status|stop|down|generate [host|local-docker]|open [host|local-docker]');
    return 2;
  }

  if (Object.hasOwn(lifecycle, action)) {
    if (action === 'up') {
      for (const [id, directory] of Object.entries(projects)) {
        mkdirSync(path.join(root, directory), { recursive: true });
        mkdirSync(path.join(root, 'allure-report', id), { recursive: true });
      }
    }
    const result = spawnSync('docker', [
      'compose', '--env-file', devNull, '--project-name', 'opencart-allure',
      '-f', 'docker-compose.allure.yml', ...lifecycle[action],
    ], { cwd: root, stdio: 'inherit' });
    if (result.error) throw new Error('Cannot run Docker. Start Docker Desktop and check that docker is available.');
    return result.status ?? 1;
  }

  const reportUrl = `${serviceUrl}/projects/${project}/reports/latest/index.html`;
  if (action === 'generate') {
    const directory = path.join(root, projects[project]);
    const hasResults = existsSync(directory) && readdirSync(directory, { withFileTypes: true })
      .some(entry => entry.isFile() && entry.name.endsWith('-result.json'));
    if (!hasResults) throw new Error(`No Allure test results in ${projects[project]}. Run tests first.`);

    let response;
    try {
      response = await fetch(`${serviceUrl}/generate-report?project_id=${project}`, {
        signal: AbortSignal.timeout(120_000),
      });
    } catch (error) {
      throw new Error(`Cannot reach Allure or generation timed out (${error.message}). Check npm run allure:status; start with npm run allure:up.`);
    }
    if (!response.ok) throw new Error(`Allure returned HTTP ${response.status}: ${await response.text()}`);
  }

  console.log(`Allure (${project}): ${reportUrl}`);
  if (action === 'open' && process.platform === 'darwin') {
    const result = spawnSync('open', [reportUrl], { encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'] });
    if (result.error || result.status !== 0) {
      console.warn('Could not launch the macOS default browser. Open the printed URL manually.');
    }
  }
  return 0;
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
