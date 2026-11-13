// Run with Node 24: node --test tests/gestures.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MAX_GESTURES_PER_POLL,
  countNewGestures,
  processSideGestures,
  stepTargetTemperature,
} from '../server/src/8sleep/gestures.ts';

const temperatureLimits = { minTemperatureF: 55, maxTemperatureF: 110 };
const tapSettings = {
  doubleTap: { type: 'temperature', change: 'decrement', amount: 1 },
  tripleTap: { type: 'temperature', change: 'increment', amount: 2 },
  quadTap: { type: 'alarm', behavior: 'dismiss', snoozeDuration: 60, inactiveAlarmBehavior: 'power' },
};

// Records every action so tests can assert on order and arguments
function createRecordingActions() {
  const calls = [];
  return {
    calls,
    actions: {
      setTargetTemperature: async (temperatureF) => {
        // Yield first: a racing implementation would compute the next step before this resolves
        await new Promise(resolve => setImmediate(resolve));
        calls.push(['temperature', temperatureF]);
      },
      runAlarmGesture: async (tapConfig) => {
        calls.push(['alarm', tapConfig.behavior]);
      },
    },
  };
}

test('counter deltas fire once per gesture and rebase on resets', () => {
  const cases = [
    [3, 3, 0],
    [3, 4, 1],
    [3, 5, 2],
    // Frank restarted and the counter went backwards: nothing fires
    [7, 0, 0],
    [7, 2, 0],
    // No baseline yet, or the Pod did not report the counter
    [undefined, 4, 0],
    [4, undefined, 0],
    // A glitchy jump is capped
    [0, 500, MAX_GESTURES_PER_POLL],
  ];
  for (const [previousCount, nextCount, expected] of cases) {
    assert.equal(countNewGestures(previousCount, nextCount), expected, `${previousCount} → ${nextCount}`);
  }
});

test('temperature steps clamp to the supported range', () => {
  const decrement = { type: 'temperature', change: 'decrement', amount: 10 };
  const increment = { type: 'temperature', change: 'increment', amount: 10 };
  assert.equal(stepTargetTemperature(70, decrement, temperatureLimits), 60);
  assert.equal(stepTargetTemperature(60, decrement, temperatureLimits), 55);
  assert.equal(stepTargetTemperature(105, increment, temperatureLimits), 110);
});

test('two quick taps step the temperature twice, each from the previous result', async () => {
  const { calls, actions } = createRecordingActions();
  const finalTargetF = await processSideGestures({
    previousTaps: { doubleTap: 4, tripleTap: 1, quadTap: 0 },
    nextTaps: { doubleTap: 6, tripleTap: 1, quadTap: 0 },
    tapSettings,
    targetTemperatureF: 70,
    temperatureLimits,
    actions,
  });
  assert.deepEqual(calls, [['temperature', 69], ['temperature', 68]]);
  assert.equal(finalTargetF, 68);
});

test('different gestures in one poll build on each other in order', async () => {
  const { calls, actions } = createRecordingActions();
  await processSideGestures({
    previousTaps: { doubleTap: 0, tripleTap: 0, quadTap: 0 },
    nextTaps: { doubleTap: 1, tripleTap: 1, quadTap: 0 },
    tapSettings,
    targetTemperatureF: 70,
    temperatureLimits,
    actions,
  });
  assert.deepEqual(calls, [['temperature', 69], ['temperature', 71]]);
});

test('steps stop at the limit instead of sending the same temperature again', async () => {
  const { calls, actions } = createRecordingActions();
  await processSideGestures({
    previousTaps: { doubleTap: 0, tripleTap: 0, quadTap: 0 },
    nextTaps: { doubleTap: 3, tripleTap: 0, quadTap: 0 },
    tapSettings,
    targetTemperatureF: 56,
    temperatureLimits,
    actions,
  });
  assert.deepEqual(calls, [['temperature', 55]]);
});

test('alarm gestures run once even when the counter moved several times', async () => {
  const { calls, actions } = createRecordingActions();
  await processSideGestures({
    previousTaps: { doubleTap: 0, tripleTap: 0, quadTap: 2 },
    nextTaps: { doubleTap: 0, tripleTap: 0, quadTap: 4 },
    tapSettings,
    targetTemperatureF: 70,
    temperatureLimits,
    actions,
  });
  assert.deepEqual(calls, [['alarm', 'dismiss']]);
});

test('a counter reset or a missing baseline fires nothing', async () => {
  const { calls, actions } = createRecordingActions();
  const nextTaps = { doubleTap: 0, tripleTap: 1, quadTap: 0 };
  for (const previousTaps of [{ doubleTap: 9, tripleTap: 9, quadTap: 9 }, undefined]) {
    await processSideGestures({ previousTaps, nextTaps, tapSettings, targetTemperatureF: 70, temperatureLimits, actions });
  }
  assert.deepEqual(calls, []);
});
