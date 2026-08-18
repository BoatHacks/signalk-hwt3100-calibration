'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { AxisMerger } = require('../lib/axis-merger');

test('returns null until all three axes have been seen', () => {
  const merger = new AxisMerger();
  assert.equal(merger.update('x', 1, 100), null);
  assert.equal(merger.update('y', 2, 101), null);
});

test('emits a merged sample once the third axis arrives', () => {
  const merger = new AxisMerger();
  merger.update('x', 1, 100);
  merger.update('y', 2, 101);
  const sample = merger.update('z', 3, 102);
  assert.deepEqual(sample, { x: 1, y: 2, z: 3, t: 102 });
});

test('subsequent single-axis updates re-emit using the latest known values', () => {
  const merger = new AxisMerger();
  merger.update('x', 1, 100);
  merger.update('y', 2, 101);
  merger.update('z', 3, 102);
  const sample = merger.update('x', 10, 200);
  assert.deepEqual(sample, { x: 10, y: 2, z: 3, t: 200 });
});

test('rejects an unknown axis', () => {
  const merger = new AxisMerger();
  assert.throws(() => merger.update('w', 1, 100), RangeError);
});
