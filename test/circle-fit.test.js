'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// public/circle-fit.js is an ES module (public/package.json sets
// "type": "module"), loaded here via dynamic import from this
// otherwise-CommonJS test file -- no build step needed either way.
const circleFitPromise = import('../public/circle-fit.js');

function pointsOnCircle(cx, cy, r, count) {
  const points = [];
  for (let i = 0; i < count; i++) {
    const angle = (2 * Math.PI * i) / count;
    points.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
  }
  return points;
}

test('returns null for fewer than 3 points', async () => {
  const { fitCircle } = await circleFitPromise;
  assert.equal(fitCircle([]), null);
  assert.equal(fitCircle([{ x: 0, y: 0 }]), null);
  assert.equal(fitCircle([{ x: 0, y: 0 }, { x: 1, y: 1 }]), null);
});

test('returns null for collinear points', async () => {
  const { fitCircle } = await circleFitPromise;
  const points = [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 2, y: 2 },
    { x: 3, y: 3 },
  ];
  assert.equal(fitCircle(points), null);
});

test('exactly recovers a circle centered on the origin', async () => {
  const { fitCircle } = await circleFitPromise;
  const points = pointsOnCircle(0, 0, 50, 12);
  const fit = fitCircle(points);
  assert.ok(fit);
  assert.ok(Math.abs(fit.cx) < 1e-6);
  assert.ok(Math.abs(fit.cy) < 1e-6);
  assert.ok(Math.abs(fit.r - 50) < 1e-6);
});

test('exactly recovers an off-center circle (hard-iron-like offset)', async () => {
  const { fitCircle } = await circleFitPromise;
  const points = pointsOnCircle(30, -15, 80, 16);
  const fit = fitCircle(points);
  assert.ok(fit);
  assert.ok(Math.abs(fit.cx - 30) < 1e-6);
  assert.ok(Math.abs(fit.cy - (-15)) < 1e-6);
  assert.ok(Math.abs(fit.r - 80) < 1e-6);
});

test('approximately fits a noisy near-circular trace', async () => {
  const { fitCircle } = await circleFitPromise;
  // Deterministic pseudo-noise, not Math.random(), so this test is
  // reproducible.
  const noise = [1, -1, 2, -2, 1, -1, 0, 2, -1, 1, -2, 1];
  const points = pointsOnCircle(10, 5, 100, 12).map((p, i) => ({
    x: p.x + noise[i % noise.length],
    y: p.y + noise[(i + 3) % noise.length],
  }));
  const fit = fitCircle(points);
  assert.ok(fit);
  assert.ok(Math.abs(fit.cx - 10) < 5);
  assert.ok(Math.abs(fit.cy - 5) < 5);
  assert.ok(Math.abs(fit.r - 100) < 5);
});
