import { SideSettings } from '@api/settingsSchema.ts';

type AlarmTapConfig = Extract<SideSettings['taps']['quadTap'], { type: 'alarm' }>;

// The few choices the settings page offers. They are applied to both sides, with a fixed layout:
// double tap cools, triple tap warms, and quadruple tap handles the alarm and power.
export type SharedTapSettings = {
  temperatureStepF: number;
  alarmBehavior: AlarmTapConfig['behavior'];
  snoozeDurationSeconds: number;
  inactiveAlarmBehavior: AlarmTapConfig['inactiveAlarmBehavior'];
};

const MIN_TEMPERATURE_STEP_F = 1;

const DEFAULT_TAP_SETTINGS: SharedTapSettings = {
  temperatureStepF: MIN_TEMPERATURE_STEP_F,
  alarmBehavior: 'dismiss',
  snoozeDurationSeconds: 300,
  inactiveAlarmBehavior: 'power',
};

// Reads the shared choices back out of one side's saved tap config.
// A config saved in some other layout (for example by hand) falls back to the defaults for
// whatever it does not express.
export const readSharedTapSettings = (taps: SideSettings['taps']): SharedTapSettings => {
  const temperatureTap = [taps.doubleTap, taps.tripleTap].find(tapConfig => tapConfig.type === 'temperature');
  const alarmTap = taps.quadTap.type === 'alarm' ? taps.quadTap : undefined;
  return {
    temperatureStepF: temperatureTap?.type === 'temperature'
      ? Math.max(MIN_TEMPERATURE_STEP_F, temperatureTap.amount)
      : DEFAULT_TAP_SETTINGS.temperatureStepF,
    alarmBehavior: alarmTap?.behavior ?? DEFAULT_TAP_SETTINGS.alarmBehavior,
    snoozeDurationSeconds: alarmTap?.snoozeDuration ?? DEFAULT_TAP_SETTINGS.snoozeDurationSeconds,
    inactiveAlarmBehavior: alarmTap?.inactiveAlarmBehavior ?? DEFAULT_TAP_SETTINGS.inactiveAlarmBehavior,
  };
};

// Builds the full tap config for one side. Always complete: the server replaces each gesture's
// config as a whole.
export const buildSideTaps =(tapSettings: SharedTapSettings): SideSettings['taps'] => ({
  doubleTap: { type: 'temperature', change: 'decrement', amount: tapSettings.temperatureStepF },
  tripleTap: { type: 'temperature', change: 'increment', amount: tapSettings.temperatureStepF },
  quadTap: {
    type: 'alarm',
    behavior: tapSettings.alarmBehavior,
    snoozeDuration: tapSettings.snoozeDurationSeconds,
    inactiveAlarmBehavior: tapSettings.inactiveAlarmBehavior,
  },
});
