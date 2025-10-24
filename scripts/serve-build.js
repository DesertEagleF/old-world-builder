#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');

const buildDir = path.resolve(__dirname, '..', 'build');
const port = process.env.PORT || 5000;

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  if (file.endsWith('.json')) return 'application/json; charset=utf-8';
  if (file.endsWith('.png')) return 'image/png';
  return 'application/octet-stream';
}

const server = http.createServer((req, res) => {
  let reqPath = decodeURIComponent(req.url.split('?')[0]);
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(buildDir, reqPath.replace(/^\//, ''));
  if (!filePath.startsWith(buildDir)) {
    res.statusCode = 403; res.end('Forbidden'); return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.statusCode = 404; res.end('Not found'); return; }
    res.setHeader('Content-Type', contentType(filePath));
    res.end(data);
  });
});

server.listen(port, () => {
  console.log(`Serving ${buildDir} at http://localhost:${port}`);
});
