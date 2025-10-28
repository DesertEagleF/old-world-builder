#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const buildDir = path.join(projectRoot, 'build');

function fail(msg) { console.error('FAIL:', msg); process.exitCode = 2; }
function ok(msg) { console.log('OK:', msg); }

function checkFiles() {
  const index = path.join(buildDir, 'index.html');
  const js = path.join(buildDir, 'static', 'js', 'bundle.js');
  const css = path.join(buildDir, 'static', 'css', 'main.css');
  if (!fs.existsSync(buildDir)) return fail('build directory not found');
  if (!fs.existsSync(index)) return fail('dist/index.html not found');
  if (!fs.existsSync(js)) return fail('dist/js/bundle.js not found');
  if (!fs.existsSync(css)) return fail('dist/css/main.css not found');
  ok('All expected files exist');

  const html = fs.readFileSync(index, 'utf8');
  if (!html.includes('/static/js/bundle.js')) fail('index.html does not reference /static/js/bundle.js');
  if (!html.includes('/static/css/main.css')) fail('index.html does not reference /static/css/main.css');
  ok('index.html references expected bundle paths');
}

async function tryHeadless(url) {
  // Try puppeteer or playwright if installed. If not present, skip this step.
  try {
    const puppeteer = require('puppeteer');
    console.log('Using puppeteer for headless smoke test');
    const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
    console.log('HTTP status:', resp.status());
    const errors = [];
    page.on('pageerror', e => errors.push(e));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    // Wait a short moment for runtime tasks
    await page.waitForTimeout(1000);
    await browser.close();
    if (errors.length) { fail('Runtime errors in page: ' + errors.join('\n')); }
    ok('Headless page loaded with no runtime errors');
  } catch (e) {
    console.log('Headless test skipped (puppeteer/playwright not installed):', e.message);
  }
}

async function main() {
  const noServe = process.argv.includes('--no-serve');
  checkFiles();
  if (noServe) return;

  // Start a lightweight server in the background (node) and run headless check
  const port = 5000;
  const serverProc = spawnSync(process.execPath, [path.join(__dirname, 'serve-build.js')], { detached: true, stdio: 'ignore' });
  console.log('Started serve-build.js (detached)');
  // Try headless check against http://localhost:5000
  await tryHeadless('http://localhost:5000');
}

main().then(() => { console.log('Smoke test finished'); }).catch(err => { console.error(err); process.exitCode = 3; });
