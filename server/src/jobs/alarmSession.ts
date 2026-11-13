// Tracks the running alarm per side: when its vibration ends, and any pending snooze.
// Keep this file free of runtime imports so tests can load it without a Pod environment.
import type { AlarmJob, Side } from '../db/schedulesSchema.js';
import type { AlarmTapConfig } from '../8sleep/gestures.js';

type SideAlarmState = {
  // The alarm that last started on this side, re-run when it is snoozed
  lastAlarm?: AlarmJob;
  vibrationEndTimer?: ReturnType<typeof setTimeout>;
  snoozeTimer?: ReturnType<typeof setTimeout>;
};

export type AlarmSessionDeps = {
  // Sends the alarm to the Pod. It must report back through alarmStarted once vibration begins.
  startAlarm: (alarmJob: AlarmJob) => Promise<void>;
  // Persists the "alarm is vibrating" flag the app reads
  setAlarmVibrating: (side: Side, isAlarmVibrating: boolean) => Promise<void>;
  logDebug: (message: string) => void;
};

// Creates the alarm state tracker. The Pod cannot tell us whether an alarm is vibrating,
// so this is the single owner of that knowledge and of every timer attached to it.
export function createAlarmSession({ startAlarm, setAlarmVibrating, logDebug }: AlarmSessionDeps) {
  const sideStates: Record<Side, SideAlarmState> = { left: {}, right: {} };

  const cancelVibrationEndTimer = (side: Side) => {
    clearTimeout(sideStates[side].vibrationEndTimer);
    sideStates[side].vibrationEndTimer = undefined;
  };

  const cancelSnooze = (side: Side) => {
    if (sideStates[side].snoozeTimer) logDebug(`Cancelling pending snooze for ${side}`);
    clearTimeout(sideStates[side].snoozeTimer);
    sideStates[side].snoozeTimer = undefined;
  };

  // Call when an alarm has been sent to the Pod. Replaces the previous end-of-vibration timer,
  // so an older alarm's timer cannot clear the flag while this one is still vibrating.
  const alarmStarted = async (alarmJob: AlarmJob, durationSeconds: number) => {
    const { side } = alarmJob;
    cancelVibrationEndTimer(side);
    cancelSnooze(side);
    sideStates[side].lastAlarm = alarmJob;
    await setAlarmVibrating(side, true);
    sideStates[side].vibrationEndTimer = setTimeout(() => {
      sideStates[side].vibrationEndTimer = undefined;
      void setAlarmVibrating(side, false);
    }, durationSeconds * 1_000);
  };

  // Call when the alarm was stopped on the Pod (dismissed from the app or by a tap).
  const alarmCleared = async (side: Side) => {
    cancelVibrationEndTimer(side);
    cancelSnooze(side);
    await setAlarmVibrating(side, false);
  };

  // Re-runs the last alarm of a side after snoozeSeconds. Returns false when there is nothing to snooze.
  const snooze = (side: Side, snoozeSeconds: number): boolean => {
    const { lastAlarm } = sideStates[side];
    if (!lastAlarm) return false;
    cancelSnooze(side);
    logDebug(`Snoozing ${side} alarm for ${snoozeSeconds}s`);
    sideStates[side].snoozeTimer = setTimeout(() => {
      sideStates[side].snoozeTimer = undefined;
      void startAlarm(lastAlarm);
    }, snoozeSeconds * 1_000);
    return true;
  };

  const hasPendingSnooze = (side: Side) => sideStates[side].snoozeTimer !== undefined;

  return { alarmStarted, alarmCleared, snooze, cancelSnooze, hasPendingSnooze };
}

export type AlarmSession = ReturnType<typeof createAlarmSession>;

export type AlarmGestureDeps = {
  isAlarmVibrating: boolean;
  isSideOn: boolean;
  // Stops the vibration on the Pod and clears the alarm state
  dismissAlarm: () => Promise<void>;
  snoozeAlarm: (snoozeSeconds: number) => boolean;
  setPower: (isOn: boolean) => Promise<void>;
};

export type AlarmGestureResult = 'dismissed' | 'snoozed' | 'power' | 'none';

// Decides what an alarm tap does. While an alarm vibrates it dismisses or snoozes it;
// otherwise it toggles the side's power if configured to.
export async function handleAlarmGesture(tapConfig: AlarmTapConfig, deps: AlarmGestureDeps): Promise<AlarmGestureResult> {
  if (deps.isAlarmVibrating) {
    // Dismiss first: it cancels any earlier snooze, then the new snooze is scheduled
    await deps.dismissAlarm();
    if (tapConfig.behavior === 'snooze' && deps.snoozeAlarm(tapConfig.snoozeDuration)) return 'snoozed';
    return 'dismissed';
  }
  if (tapConfig.inactiveAlarmBehavior === 'power') {
    await deps.setPower(!deps.isSideOn);
    return 'power';
  }
  return 'none';
}
