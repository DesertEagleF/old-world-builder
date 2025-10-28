#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// 使用与smoke-test.js相同的artifact目录配置
const projectRoot = path.resolve(__dirname, '..');
const buildDir = path.join(projectRoot, 'build');
const artifactDir = process.env.CI_PROJECT_DIR ? 
  path.join(process.env.CI_PROJECT_DIR, 'dist') : 
  path.join(projectRoot, 'build');

function safeReadDir(dir) {
  try {
    return fs.readdirSync(dir);
  } catch (e) {
    return [];
  }
}

function removeSourceMapComments(content) {
  return content.replace(/\n?\/\/#[ \t]*sourceMappingURL=.*$/gm, '').replace(/\n?\/\*# sourceMappingURL=.*\*\//gm, '');
}

function concatFiles(dir, files, outPath, filterOutRegex) {
  let out = '';
  files.forEach((f) => {
    if (filterOutRegex && filterOutRegex.test(f)) return;
    const filePath = path.join(dir, f);
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8');
    out += removeSourceMapComments(content) + '\n';
  });
  // 确保输出目录存在
  const outDir = path.dirname(outPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  fs.writeFileSync(outPath, out, 'utf8');
}

function copyBuildToArtifact() {
  try {
    // 如果artifact目录已存在，先清空
    if (fs.existsSync(artifactDir)) {
      fs.rmSync(artifactDir, { recursive: true, force: true });
    }
    
    // 复制整个build目录到artifact目录
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
    
    if (fs.existsSync(buildDir)) {
      fs.mkdirSync(artifactDir, { recursive: true });
      copyRecursive(buildDir, artifactDir);
      console.log(`Copied build files to artifact directory: ${artifactDir}`);
    } else {
      console.error('Build directory not found, run `npm run build` first');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error copying to artifact directory:', error);
    throw error;
  }
}

function main() {
  // 首先将构建文件复制到artifact目录
  copyBuildToArtifact();

  const artifactJsDir = path.join(artifactDir, 'static', 'js');
  const artifactCssDir = path.join(artifactDir, 'static', 'css');

  // JS
  const jsFiles = safeReadDir(artifactJsDir).filter(f => f.endsWith('.js'));
  const jsCandidates = jsFiles.filter(f => !/precache-manifest|service-worker|asset-manifest/.test(f));

  // sort with heuristic: runtime -> vendors/chunk -> main -> others
  function weight(name) {
    const n = name.toLowerCase();
    if (n.includes('runtime')) return 0;
    if (n.includes('vendors') || n.includes('.chunk.') || /^\d+\./.test(n)) return 1;
    if (n.includes('main')) return 2;
    return 3;
  }
  jsCandidates.sort((a,b) => {
    const wa = weight(a); const wb = weight(b);
    if (wa !== wb) return wa - wb;
    return a.localeCompare(b);
  });

  // 输出到artifact目录
  const outJsPath = path.join(artifactJsDir, 'bundle.js');
  concatFiles(artifactJsDir, jsCandidates, outJsPath);
  console.log('Wrote', outJsPath);

  // CSS
  const cssFiles = safeReadDir(artifactCssDir).filter(f => f.endsWith('.css'));
  const outCssPath = path.join(artifactCssDir, 'main.css');
  concatFiles(artifactCssDir, cssFiles, outCssPath);
  console.log('Wrote', outCssPath);

  // Remove maps from artifact directory
  const mapFiles = [];
  function collectMaps(dir) {
    safeReadDir(dir).forEach(f => {
      const p = path.join(dir, f);
      if (f.endsWith('.map')) {
        mapFiles.push(p);
      }
    });
  }
  collectMaps(artifactJsDir);
  collectMaps(artifactCssDir);
  collectMaps(artifactDir);
  mapFiles.forEach(p => {
    try { fs.unlinkSync(p); console.log('Removed map', p);} catch(e){}
  });

  // Update index.html in artifact directory to reference single js/css
  const indexPath = path.join(artifactDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    let html = fs.readFileSync(indexPath, 'utf8');
    // remove existing link rel=stylesheet to /static/css/
    html = html.replace(/<link[^>]*href="[^"]*static\/css\/[^"]*"[^>]*>\s*/gmi, '');
    // insert single css link in head before </head>
    html = html.replace('</head>', '  <link rel="stylesheet" href="/static/css/main.css">\n</head>');

    // remove existing script tags that reference static/js
    html = html.replace(/<script[^>]*src="[^"]*static\/js\/[^"]*"[^>]*><\/script>\s*/gmi, '');
    // insert single script before </body>
    html = html.replace('</body>', '  <script src="/static/js/bundle.js"></script>\n</body>');

    fs.writeFileSync(indexPath, html, 'utf8');
    console.log('Updated', indexPath);
  }

  // Optionally remove original chunk files from artifact directory (keep precache/service worker files)
  jsCandidates.forEach(f => {
    const p = path.join(artifactJsDir, f);
    try { if (p !== outJsPath) fs.unlinkSync(p); } catch (e) {}
  });
  cssFiles.forEach(f => {
    const p = path.join(artifactCssDir, f);
    try { if (p !== outCssPath) fs.unlinkSync(p); } catch (e) {}
  });

  console.log('Merge complete. Single bundle at:', outJsPath, 'and', outCssPath);
  console.log('Artifact directory:', artifactDir);
}

main();