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
    // Run react-scripts build with GENERATE_SOURCEMAP=false
    const env = Object.assign({}, process.env, { GENERATE_SOURCEMAP: 'false' });
    console.log('Running react-scripts build with GENERATE_SOURCEMAP=false');
    await run('npx', ['react-scripts', 'build'], { env });

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
