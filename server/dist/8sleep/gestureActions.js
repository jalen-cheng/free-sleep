
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="e73128fd-0599-5161-9d5a-8f296c24df51")}catch(e){}}();
import logger from '../logger.js';
import settingsDB from '../db/settings.js';
import { MAX_TARGET_TEMPERATURE_F, MIN_TARGET_TEMPERATURE_F, } from '../routes/deviceStatus/deviceStatusSchema.js';
import { updateDeviceStatus } from '../routes/deviceStatus/updateDeviceStatus.js';
import { handleAlarmGesture } from '../jobs/alarmSession.js';
import { alarmSession } from '../jobs/alarmScheduler.js';
import { processSideGestures } from './gestures.js';
// One press can reach us twice: through the tap counters and through the Pod 5 button log.
// Running an alarm gesture twice would undo it (a power toggle flips back), so a second one
// for the same side within this window is dropped.
const ALARM_GESTURE_REPEAT_WINDOW_MS = 1_500;
const lastAlarmGestureAtMs = { left: 0, right: 0 };
export const setSidePower = (side, isOn) => {
    return updateDeviceStatus({ [side]: { isOn } });
};
// Runs a side's configured actions for the gestures made between two sets of counts.
// Shared by the tap counter monitor and the Pod 5 button monitor, so both behave the same.
// `settingsDB` must have been read by the caller.
export async function runSideGestures(side, deviceStatus, previousTaps, nextTaps) {
    try {
        await processSideGestures({
            previousTaps,
            nextTaps,
            tapSettings: settingsDB.data[side].taps,
            targetTemperatureF: deviceStatus[side].targetTemperatureF,
            temperatureLimits: { minTemperatureF: MIN_TARGET_TEMPERATURE_F, maxTemperatureF: MAX_TARGET_TEMPERATURE_F },
            actions: {
                setTargetTemperature: async (temperatureF) => {
                    logger.debug(`Processing gesture temperature change for ${side} -> ${temperatureF}`);
                    await updateDeviceStatus({ [side]: { targetTemperatureF: temperatureF } });
                },
                runAlarmGesture: async (tapConfig) => {
                    if (Date.now() - lastAlarmGestureAtMs[side] < ALARM_GESTURE_REPEAT_WINDOW_MS) {
                        logger.debug(`Skipping repeated alarm gesture for ${side}`);
                        return;
                    }
                    lastAlarmGestureAtMs[side] = Date.now();
                    const result = await handleAlarmGesture(tapConfig, {
                        isAlarmVibrating: deviceStatus[side].isAlarmVibrating,
                        isSideOn: deviceStatus[side].isOn,
                        // Same paths the app uses to dismiss an alarm and for its power button
                        dismissAlarm: () => updateDeviceStatus({ [side]: { isAlarmVibrating: false } }),
                        snoozeAlarm: snoozeSeconds => alarmSession.snooze(side, snoozeSeconds),
                        setPower: isOn => setSidePower(side, isOn),
                    });
                    logger.debug(`Processed alarm gesture for ${side}: ${result}`);
                },
            },
        });
    }
    catch (error) {
        logger.error(error);
    }
}
//# sourceMappingURL=gestureActions.js.map
//# debugId=e73128fd-0599-5161-9d5a-8f296c24df51
