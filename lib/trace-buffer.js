'use strict';

/**
 * Fixed-capacity ring buffer of {x, y, z, t} magnetic field samples.
 *
 * Pure and I/O-free on purpose (no `app.*` calls) so it can be unit
 * tested directly -- see test/trace-buffer.test.js. index.js is the
 * only place that wires this up to SignalK's stream bundle.
 */
class TraceBuffer {
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError('capacity must be a positive integer');
    }
    this.capacity = capacity;
    this._samples = [];
  }

  /** Records one sample, evicting the oldest if at capacity. */
  push(sample) {
    this._samples.push(sample);
    if (this._samples.length > this.capacity) {
      this._samples.shift();
    }
  }

  /** Returns a snapshot array of the currently buffered samples, oldest first. */
  toArray() {
    return this._samples.slice();
  }

  get size() {
    return this._samples.length;
  }

  clear() {
    this._samples.length = 0;
  }
}

module.exports = { TraceBuffer };
