#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const buildDir = path.join(projectRoot, 'build');
// 添加artifact目录配置 - 使用GitLab CI的环境变量或默认值
const artifactDir = process.env.CI_PROJECT_DIR ? 
  path.join(process.env.CI_PROJECT_DIR, 'public') : 
  path.join(projectRoot, 'build');

function fail(msg) { console.error('FAIL:', msg); process.exitCode = 2; }
function ok(msg) { console.log('OK:', msg); }

// 确保artifact目录存在
function ensureArtifactDir() {
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
    console.log(`Created artifact directory: ${artifactDir}`);
  }
}

// 复制构建文件到artifact目录
function copyToArtifactDir() {
  try {
    // 如果build目录存在，将其内容复制到artifact目录
    if (fs.existsSync(buildDir)) {
      // 清空artifact目录（如果存在）
      if (fs.existsSync(artifactDir)) {
        fs.rmSync(artifactDir, { recursive: true, force: true });
      }
      fs.mkdirSync(artifactDir, { recursive: true });
      
      // 复制build目录内容到artifact目录
      const copyRecursive = (src, dest) => {
        const entries = fs.readdirSync(src, { withFileTypes: true });
        for (const entry of entries) {
          const srcPath = path.join(src, entry.name);
          const destPath = path.join(dest, entry.name);
          if (entry.isDirectory()) {
            fs.mkdirSync(destPath, { recursive: true });
            copyRecursive(srcPath, destPath);
          } else {
            fs.copyFileSync(srcPath, destPath);
          }
        }
      };
      
      copyRecursive(buildDir, artifactDir);
      console.log(`Copied build files from ${buildDir} to ${artifactDir}`);
    }
  } catch (error) {
    console.error('Error copying files to artifact directory:', error);
    throw error;
  }
}

function checkFiles() {
  // 现在检查artifact目录而不是build目录
  const index = path.join(artifactDir, 'index.html');
  const js = path.join(artifactDir, 'static', 'js', 'bundle.js');
  const css = path.join(artifactDir, 'static', 'css', 'main.css');
  
  if (!fs.existsSync(artifactDir)) return fail('artifact directory not found');
  if (!fs.existsSync(index)) return fail('artifact/index.html not found');
  if (!fs.existsSync(js)) return fail('artifact/static/js/bundle.js not found');
  if (!fs.existsSync(css)) return fail('artifact/static/css/main.css not found');
  ok('All expected files exist in artifact directory');

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
  
  // 确保artifact目录存在
  ensureArtifactDir();
  
  // 复制构建文件到artifact目录
  copyToArtifactDir();
  
  checkFiles();
  if (noServe) return;

  // 修改服务器以服务artifact目录
  // 注意：您也需要修改serve-build.js来服务artifact目录
  const serverProc = spawnSync(process.execPath, [path.join(__dirname, 'serve-build.js')], { 
    detached: true, 
    stdio: 'ignore',
    env: { ...process.env, SERVED_DIR: artifactDir } // 传递artifact目录给服务器
  });
  console.log('Started serve-build.js (detached)');
  // Try headless check against http://localhost:5000
  await tryHeadless('http://localhost:5000');
}

main().then(() => { console.log('Smoke test finished'); }).catch(err => { console.error(err); process.exitCode = 3; });