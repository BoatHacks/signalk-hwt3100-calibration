'use strict';

const fs = require('fs');
const path = require('path');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

/**
 * Serves one file out of `publicDir` by request path, with no runtime
 * dependency on express.static. Deliberately allowlist-based rather
 * than a general directory server: `req.path` is resolved against
 * `publicDir` and then re-checked to still be inside it, so this can't
 * be tricked into reading files elsewhere on disk (e.g. via `..`
 * segments or an absolute path).
 */
function servePublicFile(publicDir, req, res, next) {
  const requestPath = req.path === '/' ? '/index.html' : req.path;
  const resolved = path.join(publicDir, requestPath);
  const relative = path.relative(publicDir, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    res.status(403).end();
    return;
  }

  fs.readFile(resolved, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') return next();
      res.status(500).end();
      return;
    }
    const contentType = CONTENT_TYPES[path.extname(resolved)] || 'application/octet-stream';
    res.set('Content-Type', contentType).send(data);
  });
}

module.exports = { servePublicFile };
