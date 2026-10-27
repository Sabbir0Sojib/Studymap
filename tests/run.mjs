// Runs the browser test suites against a fresh build, on Windows, macOS or Linux.
//
//   node tests/run.mjs                 every suite
//   node tests/run.mjs core undo       only these (suite-core.js, suite-undo.js)
//   node tests/run.mjs --show          with the browser window open
//
// It builds the app, serves it on http://localhost:4173, runs each suite in Chromium and prints its PASS / FAIL lines.
// Files the suites save go to tests/out/ and tests/shots/; the whole report goes to tests/out/report.txt.
// Some suites need the internet (place search, boundaries, terrain tiles).
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build, preview } from 'vite';
import { chromium } from 'playwright';

const TESTS = dirname(fileURLToPath(import.meta.url));
const ROOT = join(TESTS, '..');
const PORT = 4173;

const args = process.argv.slice(2);
const show = args.includes('--show');
const wanted = args.filter((a) => !a.startsWith('--')).map((a) => a.replace(/^suite-/, '').replace(/\.js$/, ''));
const all = readdirSync(TESTS).filter((f) => /^suite-.+\.js$/.test(f)).map((f) => f.slice(6, -3));
const unknown = wanted.filter((w) => !all.includes(w));
if (unknown.length) {
  console.error(`No such suite: ${unknown.join(', ')}. There are: ${all.join(', ')}`);
  process.exit(2);
}
const suites = wanted.length ? wanted : all;

mkdirSync(join(TESTS, 'out'), { recursive: true });
mkdirSync(join(TESTS, 'shots'), { recursive: true });
// the suites save files under this folder (forward slashes work on Windows too)
globalThis.STUDYMAP_TESTS = TESTS.replace(/\\/g, '/') + '/';

console.log('Building the app...');
await build({ root: ROOT, logLevel: 'warn' });
const server = await preview({ root: ROOT, preview: { port: PORT, strictPort: true }, logLevel: 'warn' });

// behind a proxy (HTTPS_PROXY set), the browser uses it too, except for the local server
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const browser = await chromium.launch({ headless: !show, ...(proxy ? { proxy: { server: proxy, bypass: 'localhost,127.0.0.1' } } : {}) });

const report = [];
let failed = 0;
const say = (line) => { console.log(line); report.push(line); };
for (const name of suites) {
  say(`\n=== suite-${name}`);
  const source = readFileSync(join(TESTS, `suite-${name}.js`), 'utf8').trim().replace(/;\s*$/, '');
  // each suite is one `async page => { ... return log; }` function, as playwright-cli run-code takes it
  const suite = (0, eval)(`(${source})`);
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const t0 = Date.now();
  try {
    const log = await suite(page);
    for (const line of log ?? []) {
      say(line);
      if (/^FAIL\b/.test(line)) failed++;
    }
  } catch (e) {
    failed++;
    say(`CRASH ${String(e?.message ?? e).split('\n')[0]}`);
    try { await page.screenshot({ path: join(TESTS, 'shots', `crash-${name}.png`) }); say(`  screenshot: tests/shots/crash-${name}.png`); } catch { /* page gone */ }
  }
  say(`--- ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  await context.close();
}
await browser.close();
await new Promise((r) => server.httpServer.close(r));

const passed = report.filter((l) => /^PASS\b/.test(l)).length;
say(`\n${passed} passed, ${failed} failed or crashed, ${suites.length} suite${suites.length === 1 ? '' : 's'}.`);
writeFileSync(join(TESTS, 'out', 'report.txt'), report.join('\n') + '\n');
console.log(`Report: ${pathToFileURL(join(TESTS, 'out', 'report.txt')).href}`);
process.exit(failed ? 1 : 0);
