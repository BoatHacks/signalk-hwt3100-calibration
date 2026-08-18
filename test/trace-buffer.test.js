'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TraceBuffer } = require('../lib/trace-buffer');

test('starts empty', () => {
  const buf = new TraceBuffer(3);
  assert.equal(buf.size, 0);
  assert.deepEqual(buf.toArray(), []);
});

test('accumulates samples in insertion order', () => {
  const buf = new TraceBuffer(3);
  buf.push({ x: 1 });
  buf.push({ x: 2 });
  assert.deepEqual(buf.toArray(), [{ x: 1 }, { x: 2 }]);
});

test('evicts the oldest sample once at capacity', () => {
  const buf = new TraceBuffer(2);
  buf.push({ x: 1 });
  buf.push({ x: 2 });
  buf.push({ x: 3 });
  assert.deepEqual(buf.toArray(), [{ x: 2 }, { x: 3 }]);
  assert.equal(buf.size, 2);
});

test('clear() empties the buffer', () => {
  const buf = new TraceBuffer(2);
  buf.push({ x: 1 });
  buf.clear();
  assert.equal(buf.size, 0);
});

test('toArray() returns a snapshot, not a live view', () => {
  const buf = new TraceBuffer(2);
  buf.push({ x: 1 });
  const snapshot = buf.toArray();
  buf.push({ x: 2 });
  assert.deepEqual(snapshot, [{ x: 1 }]);
});

test('rejects a non-positive-integer capacity', () => {
  assert.throws(() => new TraceBuffer(0), RangeError);
  assert.throws(() => new TraceBuffer(-1), RangeError);
  assert.throws(() => new TraceBuffer(1.5), RangeError);
});
