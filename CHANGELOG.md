# Changelog

All notable changes to this project are documented in this file, in the
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.

## [Unreleased]

### Fixed

- The page now shows up in the SignalK admin UI's Webapps list
  (`signalk-webapp` keyword added to `package.json`). It's served from
  a second, top-level mount independent of the plugin's own admin-gated
  route; `app.js`'s data calls now use absolute paths so they keep
  working regardless of which URL served the page. See the README's
  "Two ways to reach the same page".

## [0.2.0] - 2026-08-19

First release. `0.1.0` was scaffolded but never published.

### Added

- 2D canvas trace (X vs Y) and 3D point-cloud view (three.js, vendored
  locally rather than loaded from a CDN so the page keeps working with
  no internet access) of magnetic field readings, for visually
  verifying compass calibration quality.
- Live updates via a direct subscription to SignalK's own WebSocket
  delta stream, seeded from a one-shot snapshot on page load.
- A live, page-side control for how many points are kept in view.
- Toggleable 2D overlays: a solid reference circle (mean distance from
  the origin) and a dotted best-fit circle (least-squares fit), to
  make hard-iron/soft-iron issues easier to spot at a glance.
- Start / Stop / Clear Calibration buttons that call the
  HALSER-HWT3100-interface firmware's own HTTP control endpoints
  directly (via this plugin's backend, to avoid a CORS/same-origin
  dead end) and display what the firmware returns. Dimmed, with an
  explanatory status message, whenever the firmware isn't configured
  or isn't currently reachable.

### Known limitations

See the README's "Known limitations / next steps" section — most
notably: not yet tested against a real SignalK server or real
hardware, no 3D fit overlay yet, and the calibration buttons surface
the firmware's raw click acknowledgment rather than the HWT3100
module's actual calibration reply text.
