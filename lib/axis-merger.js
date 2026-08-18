'use strict';

/**
 * Merges independently-arriving x/y/z scalar updates (three separate
 * SignalK delta paths, e.g. sensors.hwt3100.magneticField.x/y/z) into a
 * single {x, y, z, t} sample each time any one axis updates -- but only
 * once every axis has been seen at least once.
 *
 * Pure and I/O-free (no `app.*` calls) so it's directly unit testable --
 * see test/axis-merger.test.js. index.js wires this to the three
 * per-axis SignalK subscriptions.
 */
class AxisMerger {
  constructor() {
    this._latest = { x: undefined, y: undefined, z: undefined };
  }

  /**
   * Records a new value for one axis and returns the merged
   * {x, y, z, t} sample if all three axes are now known, or null if
   * this axis is still the only one seen so far.
   *
   * @param {'x'|'y'|'z'} axis
   * @param {number} value
   * @param {number} timestamp epoch milliseconds
   */
  update(axis, value, timestamp) {
    if (axis !== 'x' && axis !== 'y' && axis !== 'z') {
      throw new RangeError(`axis must be 'x', 'y', or 'z', got ${axis}`);
    }
    this._latest[axis] = value;
    const { x, y, z } = this._latest;
    if (x === undefined || y === undefined || z === undefined) {
      return null;
    }
    return { x, y, z, t: timestamp };
  }
}

module.exports = { AxisMerger };
