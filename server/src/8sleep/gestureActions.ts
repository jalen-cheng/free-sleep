import { DeepPartial } from 'ts-essentials';
import logger from '../logger.js';
import settingsDB from '../db/settings.js';
import { Side } from '../db/schedulesSchema.js';
import {
  DeviceStatus,
  MAX_TARGET_TEMPERATURE_F,
  MIN_TARGET_TEMPERATURE_F,
} from '../routes/deviceStatus/deviceStatusSchema.js';
import { updateDeviceStatus } from '../routes/deviceStatus/updateDeviceStatus.js';
import { handleAlarmGesture } from '../jobs/alarmSession.js';
import { alarmSession } from '../jobs/alarmScheduler.js';
import { TapCounts, processSideGestures } from './gestures.js';

// One press can reach us twice: through the tap counters and through the Pod 5 button log.
// Running an alarm gesture twice would undo it (a power toggle flips back), so a second one
// for the same side within this window is dropped.
const ALARM_GESTURE_REPEAT_WINDOW_MS = 1_500;
const lastAlarmGestureAtMs: Record<Side, number> = { left: 0, right: 0 };

export const setSidePower = (side: Side, isOn: boolean) => {
  return updateDeviceStatus({ [side]: { isOn } } as DeepPartial<DeviceStatus>);
};

// Runs a side's configured actions for the gestures made between two sets of counts.
// Shared by the tap counter monitor and the Pod 5 button monitor, so both behave the same.
// `settingsDB` must have been read by the caller.
export async function runSideGestures(
  side: Side,
  deviceStatus: DeviceStatus,
  previousTaps: TapCounts | undefined,
  nextTaps: TapCounts | undefined,
) {
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
          await updateDeviceStatus({ [side]: { targetTemperatureF: temperatureF } } as DeepPartial<DeviceStatus>);
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
            dismissAlarm: () => updateDeviceStatus({ [side]: { isAlarmVibrating: false } } as DeepPartial<DeviceStatus>),
            snoozeAlarm: snoozeSeconds => alarmSession.snooze(side, snoozeSeconds),
            setPower: isOn => setSidePower(side, isOn),
          });
          logger.debug(`Processed alarm gesture for ${side}: ${result}`);
        },
      },
    });
  } catch (error) {
    logger.error(error);
  }
}
