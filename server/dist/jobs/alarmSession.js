// Creates the alarm state tracker. The Pod cannot tell us whether an alarm is vibrating,
// so this is the single owner of that knowledge and of every timer attached to it.

!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="dbfbe8bc-875f-51e8-954e-1d269c9936cc")}catch(e){}}();
export function createAlarmSession({ startAlarm, setAlarmVibrating, logDebug }) {
    const sideStates = { left: {}, right: {} };
    const cancelVibrationEndTimer = (side) => {
        clearTimeout(sideStates[side].vibrationEndTimer);
        sideStates[side].vibrationEndTimer = undefined;
    };
    const cancelSnooze = (side) => {
        if (sideStates[side].snoozeTimer)
            logDebug(`Cancelling pending snooze for ${side}`);
        clearTimeout(sideStates[side].snoozeTimer);
        sideStates[side].snoozeTimer = undefined;
    };
    // Call when an alarm has been sent to the Pod. Replaces the previous end-of-vibration timer,
    // so an older alarm's timer cannot clear the flag while this one is still vibrating.
    const alarmStarted = async (alarmJob, durationSeconds) => {
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
    const alarmCleared = async (side) => {
        cancelVibrationEndTimer(side);
        cancelSnooze(side);
        await setAlarmVibrating(side, false);
    };
    // Re-runs the last alarm of a side after snoozeSeconds. Returns false when there is nothing to snooze.
    const snooze = (side, snoozeSeconds) => {
        const { lastAlarm } = sideStates[side];
        if (!lastAlarm)
            return false;
        cancelSnooze(side);
        logDebug(`Snoozing ${side} alarm for ${snoozeSeconds}s`);
        sideStates[side].snoozeTimer = setTimeout(() => {
            sideStates[side].snoozeTimer = undefined;
            void startAlarm(lastAlarm);
        }, snoozeSeconds * 1_000);
        return true;
    };
    const hasPendingSnooze = (side) => sideStates[side].snoozeTimer !== undefined;
    return { alarmStarted, alarmCleared, snooze, cancelSnooze, hasPendingSnooze };
}
// Decides what an alarm tap does. While an alarm vibrates it dismisses or snoozes it;
// otherwise it toggles the side's power if configured to.
export async function handleAlarmGesture(tapConfig, deps) {
    if (deps.isAlarmVibrating) {
        // Dismiss first: it cancels any earlier snooze, then the new snooze is scheduled
        await deps.dismissAlarm();
        if (tapConfig.behavior === 'snooze' && deps.snoozeAlarm(tapConfig.snoozeDuration))
            return 'snoozed';
        return 'dismissed';
    }
    if (tapConfig.inactiveAlarmBehavior === 'power') {
        await deps.setPower(!deps.isSideOn);
        return 'power';
    }
    return 'none';
}
//# sourceMappingURL=alarmSession.js.map
//# debugId=dbfbe8bc-875f-51e8-954e-1d269c9936cc
