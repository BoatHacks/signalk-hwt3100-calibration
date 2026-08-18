# signalk-hwt3100-calibration

A [SignalK](https://signalk.org) server plugin that visualizes raw
magnetic field readings (2D and 3D) to help verify compass calibration
quality — pair a compatible source device's `<prefix>.x/.y/.z` deltas
(default `sensors.hwt3100.magneticField.x/y/z`, as published by
[BoatHacks/HALSER-HWT3100-interface](https://github.com/BoatHacks/HALSER-HWT3100-interface))
with this plugin's web page.

**Status: early kickoff.** The core loop (subscribe → buffer → serve →
render) works, but this hasn't been run against a real SignalK server
or real hardware yet. Expect rough edges.

## Why

Rotating a magnetometer through a full circle (or, for a 3-axis sensor,
tumbling it through all orientations) traces out a shape in the raw
X/Y/Z reading space:

- A **well-calibrated** sensor traces a circle (2D) or sphere (3D)
  centered on the origin.
- An **offset** center indicates hard-iron interference (a nearby
  fixed magnetic source).
- A **non-circular/non-spherical** (ellipse/ellipsoid) trace indicates
  soft-iron interference (nearby ferrous material distorting the
  field).

Seeing the actual trace, rather than trusting a calibration
routine's own "success" report, is a standard way to sanity-check
compass calibration by eye.

## How it works

- The plugin subscribes server-side to `<magneticFieldPath>.x/.y/.z`
  (configurable; SignalK's usual master-toggle/instance conventions
  apply upstream, on the source device) and keeps the most recent
  `maxPoints` readings in a ring buffer (`lib/trace-buffer.js`). This
  is purely so a freshly opened page has something to show
  immediately — see below.
- It serves a small web page under its own plugin route
  (`/plugins/signalk-hwt3100-calibration/`). On load, the page fetches
  `/config` (to learn the configured path prefix) and `/points` (a
  one-shot snapshot of the server-side buffer above), then connects
  directly to SignalK's own WebSocket delta stream
  (`/signalk/v1/stream`) and subscribes to `<magneticFieldPath>.x/.y/.z`
  itself for everything after that — the plugin backend doesn't relay
  live updates. It renders:
  - a 2D canvas trace (X vs Y, with a fading trail and the most recent
    point highlighted), and
  - a 3D point cloud (via [three.js](https://threejs.org/), vendored
    locally under `public/vendor/three/` rather than loaded from a
    CDN — this needs to keep working with no internet access, e.g.
    offshore with the SignalK server as the only thing on the LAN),
    auto-rotating.
  - A slider on the page lets you change how many points are kept in
    view live (independent of the plugin's own `maxPoints` config,
    which only bounds the server-side seed buffer) — shrink it while
    actively rotating to watch just the last few seconds, or grow it
    to review a whole pass, with no reload needed.
- If the WebSocket drops, the page retries with a short backoff and
  shows connection status in the footer.

Note: `/plugins/<id>/*` routes require an admin-authenticated session
on the SignalK server. That's intentional here — calibration is an
installer/setup task, not a value other instruments need to read, so
there's no anonymous-read requirement the way there would be for
runtime sensor data.

## Configuration

Set from the SignalK admin UI's plugin config page:

| Option | Default | Description |
|---|---|---|
| `magneticFieldPath` | `sensors.hwt3100.magneticField` | Path prefix; the plugin subscribes to `<prefix>.x`, `.y`, `.z`. |
| `maxPoints` | `2000` | How many recent readings to keep buffered. A full rotation typically only needs a few hundred. |

## Known limitations / next steps

- No best-fit circle/ellipse (2D) or sphere/ellipsoid (3D) overlay yet
  — right now it's just the raw trace, and judging "is this circular"
  is still up to the viewer's eye.
- No calibration-offset computation/export — this plugin only
  visualizes; it doesn't (yet) compute or apply a correction.
- Not yet tested against a real SignalK server or real hardware.

## Development

```bash
npm install
npm test
```

Pure logic (buffering, per-axis merge, the static-file guard) lives in
`lib/` and is unit tested directly with `node:test`; `index.js` is the
thin layer that wires that logic to the SignalK plugin lifecycle
(`app.streambundle`, `registerWithRouter`).

## License

MIT
