import _ from 'lodash';
import type { TemperatureFormat } from '@api/settingsSchema.ts';

// Every temperature in the app, the API and the saved schedules is a whole number of °F.
// The display unit only changes how those numbers are shown and which values can be picked.
export type { TemperatureFormat };
export const DEFAULT_TEMPERATURE_FORMAT: TemperatureFormat = 'fahrenheit';

export const MIN_TEMP_F = 55;
export const MAX_TEMP_F = 110;

// The Pod itself works in levels from -100 to 100, and Eight Sleep's app shows those as -10 to +10.
// Free Sleep spreads the levels evenly over 55-110°F, so level 0 is 82.5°F and one level is 2.75°F.
const NEUTRAL_TEMP_F = (MIN_TEMP_F + MAX_TEMP_F) / 2;
export const MAX_LEVEL = 10;
export const MIN_LEVEL = -MAX_LEVEL;
const DEGREES_F_PER_LEVEL = (MAX_TEMP_F - NEUTRAL_TEMP_F) / MAX_LEVEL;

const UNIT_LABELS: Record<TemperatureFormat, string> = { fahrenheit: '°F', celsius: '°C', level: 'Level' };
export const getTemperatureUnitLabel = (format: TemperatureFormat) => UNIT_LABELS[format];

export function farenheitToCelcius(farenheit: number): number {
  const celcius = (farenheit - 32) * 5 / 9;
  return Math.round(celcius * 2) / 2;
}

// The nearest level (-10 to +10) for a temperature
export function temperatureToLevel(tempF: number): number {
  const level = Math.round((tempF - NEUTRAL_TEMP_F) / DEGREES_F_PER_LEVEL);
  // `|| 0` turns -0 into 0
  return _.clamp(level, MIN_LEVEL, MAX_LEVEL) || 0;
}

// The whole °F that stands for a level. Converting it back always gives the same level.
export function levelToTemperature(level: number): number {
  return _.clamp(Math.round(NEUTRAL_TEMP_F + level * DEGREES_F_PER_LEVEL), MIN_TEMP_F, MAX_TEMP_F);
}

const formatLevel = (level: number) => (level > 0 ? `+${level}` : `${level}`);

// Converts a stored °F temperature to the number shown in the chosen unit (used for chart axes)
export function toDisplayValue(tempF: number, format: TemperatureFormat): number {
  if (format === 'celsius') return farenheitToCelcius(tempF);
  if (format === 'level') return temperatureToLevel(tempF);
  return tempF;
}

// Formats a number that is already in the chosen unit, e.g. a chart axis tick
export function formatDisplayValue(displayValue: number, format: TemperatureFormat) {
  if (format === 'level') return formatLevel(displayValue);
  return `${displayValue}${UNIT_LABELS[format]}`;
}

// The value and unit separately, for layouts that style them differently. Levels have no unit.
export function getTemperatureParts(tempF: number, format: TemperatureFormat) {
  const value = toDisplayValue(tempF, format);
  return format === 'level' ? { value: formatLevel(value), unit: '' } : { value: `${value}`, unit: UNIT_LABELS[format] };
}

// Short form: "84°F", "29°C" or "+1"
export function formatTemperature(tempF: number, format: TemperatureFormat) {
  return formatDisplayValue(toDisplayValue(tempF, format), format);
}

// For use inside a sentence, where a bare "+1" would not read as a temperature: "level +1"
export function describeTemperature(tempF: number, format: TemperatureFormat) {
  const formatted = formatTemperature(tempF, format);
  return format === 'level' ? `level ${formatted}` : formatted;
}

// Formats a temperature difference (a step, not a reading), so no 32° offset is applied
export function formatTemperatureDelta(deltaF: number, format: TemperatureFormat) {
  if (format === 'celsius') return `${Math.round(deltaF * 5 / 9 * 2) / 2}°C`;
  if (format === 'level') {
    const levels = Math.max(1, Math.round(deltaF / DEGREES_F_PER_LEVEL));
    return `${levels} ${levels === 1 ? 'level' : 'levels'}`;
  }
  return `${deltaF}°F`;
}

// Moves a temperature by a number of steps of the chosen unit: 1°F each, or one level each.
// (°C uses the 1°F step too, as the Pod cannot be set more finely than that.)
export function stepTemperature(tempF: number, steps: number, format: TemperatureFormat): number {
  if (format === 'level') return levelToTemperature(_.clamp(temperatureToLevel(tempF) + steps, MIN_LEVEL, MAX_LEVEL));
  return _.clamp(Math.round(tempF) + steps, MIN_TEMP_F, MAX_TEMP_F);
}

// The size of one such step in °F, for labelling the step
export function getStepSizeF(format: TemperatureFormat): number {
  return format === 'level' ? DEGREES_F_PER_LEVEL : 1;
}

// The nearest temperature that can be picked in the chosen unit
export function snapTemperature(tempF: number, format: TemperatureFormat): number {
  return stepTemperature(tempF, 0, format);
}

// Every temperature that can be picked in the chosen unit, in °F, coldest first
export function getTemperatureOptions(format: TemperatureFormat): number[] {
  if (format === 'level') return _.range(MIN_LEVEL, MAX_LEVEL + 1).map(levelToTemperature);
  return _.range(MIN_TEMP_F, MAX_TEMP_F + 1);
}

// Tap and button steps are stored as whole °F, up to 10. In levels that allows 1 to 3 levels.
const MAX_STEP_F = 10;
const LEVEL_STEPS_F = [1, 2, 3].map(levels => Math.round(levels * DEGREES_F_PER_LEVEL));

// The step sizes (in °F) that can be picked in the chosen unit, smallest first
export function getStepOptions(format: TemperatureFormat): number[] {
  return format === 'level' ? LEVEL_STEPS_F : _.range(1, MAX_STEP_F + 1);
}

// The pickable step closest to a saved one, for showing a step that was saved in another unit
export function snapStep(stepF: number, format: TemperatureFormat): number {
  return _.minBy(getStepOptions(format), option => Math.abs(option - stepF)) ?? stepF;
}

export function getTemperatureColor(tempF: number | undefined) {
  if (tempF === undefined) return '#262626';
  if (tempF <= 70) return '#2196f3';
  if (tempF <= 82) return '#5393ff';
  if (tempF <= 95) return '#db5858';
  return '#d32f2f';
}
