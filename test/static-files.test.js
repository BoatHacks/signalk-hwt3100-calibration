'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { servePublicFile } = require('../lib/static-files');

function makeRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    ended: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
  return res;
}

test('serves index.html for the root path', async (t) => {
  const publicDir = fs.mkdtempSync(path.join(os.tmpdir(), 'static-files-'));
  fs.writeFileSync(path.join(publicDir, 'index.html'), '<html></html>');
  t.after(() => fs.rmSync(publicDir, { recursive: true, force: true }));

  const res = makeRes();
  await new Promise((resolve) => {
    const originalSend = res.send.bind(res);
    res.send = (body) => {
      originalSend(body);
      resolve();
    };
    servePublicFile(publicDir, { path: '/' }, res, () => assert.fail('next() should not be called'));
  });

  assert.equal(res.body.toString(), '<html></html>');
  assert.equal(res.headers['Content-Type'], 'text/html; charset=utf-8');
});

test('calls next() for a missing file instead of erroring', async (t) => {
  const publicDir = fs.mkdtempSync(path.join(os.tmpdir(), 'static-files-'));
  t.after(() => fs.rmSync(publicDir, { recursive: true, force: true }));

  const res = makeRes();
  let nextCalled = false;
  await new Promise((resolve) => {
    servePublicFile(publicDir, { path: '/missing.js' }, res, () => {
      nextCalled = true;
      resolve();
    });
  });

  assert.equal(nextCalled, true);
});

test('rejects a path-traversal attempt with 403, never touching the filesystem outside publicDir', (t) => {
  const publicDir = fs.mkdtempSync(path.join(os.tmpdir(), 'static-files-'));
  t.after(() => fs.rmSync(publicDir, { recursive: true, force: true }));

  const res = makeRes();
  servePublicFile(
    publicDir,
    { path: '/../../etc/passwd' },
    res,
    () => assert.fail('next() should not be called'),
  );

  assert.equal(res.statusCode, 403);
  assert.equal(res.ended, true);
});
