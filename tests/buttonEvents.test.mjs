// Run with Node 24: node --test tests/buttonEvents.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  POWER_HOLD_MS,
  countPressesAsGestures,
  createButtonLineParser,
  isPowerHold,
} from '../server/src/8sleep/buttonEvents.ts';

// Shapes reported by Pod 5 owners; the text around the matched part varies
const topLine = 'Nov 01 02:06:25 DBG:4411 Ttc.cpp:88 [TTC] processing [button] side left { button: top, type: short }';
const bottomLine = 'DBG:4412 [TTC] processing [button] side right { button: bottom, type: short }';
const middleLine = 'DBG:4413 [TTC] processing [button] side left { button: middle, type: short }';
const heldLine = durationMs => `INF Buttons.cpp:40 [buttons] middle button held for ${durationMs}ms`;

// A clock the test moves by hand
function createClock() {
  let nowMs = 1_000_000;
  return { getNowMs: () => nowMs, advance: (milliseconds) => { nowMs += milliseconds; } };
}

test('top and bottom presses are read with their side', () => {
  const parseLine = createButtonLineParser();
  assert.deepEqual(parseLine(topLine), { side: 'left', button: 'top' });
  assert.deepEqual(parseLine(bottomLine), { side: 'right', button: 'bottom' });
});

test('unrelated log lines are ignored', () => {
  const parseLine = createButtonLineParser();
  assert.equal(parseLine('alarm[right] start: power 100, pattern 0, dur 120000 ms'), null);
  assert.equal(parseLine(''), null);
});

test('a middle press takes the hold duration reported just before it', () => {
  const clock = createClock();
  const parseLine = createButtonLineParser(clock.getNowMs);
  assert.equal(parseLine(heldLine(2140)), null);
  clock.advance(50);
  assert.deepEqual(parseLine(middleLine), { side: 'left', button: 'middle', heldMs: 2140 });
});

test('a hold duration is used once and never for a later press', () => {
  const clock = createClock();
  const parseLine = createButtonLineParser(clock.getNowMs);
  parseLine(heldLine(2140));
  parseLine(middleLine);
  assert.deepEqual(parseLine(middleLine), { side: 'left', button: 'middle' });
});

test('a stale hold duration is not attached', () => {
  const clock = createClock();
  const parseLine = createButtonLineParser(clock.getNowMs);
  parseLine(heldLine(2140));
  clock.advance(10_000);
  assert.deepEqual(parseLine(middleLine), { side: 'left', button: 'middle' });
});

test('only a long middle hold counts as a power hold', () => {
  assert.equal(isPowerHold({ side: 'left', button: 'middle', heldMs: POWER_HOLD_MS }), true);
  assert.equal(isPowerHold({ side: 'left', button: 'middle', heldMs: POWER_HOLD_MS - 1 }), false);
  assert.equal(isPowerHold({ side: 'left', button: 'middle' }), false);
  assert.equal(isPowerHold({ side: 'left', button: 'top', heldMs: 5_000 }), false);
});

test('presses are counted as the matching tap gestures', () => {
  const presses = [
    { side: 'left', button: 'top' },
    { side: 'left', button: 'top' },
    { side: 'left', button: 'bottom' },
    { side: 'left', button: 'middle', heldMs: 120 },
    { side: 'left', button: 'middle', heldMs: POWER_HOLD_MS + 500 },
  ];
  assert.deepEqual(countPressesAsGestures(presses), { tripleTap: 2, doubleTap: 1, quadTap: 1 });
});
