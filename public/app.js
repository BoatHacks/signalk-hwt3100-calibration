// Renders live from SignalK's own WebSocket delta stream
// (/signalk/v1/stream) rather than polling this plugin's backend --
// the page fetches /config once to learn which path prefix to
// subscribe to (admin-configurable, see index.js's schema), seeds
// itself with whatever this plugin's server-side buffer already has
// via one GET /points call, then subscribes directly for everything
// after that.
//
// 2D gets a reference circle and a best-fit circle overlay (both
// toggleable, see below); a 3D sphere/ellipsoid equivalent is still
// intentionally deferred -- see README "Known limitations / next
// steps".

import * as THREE from 'three';
import { fitCircle } from './circle-fit.js';

// This page can be reached two ways: SignalK's admin-gated
// /plugins/signalk-hwt3100-calibration/ (registerWithRouter in
// index.js, where /config, /points, /firmware-status, and
// /calibration/<action> actually live) and, since package.json
// carries the signalk-webapp keyword, a separate top-level
// /signalk-hwt3100-calibration/ static mount that SignalK's own
// webapp discovery serves independently. The static assets
// (this file, circle-fit.js, three.js) resolve fine relative to
// either -- the browser resolves relative module/fetch specifiers
// against the page's actual URL. The API calls below can't: they
// only exist under the plugin route, so they're absolute.
const API_BASE = '/plugins/signalk-hwt3100-calibration';

const statusEl = document.getElementById('status');
const demoBannerEl = document.getElementById('demo-banner');
const RECONNECT_DELAY_MS = [1000, 2000, 5000, 5000, 5000];

// Mirrors index.js's own debug flag (set via this plugin's config UI,
// not SignalK's server-wide debug mechanism) -- set once /config comes
// back in connect() below. Logging is throttled the same way
// server-side: WS deltas can arrive every ~100ms per axis.
let debugEnabled = false;
const DEBUG_SAMPLE_LOG_INTERVAL_MS = 1000;
let lastDebugSampleLogAt = 0;

function debugLog(...args) {
  if (debugEnabled) {
    console.debug('[hwt3100-calibration]', ...args);
  }
}

// --- Tabs ---

const circleOverlayControls = document.getElementById('circle-overlay-controls');

for (const button of document.querySelectorAll('.tab-button')) {
  button.addEventListener('click', () => {
    for (const b of document.querySelectorAll('.tab-button')) b.classList.remove('active');
    for (const p of document.querySelectorAll('.tab-panel')) p.classList.remove('active');
    button.classList.add('active');
    document.getElementById(button.dataset.tab).classList.add('active');
    // The circle overlays are 2D-only -- hide their controls on the 3D tab.
    circleOverlayControls.style.display = button.dataset.tab === 'tab-2d' ? '' : 'none';
  });
}

// --- 2D view (X vs Y) ---

const canvas2d = document.getElementById('canvas-2d');
const ctx2d = canvas2d.getContext('2d');
const showReferenceCircleCheckbox = document.getElementById('show-reference-circle');
const showBestFitCircleCheckbox = document.getElementById('show-best-fit-circle');

function draw2d(points) {
  const w = canvas2d.width;
  const h = canvas2d.height;
  ctx2d.clearRect(0, 0, w, h);

  if (points.length === 0) return;

  // Auto-scale to fit all buffered points, plus a margin, so the trace
  // is always visible regardless of the module's actual field strength.
  const extent = Math.max(
    1,
    ...points.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y))),
  ) * 1.15;
  const toScreen = (v, axisLength) => (v / extent) * (axisLength / 2) + axisLength / 2;

  // Axes through the origin.
  ctx2d.strokeStyle = '#888';
  ctx2d.lineWidth = 1;
  ctx2d.beginPath();
  ctx2d.moveTo(0, toScreen(0, h));
  ctx2d.lineTo(w, toScreen(0, h));
  ctx2d.moveTo(toScreen(0, w), 0);
  ctx2d.lineTo(toScreen(0, w), h);
  ctx2d.stroke();

  // Trace, oldest to newest, fading in.
  ctx2d.lineWidth = 2;
  for (let i = 1; i < points.length; i++) {
    const alpha = 0.15 + 0.85 * (i / points.length);
    ctx2d.strokeStyle = `rgba(37, 99, 235, ${alpha})`;
    ctx2d.beginPath();
    ctx2d.moveTo(toScreen(points[i - 1].x, w), toScreen(-points[i - 1].y, h));
    ctx2d.lineTo(toScreen(points[i].x, w), toScreen(-points[i].y, h));
    ctx2d.stroke();
  }

  // Radii/distances in data units scale uniformly to screen units,
  // same factor for both axes (the canvas is square and toScreen()
  // above already uses one shared `extent` for both x and y).
  const toScreenRadius = (r) => (r / extent) * (w / 2);

  // Reference circle: centered on the origin, radius = the mean
  // distance of the buffered points from the origin. If calibration
  // were perfect (no hard-iron offset, no soft-iron distortion), the
  // trace should sit right on this circle -- so comparing it against
  // the best-fit circle below (which can be off-center) is a quick
  // visual read on calibration quality.
  if (showReferenceCircleCheckbox.checked) {
    const meanRadius =
      points.reduce((sum, p) => sum + Math.hypot(p.x, p.y), 0) / points.length;
    ctx2d.strokeStyle = 'rgba(22, 163, 74, 0.6)';
    ctx2d.lineWidth = 1;
    ctx2d.setLineDash([]);
    ctx2d.beginPath();
    ctx2d.arc(toScreen(0, w), toScreen(0, h), toScreenRadius(meanRadius), 0, 2 * Math.PI);
    ctx2d.stroke();
  }

  // Best-fit circle: the actual least-squares circle through the
  // buffered points (circle-fit.js) -- its center
  // offset from the origin is roughly the hard-iron offset; its
  // radius vs. the reference circle's is roughly the soft-iron scale
  // error. Dotted specifically so it reads as "fitted to the data,"
  // distinct from the reference circle's solid line.
  if (showBestFitCircleCheckbox.checked) {
    const fit = fitCircle(points);
    if (fit) {
      ctx2d.strokeStyle = 'rgba(234, 88, 12, 0.85)';
      ctx2d.lineWidth = 1.5;
      ctx2d.setLineDash([4, 4]);
      ctx2d.beginPath();
      ctx2d.arc(toScreen(fit.cx, w), toScreen(-fit.cy, h), toScreenRadius(fit.r), 0, 2 * Math.PI);
      ctx2d.stroke();
      ctx2d.setLineDash([]);
    }
  }

  // Most recent reading, highlighted.
  const last = points[points.length - 1];
  ctx2d.fillStyle = '#2563eb';
  ctx2d.beginPath();
  ctx2d.arc(toScreen(last.x, w), toScreen(-last.y, h), 4, 0, 2 * Math.PI);
  ctx2d.fill();
}

// --- 3D view ---

const container3d = document.getElementById('canvas-3d-container');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 10000);
camera.position.set(0, 0, 400);
const renderer = new THREE.WebGLRenderer({ antialias: true });
container3d.appendChild(renderer.domElement);

const axesHelper = new THREE.AxesHelper(200);
scene.add(axesHelper);

const pointsGroup = new THREE.Group();
scene.add(pointsGroup);

let pointsMesh = null;

function draw3d(points) {
  if (pointsMesh) {
    pointsGroup.remove(pointsMesh);
    pointsMesh.geometry.dispose();
    pointsMesh.material.dispose();
  }
  if (points.length === 0) return;

  const positions = new Float32Array(points.length * 3);
  points.forEach((p, i) => {
    positions[i * 3] = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = p.z;
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: 0x2563eb, size: 4 });
  pointsMesh = new THREE.Points(geometry, material);
  pointsGroup.add(pointsMesh);
}

function resizeRendererToDisplaySize() {
  const size = container3d.clientWidth;
  if (renderer.getSize(new THREE.Vector2()).width !== size) {
    renderer.setSize(size, size);
    camera.aspect = 1;
    camera.updateProjectionMatrix();
  }
}

// --- Render loop ---
//
// Runs continuously regardless of how points arrive (WS pushes update
// `points` in place; this loop just redraws from whatever's currently
// buffered) -- decouples "how often data arrives" from "how often we
// redraw," and gives the 3D view its auto-rotate animation for free.

let points = [];
let maxPoints = 2000;

// Live-configurable from the page itself (independent of index.js's
// `maxPoints` schema option, which only bounds the server-side seed
// buffer) -- lets you shrink the window to just the last few seconds
// while actively rotating, or grow it to review a whole pass, without
// touching the plugin config or reloading the page.
const maxPointsInput = document.getElementById('max-points');
const maxPointsValueEl = document.getElementById('max-points-value');

function setMaxPoints(value) {
  maxPoints = Math.max(1, Math.round(value));
  maxPointsInput.value = String(maxPoints);
  maxPointsValueEl.textContent = String(maxPoints);
  if (points.length > maxPoints) points = points.slice(points.length - maxPoints);
}

maxPointsInput.addEventListener('input', () => {
  setMaxPoints(maxPointsInput.valueAsNumber);
  debugLog(`max points changed to ${maxPoints}`);
});

function renderFrame() {
  requestAnimationFrame(renderFrame);
  resizeRendererToDisplaySize();
  draw2d(points);
  draw3d(points);
  // TODO: replace with drag-to-orbit (three/examples/jsm/controls/OrbitControls.js)
  // once this is more than a kickoff.
  pointsGroup.rotation.y += 0.003;
  renderer.render(scene, camera);
}
requestAnimationFrame(renderFrame);

// --- Live data via SignalK's WebSocket delta stream ---

function pushSample(sample) {
  points.push(sample);
  if (points.length > maxPoints) points.shift();
}

/** Merges independently-arriving x/y/z delta updates into one sample per change, once all three axes are known at least once. */
function makeAxisMerger() {
  const latest = { x: undefined, y: undefined, z: undefined };
  return function update(axis, value, t) {
    latest[axis] = value;
    const { x, y, z } = latest;
    if (x === undefined || y === undefined || z === undefined) return null;
    return { x, y, z, t };
  };
}

async function connect() {
  let magneticFieldPath = 'sensors.hwt3100.magneticField';
  try {
    const configRes = await fetch(`${API_BASE}/config`);
    if (configRes.ok) {
      const config = await configRes.json();
      debugEnabled = Boolean(config.debug);
      magneticFieldPath = config.magneticFieldPath || magneticFieldPath;
      if (config.maxPoints) setMaxPoints(config.maxPoints);
      demoBannerEl.hidden = !config.demoMode;
      debugLog('loaded config', config);
    }
  } catch (err) {
    // Fall back to the default path above -- the WebSocket
    // subscription below still needs *a* path, and it matches
    // index.js's schema default, so this is a reasonable guess if
    // /config is briefly unreachable. The trace-length slider keeps
    // its own default in that case too.
    debugLog('GET /config failed, using defaults:', err.message);
  }

  try {
    const pointsRes = await fetch(`${API_BASE}/points`);
    if (pointsRes.ok) {
      points = await pointsRes.json();
      if (points.length > maxPoints) points = points.slice(points.length - maxPoints);
      debugLog(`seeded ${points.length} point(s) from /points`);
    }
  } catch (err) {
    // Non-fatal -- just starts with an empty trace instead of
    // whatever this plugin's server-side buffer already had.
    debugLog('GET /points failed, starting empty:', err.message);
  }

  const axisPaths = {
    [`${magneticFieldPath}.x`]: 'x',
    [`${magneticFieldPath}.y`]: 'y',
    [`${magneticFieldPath}.z`]: 'z',
  };
  const mergeAxis = makeAxisMerger();

  let reconnectAttempt = 0;

  function open() {
    const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${location.host}/signalk/v1/stream?subscribe=none`;
    debugLog(`opening WebSocket to ${wsUrl}`);
    const ws = new WebSocket(wsUrl);

    ws.addEventListener('open', () => {
      reconnectAttempt = 0;
      const subscribe = Object.keys(axisPaths).map((path) => ({ path, period: 100 }));
      debugLog('WebSocket open, subscribing to', subscribe);
      ws.send(
        JSON.stringify({
          context: 'vessels.self',
          subscribe,
        }),
      );
      statusEl.textContent = `live (${points.length} point(s) buffered)`;
    });

    ws.addEventListener('message', (event) => {
      let delta;
      try {
        delta = JSON.parse(event.data);
      } catch {
        return;
      }
      for (const update of delta.updates || []) {
        for (const { path, value } of update.values || []) {
          const axis = axisPaths[path];
          if (!axis || typeof value !== 'number' || Number.isNaN(value)) continue;
          const sample = mergeAxis(axis, value, Date.now());
          if (sample) {
            pushSample(sample);
            const now = Date.now();
            if (now - lastDebugSampleLogAt >= DEBUG_SAMPLE_LOG_INTERVAL_MS) {
              lastDebugSampleLogAt = now;
              debugLog(
                `merged sample x=${sample.x} y=${sample.y} z=${sample.z} (${points.length} point(s) buffered)`,
              );
            }
          }
        }
      }
      statusEl.textContent = `live (${points.length} point(s) buffered)`;
    });

    ws.addEventListener('close', () => {
      debugLog('WebSocket closed');
      scheduleReconnect();
    });
    ws.addEventListener('error', (event) => {
      debugLog('WebSocket error', event);
      ws.close();
    });
  }

  function scheduleReconnect() {
    const delay = RECONNECT_DELAY_MS[Math.min(reconnectAttempt, RECONNECT_DELAY_MS.length - 1)];
    reconnectAttempt += 1;
    debugLog(`reconnecting in ${delay}ms (attempt ${reconnectAttempt})`);
    statusEl.textContent = `disconnected, retrying in ${delay / 1000}s…`;
    setTimeout(open, delay);
  }

  open();
}

connect();

// --- HALSER firmware calibration controls ---
//
// These call this plugin's own /calibration/<action> and
// /firmware-status endpoints (index.js), which proxy to the
// HALSER-HWT3100-interface firmware's own HTTP server -- the browser
// can't call the firmware directly (see index.js's registerWithRouter
// for why: no CORS headers, and its own same-origin check would
// reject it anyway).

const FIRMWARE_STATUS_POLL_MS = 5000;

const calButtons = {
  start: document.getElementById('cal-start'),
  stop: document.getElementById('cal-stop'),
  clear: document.getElementById('cal-clear'),
};
const calibrationResultEl = document.getElementById('calibration-result');
const firmwareStatusEl = document.getElementById('firmware-status');

let firmwareConfigured = false;
let firmwareReachable = false;

function setCalButtonsEnabled(enabled) {
  for (const button of Object.values(calButtons)) button.disabled = !enabled;
}

async function checkFirmwareStatus() {
  try {
    const res = await fetch(`${API_BASE}/firmware-status`);
    const data = await res.json();
    firmwareConfigured = Boolean(data.configured);
    firmwareReachable = Boolean(data.reachable);
    debugLog('firmware status ->', data);

    if (!firmwareConfigured) {
      firmwareStatusEl.textContent =
        "HALSER firmware URL not configured — set it in this plugin's settings to enable calibration controls.";
    } else if (!firmwareReachable) {
      firmwareStatusEl.textContent =
        'HALSER firmware is unreachable — check its power and network connection.';
    } else {
      firmwareStatusEl.textContent = 'HALSER firmware connected.';
    }
  } catch (err) {
    firmwareConfigured = false;
    firmwareReachable = false;
    firmwareStatusEl.textContent = `Could not check HALSER firmware status: ${err.message}`;
    debugLog('GET /firmware-status failed:', err.message);
  } finally {
    setCalButtonsEnabled(firmwareConfigured && firmwareReachable);
    setTimeout(checkFirmwareStatus, FIRMWARE_STATUS_POLL_MS);
  }
}
checkFirmwareStatus();

for (const [action, button] of Object.entries(calButtons)) {
  button.addEventListener('click', async () => {
    setCalButtonsEnabled(false);
    calibrationResultEl.textContent = `${button.textContent}: sending…`;
    debugLog(`POST /calibration/${action}`);
    try {
      const res = await fetch(`${API_BASE}/calibration/${action}`, { method: 'POST' });
      const data = await res.json();
      debugLog(`  -> ${action} response`, data);
      calibrationResultEl.textContent = data.ok
        ? `${button.textContent}: ${data.body}`
        : `${button.textContent} failed: ${data.error || data.body || res.statusText}`;
    } catch (err) {
      debugLog(`  -> ${action} request failed:`, err.message);
      calibrationResultEl.textContent = `${button.textContent} failed: ${err.message}`;
    } finally {
      // Re-enable based on the last-known firmware reachability
      // rather than unconditionally -- this click's outcome doesn't
      // tell us whether the firmware is still reachable right now.
      setCalButtonsEnabled(firmwareConfigured && firmwareReachable);
    }
  });
}
