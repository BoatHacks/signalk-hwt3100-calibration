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
  `maxPoints` readings in a ring buffer (`lib/trace-buffer.js`).
- It serves a small web page under its own plugin route
  (`/plugins/signalk-hwt3100-calibration/`) that polls a JSON endpoint
  (`/points`) and renders:
  - a 2D canvas trace (X vs Y, with a fading trail and the most recent
    point highlighted), and
  - a 3D point cloud (via [three.js](https://threejs.org/), loaded
    from a CDN), auto-rotating.

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

- The web page polls `/points` on an interval rather than subscribing
  to SignalK's own WebSocket delta stream directly — simpler to stand
  up first, but a live subscription would be more efficient and lower
  latency.
- three.js is loaded from a CDN (`unpkg.com`) rather than vendored
  into the package, so the 3D view needs the browser to have internet
  access. Fine for a laptop ashore; not fine standalone on a boat with
  no shore WiFi. Vendoring it locally is a natural follow-up.
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
