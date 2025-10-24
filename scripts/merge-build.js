#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

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
  fs.writeFileSync(outPath, out, 'utf8');
}

function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const buildDir = path.join(projectRoot, 'build');
  const jsDir = path.join(buildDir, 'static', 'js');
  const cssDir = path.join(buildDir, 'static', 'css');

  if (!fs.existsSync(buildDir)) {
    console.error('build directory not found, run `npm run build` first');
    process.exit(1);
  }

  // JS
  const jsFiles = safeReadDir(jsDir).filter(f => f.endsWith('.js'));
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

  const outJsPath = path.join(jsDir, 'bundle.js');
  concatFiles(jsDir, jsCandidates, outJsPath);
  console.log('Wrote', outJsPath);

  // CSS
  const cssFiles = safeReadDir(cssDir).filter(f => f.endsWith('.css'));
  const outCssPath = path.join(cssDir, 'main.css');
  concatFiles(cssDir, cssFiles, outCssPath);
  console.log('Wrote', outCssPath);

  // Remove maps
  const mapFiles = [];
  function collectMaps(dir) {
    safeReadDir(dir).forEach(f => {
      const p = path.join(dir, f);
      if (f.endsWith('.map')) {
        mapFiles.push(p);
      }
    });
  }
  collectMaps(jsDir);
  collectMaps(cssDir);
  collectMaps(buildDir);
  mapFiles.forEach(p => {
    try { fs.unlinkSync(p); console.log('Removed map', p);} catch(e){}
  });

  // Update index.html to reference single js/css
  const indexPath = path.join(buildDir, 'index.html');
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

  // Optionally remove original chunk files (keep precache/service worker files)
  jsCandidates.forEach(f => {
    const p = path.join(jsDir, f);
    try { if (p !== outJsPath) fs.unlinkSync(p); } catch (e) {}
  });
  cssFiles.forEach(f => {
    const p = path.join(cssDir, f);
    try { if (p !== outCssPath) fs.unlinkSync(p); } catch (e) {}
  });

  console.log('Merge complete. Single bundle at:', outJsPath, 'and', outCssPath);
}

main();
