// Kickoff-quality visualization: polls this plugin's own /points
// endpoint (populated server-side from sensors.hwt3100.magneticField.x/y/z,
// see index.js) and renders it two ways. Not yet using SignalK's
// WebSocket delta stream directly -- polling was simpler to stand up
// first; switching to a live subscription is a natural follow-up.

import * as THREE from 'three';

const POLL_INTERVAL_MS = 250;
const statusEl = document.getElementById('status');

// --- Tabs ---

for (const button of document.querySelectorAll('.tab-button')) {
  button.addEventListener('click', () => {
    for (const b of document.querySelectorAll('.tab-button')) b.classList.remove('active');
    for (const p of document.querySelectorAll('.tab-panel')) p.classList.remove('active');
    button.classList.add('active');
    document.getElementById(button.dataset.tab).classList.add('active');
  });
}

// --- 2D view (X vs Y) ---

const canvas2d = document.getElementById('canvas-2d');
const ctx2d = canvas2d.getContext('2d');

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

function animate() {
  requestAnimationFrame(animate);
  resizeRendererToDisplaySize();
  // Slow auto-rotate for now -- TODO: replace with drag-to-orbit
  // (three/examples/jsm/controls/OrbitControls.js) once this is more
  // than a kickoff.
  pointsGroup.rotation.y += 0.003;
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);

// --- Data polling ---

async function poll() {
  try {
    const res = await fetch('./points');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const points = await res.json();
    draw2d(points);
    draw3d(points);
    statusEl.textContent = `${points.length} point(s) buffered`;
  } catch (err) {
    statusEl.textContent = `Error fetching points: ${err.message}`;
  } finally {
    setTimeout(poll, POLL_INTERVAL_MS);
  }
}
poll();
