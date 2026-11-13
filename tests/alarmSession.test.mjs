// Run with Node 24: node --test tests/alarmSession.test.mjs
import assert from 'node:assert/strict';
import { beforeEach, mock, test } from 'node:test';
import { createAlarmSession, handleAlarmGesture } from '../server/src/jobs/alarmSession.ts';

const leftAlarm = { side: 'left', vibrationIntensity: 80, duration: 30, vibrationPattern: 'rise' };
const dismissTap = { type: 'alarm', behavior: 'dismiss', snoozeDuration: 120, inactiveAlarmBehavior: 'power' };
const snoozeTap = { ...dismissTap, behavior: 'snooze' };

// Lets timer callbacks that end in un-awaited promises finish
const flushPromises = () => new Promise(resolve => setImmediate(resolve));

// Builds a session whose Pod calls are recorded instead of sent to Franken
function createTestSession() {
  const vibrating = { left: false, right: false };
  const startedAlarms = [];
  const session = createAlarmSession({
    startAlarm: async (alarmJob) => {
      startedAlarms.push(alarmJob);
      await session.alarmStarted(alarmJob, alarmJob.duration);
    },
    setAlarmVibrating: async (side, isAlarmVibrating) => {
      vibrating[side] = isAlarmVibrating;
    },
    logDebug: () => {},
  });
  return { session, vibrating, startedAlarms };
}

// Wires handleAlarmGesture to a test session the way frankenMonitor wires it to the Pod
function createGestureDeps({ session, vibrating }, side, isSideOn = true) {
  const powerCalls = [];
  const deps = {
    isAlarmVibrating: vibrating[side],
    isSideOn,
    dismissAlarm: () => session.alarmCleared(side),
    snoozeAlarm: snoozeSeconds => session.snooze(side, snoozeSeconds),
    setPower: async (isOn) => {
      powerCalls.push(isOn);
    },
  };
  return { deps, powerCalls };
}

beforeEach(() => {
  mock.timers.reset();
  mock.timers.enable({ apis: ['setTimeout'] });
});

test('the vibrating flag clears when the alarm duration ends', async () => {
  const { session, vibrating } = createTestSession();
  await session.alarmStarted(leftAlarm, 30);
  assert.equal(vibrating.left, true);
  mock.timers.tick(29_999);
  assert.equal(vibrating.left, true);
  mock.timers.tick(1);
  assert.equal(vibrating.left, false);
});

test('a dismiss tap clears the alarm and schedules nothing', async () => {
  const testSession = createTestSession();
  await testSession.session.alarmStarted(leftAlarm, 30);
  const { deps, powerCalls } = createGestureDeps(testSession, 'left');

  assert.equal(await handleAlarmGesture(dismissTap, deps), 'dismissed');
  assert.equal(testSession.vibrating.left, false);
  assert.equal(testSession.session.hasPendingSnooze('left'), false);
  mock.timers.tick(600_000);
  assert.deepEqual(testSession.startedAlarms, []);
  assert.deepEqual(powerCalls, []);
});

test('a snooze tap clears the alarm and re-runs it with the same settings', async () => {
  const testSession = createTestSession();
  await testSession.session.alarmStarted(leftAlarm, 30);
  const { deps } = createGestureDeps(testSession, 'left');

  assert.equal(await handleAlarmGesture(snoozeTap, deps), 'snoozed');
  assert.equal(testSession.vibrating.left, false);
  assert.equal(testSession.session.hasPendingSnooze('left'), true);

  mock.timers.tick(119_999);
  assert.deepEqual(testSession.startedAlarms, []);
  mock.timers.tick(1);
  await flushPromises();
  assert.deepEqual(testSession.startedAlarms, [leftAlarm]);
  assert.equal(testSession.vibrating.left, true);
  assert.equal(testSession.session.hasPendingSnooze('left'), false);
});

test('the first alarm\'s timer cannot clear the flag of the snoozed alarm', async () => {
  const testSession = createTestSession();
  // A 300s alarm snoozed after 10s for 120s: the original timer would fire at 300s,
  // in the middle of the snoozed alarm that runs from 130s to 430s
  const longAlarm = { ...leftAlarm, duration: 300 };
  await testSession.session.alarmStarted(longAlarm, 300);
  mock.timers.tick(10_000);
  await handleAlarmGesture(snoozeTap, createGestureDeps(testSession, 'left').deps);
  mock.timers.tick(120_000);
  await flushPromises();
  assert.equal(testSession.vibrating.left, true);

  mock.timers.tick(170_000);
  assert.equal(testSession.vibrating.left, true, 'still vibrating at the original alarm\'s end time');
  mock.timers.tick(130_000);
  assert.equal(testSession.vibrating.left, false);
});

test('dismissing or powering off cancels a pending snooze', async () => {
  for (const cancel of [session => session.alarmCleared('left'), session => session.cancelSnooze('left')]) {
    const testSession = createTestSession();
    await testSession.session.alarmStarted(leftAlarm, 30);
    await handleAlarmGesture(snoozeTap, createGestureDeps(testSession, 'left').deps);
    await cancel(testSession.session);
    mock.timers.tick(600_000);
    await flushPromises();
    assert.deepEqual(testSession.startedAlarms, []);
  }
});

test('snoozing one side leaves the other side alone', async () => {
  const testSession = createTestSession();
  await testSession.session.alarmStarted(leftAlarm, 30);
  await testSession.session.alarmStarted({ ...leftAlarm, side: 'right' }, 30);
  await handleAlarmGesture(snoozeTap, createGestureDeps(testSession, 'left').deps);
  assert.deepEqual(testSession.vibrating, { left: false, right: true });
  assert.equal(testSession.session.hasPendingSnooze('right'), false);
});

test('with no alarm vibrating the tap toggles power only when configured', async () => {
  const testSession = createTestSession();
  const whenOn = createGestureDeps(testSession, 'left', true);
  assert.equal(await handleAlarmGesture(dismissTap, whenOn.deps), 'power');
  assert.deepEqual(whenOn.powerCalls, [false]);

  const whenOff = createGestureDeps(testSession, 'left', false);
  assert.equal(await handleAlarmGesture(snoozeTap, whenOff.deps), 'power');
  assert.deepEqual(whenOff.powerCalls, [true]);

  const disabled = createGestureDeps(testSession, 'left', true);
  assert.equal(await handleAlarmGesture({ ...dismissTap, inactiveAlarmBehavior: 'none' }, disabled.deps), 'none');
  assert.deepEqual(disabled.powerCalls, []);
});

test('snooze falls back to dismiss when no alarm is known', async () => {
  const testSession = createTestSession();
  testSession.vibrating.left = true;
  const { deps } = createGestureDeps(testSession, 'left');
  assert.equal(await handleAlarmGesture(snoozeTap, deps), 'dismissed');
  assert.equal(testSession.session.hasPendingSnooze('left'), false);
});
