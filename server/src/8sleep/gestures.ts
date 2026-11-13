// Pure helpers that turn Frank's tap counters into gesture actions.
// Keep this file free of runtime imports so tests can load it without a Pod environment.
import type { SideSettings } from '../db/settingsSchema.js';

type TapSettings = SideSettings['taps'];
type Gesture = keyof TapSettings;
type TapConfig = TapSettings[Gesture];
export type TemperatureTapConfig = Extract<TapConfig, { type: 'temperature' }>;
export type AlarmTapConfig = Extract<TapConfig, { type: 'alarm' }>;
export type TapCounts = Partial<Record<Gesture, number>>;

export type TemperatureLimits = {
  minTemperatureF: number;
  maxTemperatureF: number;
};

export type GestureActions = {
  setTargetTemperature: (temperatureF: number) => Promise<void>;
  runAlarmGesture: (tapConfig: AlarmTapConfig) => Promise<void>;
};

// Upper bound on repeats from one poll, so a counter glitch cannot swing the temperature wildly
export const MAX_GESTURES_PER_POLL = 3;

// How many times a gesture happened between two polls of Frank's cumulative counter.
// A counter that went backwards means Frank restarted: fire nothing, the caller rebases on nextCount.
export function countNewGestures(previousCount: number | undefined, nextCount: number | undefined): number {
  if (previousCount === undefined || nextCount === undefined) return 0;
  if (nextCount <= previousCount) return 0;
  return Math.min(nextCount - previousCount, MAX_GESTURES_PER_POLL);
}

// Applies one temperature tap to a target temperature, clamped to the range the Pod accepts.
export function stepTargetTemperature(
  targetTemperatureF: number,
  tapConfig: TemperatureTapConfig,
  { minTemperatureF, maxTemperatureF }: TemperatureLimits,
): number {
  const direction = tapConfig.change === 'increment' ? 1 : -1;
  const steppedTemperatureF = targetTemperatureF + direction * tapConfig.amount;
  return Math.min(maxTemperatureF, Math.max(minTemperatureF, steppedTemperatureF));
}

type ProcessSideGesturesArgs = {
  previousTaps: TapCounts | undefined;
  nextTaps: TapCounts | undefined;
  tapSettings: TapSettings;
  targetTemperatureF: number;
  temperatureLimits: TemperatureLimits;
  actions: GestureActions;
};

// Runs every new gesture for one side, one at a time. Each temperature step starts from the
// result of the previous one, so two quick taps move the target twice instead of racing.
// Alarm gestures (dismiss, snooze, power toggle) run once even if the counter moved further,
// because repeating them would undo the first one.
// Returns the target temperature after all steps.
export async function processSideGestures({
  previousTaps,
  nextTaps,
  tapSettings,
  targetTemperatureF,
  temperatureLimits,
  actions,
}: ProcessSideGesturesArgs): Promise<number> {
  let currentTargetF = targetTemperatureF;
  for (const gesture of Object.keys(tapSettings) as Gesture[]) {
    const newGestureCount = countNewGestures(previousTaps?.[gesture], nextTaps?.[gesture]);
    if (newGestureCount === 0) continue;

    const tapConfig = tapSettings[gesture];
    if (tapConfig.type === 'alarm') {
      await actions.runAlarmGesture(tapConfig);
      continue;
    }

    for (let gestureIndex = 0; gestureIndex < newGestureCount; gestureIndex++) {
      const steppedTargetF = stepTargetTemperature(currentTargetF, tapConfig, temperatureLimits);
      if (steppedTargetF === currentTargetF) break;
      await actions.setTargetTemperature(steppedTargetF);
      currentTargetF = steppedTargetF;
    }
  }
  return currentTargetF;
}
