'use strict';

const path = require('path');
const { TraceBuffer } = require('./lib/trace-buffer');
const { AxisMerger } = require('./lib/axis-merger');
const { servePublicFile } = require('./lib/static-files');
const {
  normalizeFirmwareUrl,
  buildButtonListUrl,
  buildCalibrationButtonUrl,
} = require('./lib/firmware-client');

const DEFAULT_MAGNETIC_FIELD_PATH = 'sensors.hwt3100.magneticField';
const DEFAULT_MAX_POINTS = 2000;
const FIRMWARE_REQUEST_TIMEOUT_MS = 3000;

module.exports = function (app) {
  const plugin = {
    id: 'signalk-hwt3100-calibration',
    name: 'HWT3100 Calibration Visualizer',
    description:
      '2D/3D visualization of magnetic field readings for verifying compass calibration',
  };

  let unsubscribes = [];
  let traceBuffer = null;
  let currentConfig = {
    magneticFieldPath: DEFAULT_MAGNETIC_FIELD_PATH,
    maxPoints: DEFAULT_MAX_POINTS,
    firmwareConfigured: false,
  };
  let firmwareUrl = '';

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
      firmwareUrl: {
        type: 'string',
        title: 'HALSER-HWT3100-interface firmware URL',
        description:
          "Base URL of the HWT3100 firmware's own web server (NOT the SignalK server) -- e.g. http://halser-hwt3100.local or http://192.168.1.50. Used to call its Start/Stop/Clear Calibration buttons. Leave blank to hide the calibration controls.",
        default: '',
      },
    },
  };

  plugin.start = function (options) {
    const magneticFieldPath = options.magneticFieldPath || DEFAULT_MAGNETIC_FIELD_PATH;
    const maxPoints = options.maxPoints || DEFAULT_MAX_POINTS;
    firmwareUrl = normalizeFirmwareUrl(options.firmwareUrl);
    currentConfig = { magneticFieldPath, maxPoints, firmwareConfigured: firmwareUrl !== '' };

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
    firmwareUrl = '';
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

    // Whether the HALSER-HWT3100-interface firmware's own HTTP server
    // (a separate device on the LAN -- see the firmwareUrl schema
    // option) is currently reachable, so the browser can dim the
    // calibration buttons and explain why rather than let clicks fail
    // silently. Uses the firmware's own GET /api/buttons (its UIButton
    // registry listing) purely as a lightweight liveness check.
    router.get('/firmware-status', async (req, res) => {
      if (!firmwareUrl) {
        res.json({ configured: false, reachable: false });
        return;
      }
      try {
        const response = await fetch(buildButtonListUrl(firmwareUrl), {
          signal: AbortSignal.timeout(FIRMWARE_REQUEST_TIMEOUT_MS),
        });
        res.json({ configured: true, reachable: response.ok });
      } catch (err) {
        res.json({ configured: true, reachable: false, error: err.message });
      }
    });

    // Proxies a calibration button click to the firmware's own
    // POST /api/buttons/<name>. This goes through our backend rather
    // than having the browser call the firmware directly: the
    // firmware's SensESP-based web server does its own origin check
    // on POSTs (rejecting genuinely cross-origin requests) and sends
    // no CORS headers either, so a browser-to-firmware fetch() from
    // this plugin's page would fail regardless. Server-to-server HTTP
    // has neither restriction.
    router.post('/calibration/:action', async (req, res) => {
      if (!firmwareUrl) {
        res.status(503).json({ ok: false, error: 'firmwareUrl is not configured' });
        return;
      }
      let url;
      try {
        url = buildCalibrationButtonUrl(firmwareUrl, req.params.action);
      } catch (err) {
        res.status(400).json({ ok: false, error: err.message });
        return;
      }
      try {
        const response = await fetch(url, {
          method: 'POST',
          signal: AbortSignal.timeout(FIRMWARE_REQUEST_TIMEOUT_MS),
        });
        const body = await response.text();
        res.status(response.ok ? 200 : 502).json({ ok: response.ok, status: response.status, body });
      } catch (err) {
        res.status(502).json({ ok: false, error: err.message });
      }
    });

    const publicDir = path.join(__dirname, 'public');
    router.use('/', (req, res, next) => servePublicFile(publicDir, req, res, next));
  };

  return plugin;
};
