'use strict';

// Pure URL-building/validation for talking to the HALSER-HWT3100-interface
// firmware's *own* HTTP server (a separate device on the LAN, not the
// SignalK server) -- kept separate from index.js's actual fetch() calls
// so it's directly unit testable. See index.js for why this goes
// through our own backend rather than the browser calling the
// firmware directly (CORS + the firmware's own same-origin check).

// Matches the three sensesp::UIButton names registered in the
// firmware's src/gateway.cpp (BoatHacks/HALSER-HWT3100-interface).
// The "1_"/"2_"/"3_" prefixes there exist only to force display order
// on the firmware's own Control tab (UIButton's registry is a
// std::map keyed by name) -- irrelevant here, but the names
// themselves have to match exactly since they're the actual
// registered button IDs.
const CALIBRATION_ACTIONS = {
  start: 'hwt3100_calibration_1_start',
  stop: 'hwt3100_calibration_2_stop',
  clear: 'hwt3100_calibration_3_clear',
};

/** Trims and strips any trailing slash(es); '' for a blank/missing input. */
function normalizeFirmwareUrl(url) {
  if (typeof url !== 'string') return '';
  return url.trim().replace(/\/+$/, '');
}

/**
 * The firmware's own `GET /api/buttons` endpoint (SensESP's UIButton
 * registry listing) -- used both to list/verify buttons exist and,
 * more simply, as a lightweight reachability check.
 *
 * @param {string} firmwareUrl already-normalized (see normalizeFirmwareUrl)
 * @returns {string}
 */
function buildButtonListUrl(firmwareUrl) {
  if (!firmwareUrl) throw new Error('firmwareUrl is not configured');
  return `${firmwareUrl}/api/buttons`;
}

/**
 * The firmware's `POST /api/buttons/<name>` endpoint for one of the
 * three calibration actions.
 *
 * @param {string} firmwareUrl already-normalized (see normalizeFirmwareUrl)
 * @param {'start'|'stop'|'clear'} action
 * @returns {string}
 */
function buildCalibrationButtonUrl(firmwareUrl, action) {
  if (!firmwareUrl) throw new Error('firmwareUrl is not configured');
  const buttonName = CALIBRATION_ACTIONS[action];
  if (!buttonName) {
    throw new RangeError(`Unknown calibration action '${action}', expected one of: ${Object.keys(CALIBRATION_ACTIONS).join(', ')}`);
  }
  return `${firmwareUrl}/api/buttons/${buttonName}`;
}

module.exports = { CALIBRATION_ACTIONS, normalizeFirmwareUrl, buildButtonListUrl, buildCalibrationButtonUrl };
