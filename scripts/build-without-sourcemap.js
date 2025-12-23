#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, Object.assign({ stdio: 'inherit', shell: true }, opts));
    p.on('close', (code) => {
      if (code === 0) resolve(0);
      else reject(new Error(`${cmd} exited with ${code}`));
    });
    p.on('error', (err) => reject(err));
  });
}

(async () => {
  try {
    // 使用本地安装的 react-scripts，而不是 npx
    const env = Object.assign({}, process.env, { 
      GENERATE_SOURCEMAP: 'false',
      // 确保使用正确的 Node path
      NODE_PATH: path.join(__dirname, '..', 'node_modules')
    });
    
    console.log('Running react-scripts build with GENERATE_SOURCEMAP=false');
    
    // Resolve react-scripts build script directly (avoids executing the
    // platform-specific shell wrapper under node_modules/.bin which on
    // Unix is a shell script and will cause a SyntaxError if executed by
    // Node on Windows). Using require.resolve finds the actual JS entry.
    let reactScriptsBuild;
    try {
      reactScriptsBuild = require.resolve('react-scripts/scripts/build');
    } catch (err) {
      // Fallback to the .bin path if resolve fails for some reason
      reactScriptsBuild = path.join(__dirname, '..', 'node_modules', '.bin', 'react-scripts');
    }
    // If reactScriptsBuild points to the JS file, run it directly with node.
    // If it falls back to the .bin wrapper on some environments, pass 'build'.
    if (reactScriptsBuild.endsWith('.js')) {
      await run('node', [reactScriptsBuild], { env });
    } else {
      await run('node', [reactScriptsBuild, 'build'], { env });
    }
    
    // 或者使用 npx 但指定前缀
    // await run('npx', ['--prefix', process.cwd(), 'react-scripts', 'build'], { env });

    // After build, run merge script
    console.log('Running merge-build.js to produce single JS/CSS and remove maps');
    const mergeScript = path.join(__dirname, 'merge-build.js');
    await run('node', [mergeScript]);

    console.log('Build complete.');
  } catch (e) {
    console.error('Build failed:', e && e.message ? e.message : e);
    process.exit(1);
  }
})();