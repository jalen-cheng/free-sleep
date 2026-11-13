// Upper bound on repeats from one poll, so a counter glitch cannot swing the temperature wildly

!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="52aae6e0-fc5a-54bd-be93-4ae403512215")}catch(e){}}();
export const MAX_GESTURES_PER_POLL = 3;
// How many times a gesture happened between two polls of Frank's cumulative counter.
// A counter that went backwards means Frank restarted: fire nothing, the caller rebases on nextCount.
export function countNewGestures(previousCount, nextCount) {
    if (previousCount === undefined || nextCount === undefined)
        return 0;
    if (nextCount <= previousCount)
        return 0;
    return Math.min(nextCount - previousCount, MAX_GESTURES_PER_POLL);
}
// Applies one temperature tap to a target temperature, clamped to the range the Pod accepts.
export function stepTargetTemperature(targetTemperatureF, tapConfig, { minTemperatureF, maxTemperatureF }) {
    const direction = tapConfig.change === 'increment' ? 1 : -1;
    const steppedTemperatureF = targetTemperatureF + direction * tapConfig.amount;
    return Math.min(maxTemperatureF, Math.max(minTemperatureF, steppedTemperatureF));
}
// Runs every new gesture for one side, one at a time. Each temperature step starts from the
// result of the previous one, so two quick taps move the target twice instead of racing.
// Alarm gestures (dismiss, snooze, power toggle) run once even if the counter moved further,
// because repeating them would undo the first one.
// Returns the target temperature after all steps.
export async function processSideGestures({ previousTaps, nextTaps, tapSettings, targetTemperatureF, temperatureLimits, actions, }) {
    let currentTargetF = targetTemperatureF;
    for (const gesture of Object.keys(tapSettings)) {
        const newGestureCount = countNewGestures(previousTaps?.[gesture], nextTaps?.[gesture]);
        if (newGestureCount === 0)
            continue;
        const tapConfig = tapSettings[gesture];
        if (tapConfig.type === 'alarm') {
            await actions.runAlarmGesture(tapConfig);
            continue;
        }
        for (let gestureIndex = 0; gestureIndex < newGestureCount; gestureIndex++) {
            const steppedTargetF = stepTargetTemperature(currentTargetF, tapConfig, temperatureLimits);
            if (steppedTargetF === currentTargetF)
                break;
            await actions.setTargetTemperature(steppedTargetF);
            currentTargetF = steppedTargetF;
        }
    }
    return currentTargetF;
}
//# sourceMappingURL=gestures.js.map
//# debugId=52aae6e0-fc5a-54bd-be93-4ae403512215
