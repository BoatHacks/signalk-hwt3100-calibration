'use strict';

const path = require('path');
const { TraceBuffer } = require('./lib/trace-buffer');
const { AxisMerger } = require('./lib/axis-merger');
const { servePublicFile } = require('./lib/static-files');

const DEFAULT_MAGNETIC_FIELD_PATH = 'sensors.hwt3100.magneticField';
const DEFAULT_MAX_POINTS = 2000;

module.exports = function (app) {
  const plugin = {
    id: 'signalk-hwt3100-calibration',
    name: 'HWT3100 Calibration Visualizer',
    description:
      '2D/3D visualization of magnetic field readings for verifying compass calibration',
  };

  let unsubscribes = [];
  let traceBuffer = null;
  let currentConfig = { magneticFieldPath: DEFAULT_MAGNETIC_FIELD_PATH, maxPoints: DEFAULT_MAX_POINTS };

  plugin.schema = {
    type: 'object',
    properties: {
      magneticFieldPath: {
        type: 'string',
        title: 'Magnetic field SignalK path prefix',
        description:
          "The plugin subscribes to '<prefix>.x', '.y', and '.z'. Matches the HALSER-HWT3100-interface firmware's default output path.",
        default: DEFAULT_MAGNETIC_FIELD_PATH,
      },
      maxPoints: {
        type: 'number',
        title: 'Max trace points kept in memory',
        description:
          'Older points are dropped once this many are buffered (a full rotation typically needs only a few hundred).',
        default: DEFAULT_MAX_POINTS,
      },
    },
  };

  plugin.start = function (options) {
    const magneticFieldPath = options.magneticFieldPath || DEFAULT_MAGNETIC_FIELD_PATH;
    const maxPoints = options.maxPoints || DEFAULT_MAX_POINTS;
    currentConfig = { magneticFieldPath, maxPoints };

    traceBuffer = new TraceBuffer(maxPoints);
    const merger = new AxisMerger();

    for (const axis of ['x', 'y', 'z']) {
      const skPath = `${magneticFieldPath}.${axis}`;
      const stream = app.streambundle.getSelfStream(skPath);
      const unsubscribe = stream.onValue((value) => {
        if (typeof value !== 'number' || Number.isNaN(value)) return;
        const sample = merger.update(axis, value, Date.now());
        if (sample) traceBuffer.push(sample);
      });
      unsubscribes.push(unsubscribe);
    }

    app.debug(
      `HWT3100 Calibration Visualizer: subscribed to ${magneticFieldPath}.{x,y,z}, buffering up to ${maxPoints} points`,
    );
  };

  plugin.stop = function () {
    unsubscribes.forEach((unsubscribe) => unsubscribe());
    unsubscribes = [];
    traceBuffer = null;
  };

  // Serves the visualization webapp and its data feed under this
  // plugin's own router (/plugins/signalk-hwt3100-calibration/*).
  // That's admin-gated in SignalK (see README) -- acceptable here since
  // compass calibration is an installer/setup task, not a value other
  // instruments subscribe to, so there's no anonymous-read requirement
  // the way there would be for a resource provider.
  plugin.registerWithRouter = function (router) {
    // The configured path prefix, so the browser knows what to
    // subscribe to over SignalK's own WebSocket delta stream --
    // app.js connects to /signalk/v1/stream directly for live updates
    // rather than us relaying it (see README "How it works").
    router.get('/config', (req, res) => {
      res.json(currentConfig);
    });
    // One-shot snapshot of whatever this server-side buffer already
    // has (e.g. from before the page was opened), so the page has
    // something to show immediately instead of starting from a blank
    // trace and waiting for new WebSocket updates to trickle in.
    router.get('/points', (req, res) => {
      res.json(traceBuffer ? traceBuffer.toArray() : []);
    });
    const publicDir = path.join(__dirname, 'public');
    router.use('/', (req, res, next) => servePublicFile(publicDir, req, res, next));
  };

  return plugin;
};
