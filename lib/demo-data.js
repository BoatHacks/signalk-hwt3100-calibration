'use strict';

// Synthetic magnetic-field trace for demo mode: a full rotation traces
// an ellipse (soft-iron distortion) offset from the origin (hard-iron
// offset), with a faster, smaller z wobble to vaguely resemble
// tumbling through 3D orientations. Deliberately not centered on the
// origin / not circular -- a real HWT3100 in this state would need
// calibration, which is the whole point of the visualization.
const DEMO_PERIOD_MS = 15000;
const HARD_IRON_OFFSET = { x: 15, y: -8 };
const SOFT_IRON_RADIUS = { x: 45, y: 32 };
const Z_WOBBLE_AMPLITUDE = 6;
const NOISE_AMPLITUDE = 1;

/**
 * @param {number} elapsedMs - milliseconds since demo mode started
 * @param {() => number} [random] - returns a value in [0, 1); defaults to Math.random. Injectable for deterministic tests.
 * @returns {{x: number, y: number, z: number}}
 */
function generateDemoSample(elapsedMs, random = Math.random) {
  const angle = ((elapsedMs % DEMO_PERIOD_MS) / DEMO_PERIOD_MS) * 2 * Math.PI;
  const noise = () => (random() - 0.5) * 2 * NOISE_AMPLITUDE;
  return {
    x: HARD_IRON_OFFSET.x + SOFT_IRON_RADIUS.x * Math.cos(angle) + noise(),
    y: HARD_IRON_OFFSET.y + SOFT_IRON_RADIUS.y * Math.sin(angle) + noise(),
    z: Z_WOBBLE_AMPLITUDE * Math.sin(angle * 3) + noise(),
  };
}

module.exports = { generateDemoSample, DEMO_PERIOD_MS, HARD_IRON_OFFSET, SOFT_IRON_RADIUS };
