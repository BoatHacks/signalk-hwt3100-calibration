'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CALIBRATION_ACTIONS,
  normalizeFirmwareUrl,
  buildButtonListUrl,
  buildCalibrationButtonUrl,
} = require('../lib/firmware-client');

test('normalizeFirmwareUrl trims whitespace and a trailing slash', () => {
  assert.equal(normalizeFirmwareUrl('  http://halser-hwt3100.local/  '), 'http://halser-hwt3100.local');
  assert.equal(normalizeFirmwareUrl('http://192.168.1.50///'), 'http://192.168.1.50');
});

test('normalizeFirmwareUrl returns empty string for missing/blank input', () => {
  assert.equal(normalizeFirmwareUrl(undefined), '');
  assert.equal(normalizeFirmwareUrl(''), '');
  assert.equal(normalizeFirmwareUrl('   '), '');
});

test('buildButtonListUrl appends /api/buttons', () => {
  assert.equal(
    buildButtonListUrl('http://halser-hwt3100.local'),
    'http://halser-hwt3100.local/api/buttons',
  );
});

test('buildButtonListUrl rejects an unconfigured (empty) firmwareUrl', () => {
  assert.throws(() => buildButtonListUrl(''), /not configured/);
});

test('buildCalibrationButtonUrl maps each action to its actual firmware button name', () => {
  assert.equal(
    buildCalibrationButtonUrl('http://halser-hwt3100.local', 'start'),
    `http://halser-hwt3100.local/api/buttons/${CALIBRATION_ACTIONS.start}`,
  );
  assert.equal(
    buildCalibrationButtonUrl('http://halser-hwt3100.local', 'stop'),
    `http://halser-hwt3100.local/api/buttons/${CALIBRATION_ACTIONS.stop}`,
  );
  assert.equal(
    buildCalibrationButtonUrl('http://halser-hwt3100.local', 'clear'),
    `http://halser-hwt3100.local/api/buttons/${CALIBRATION_ACTIONS.clear}`,
  );
});

test('buildCalibrationButtonUrl rejects an unknown action', () => {
  assert.throws(() => buildCalibrationButtonUrl('http://halser-hwt3100.local', 'reset'), RangeError);
});

test('buildCalibrationButtonUrl rejects an unconfigured (empty) firmwareUrl', () => {
  assert.throws(() => buildCalibrationButtonUrl('', 'start'), /not configured/);
});
