/**
 * The static server the browser tests run the site on. One copy, so every
 * test serves .mjs, .wasm, .onnx and .wav with the types the tools need.
 *
 *   node build/tests/serve.js [root] [port]        keep serving until killed
 *   const { serve } = require('./serve.js');       from a test:
 *   const server = await serve(root, port);        resolves to the server, or
 *                                                  to null when something is
 *                                                  already listening on the
 *                                                  port (that server is used)
 *   server && server.close();
 *
 * Paths outside root answer 403, directories without a slash redirect, and
 * everything is sent with Cache-Control: no-store so a rebuilt page is what
 * the browser loads.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.wasm': 'application/wasm', '.onnx': 'application/octet-stream', '.bin': 'application/octet-stream', '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.mp4': 'video/mp4', '.webm': 'video/webm', '.wav': 'audio/wav', '.mp3': 'audio/mpeg',
  '.srt': 'text/plain; charset=utf-8', '.vtt': 'text/vtt; charset=utf-8', '.pdf': 'application/pdf'
};

function handler(root) {
  const base = path.resolve(root);
  return (req, res) => {
    let p;
    try { p = decodeURIComponent(req.url.split('?')[0]); } catch (e) { res.writeHead(400); res.end(); return; }
    if (p.endsWith('/')) p += 'index.html';
    const abs = path.join(base, p);
    if (abs !== base && !abs.startsWith(base + path.sep)) { res.writeHead(403); res.end(); return; }
    fs.stat(abs, (err, st) => {
      if (!err && st.isDirectory()) { res.writeHead(301, { Location: p + '/' }); res.end(); return; }
      if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found: ' + p); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(abs).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-store' });
      fs.createReadStream(abs).pipe(res);
    });
  };
}

/** Serve root on 127.0.0.1:port. Resolves to the server, or to null when the
 *  port is taken, on the assumption that what holds it is serving the site. */
function serve(root, port) {
  return new Promise((resolve, reject) => {
    const s = http.createServer(handler(root));
    s.once('error', (e) => {
      if (e.code === 'EADDRINUSE') { console.log('port ' + port + ' is in use; using the server already there'); resolve(null); }
      else reject(e);
    });
    s.listen(port, '127.0.0.1', () => resolve(s));
  });
}

module.exports = { serve, TYPES };

if (require.main === module) {
  const root = process.argv[2] || path.join(__dirname, '..', '..');
  const port = Number(process.argv[3]) || 8765;
  serve(root, port).then((s) => {
    if (!s) process.exit(1);
    console.log('serving ' + path.resolve(root) + ' on http://127.0.0.1:' + port);
  });
}
