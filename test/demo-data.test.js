'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { generateDemoSample, DEMO_PERIOD_MS, HARD_IRON_OFFSET, SOFT_IRON_RADIUS } = require('../lib/demo-data');

// Deterministic "random" (always returns 0.5, i.e. noise() == 0) so
// assertions can pin exact values instead of just ranges.
const noRandom = () => 0.5;

test('traces an ellipse offset by the hard-iron constant, with no noise', () => {
  const quarter = DEMO_PERIOD_MS / 4;
  const start = generateDemoSample(0, noRandom);
  const atQuarter = generateDemoSample(quarter, noRandom);

  assert.ok(Math.abs(start.x - (HARD_IRON_OFFSET.x + SOFT_IRON_RADIUS.x)) < 1e-9);
  assert.ok(Math.abs(start.y - HARD_IRON_OFFSET.y) < 1e-9);

  assert.ok(Math.abs(atQuarter.x - HARD_IRON_OFFSET.x) < 1e-9);
  assert.ok(Math.abs(atQuarter.y - (HARD_IRON_OFFSET.y + SOFT_IRON_RADIUS.y)) < 1e-9);
});

test('is periodic: elapsed time and elapsed time + one period produce the same sample', () => {
  const a = generateDemoSample(1234, noRandom);
  const b = generateDemoSample(1234 + DEMO_PERIOD_MS, noRandom);
  assert.deepEqual(a, b);
});

test('noise perturbs each axis within +/-1 of the noiseless value', () => {
  const base = generateDemoSample(5000, noRandom);
  for (let i = 0; i < 20; i++) {
    const sample = generateDemoSample(5000, Math.random);
    assert.ok(Math.abs(sample.x - base.x) <= 1);
    assert.ok(Math.abs(sample.y - base.y) <= 1);
    assert.ok(Math.abs(sample.z - base.z) <= 1);
  }
});
