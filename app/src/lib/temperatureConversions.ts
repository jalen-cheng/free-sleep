export function farenheitToCelcius(farenheit: number): number {
  const celcius = (farenheit - 32) * 5 / 9;
  return Math.round(celcius * 2) / 2;
}

export function formatTemperature(temperature: number, celcius: boolean) {
  return celcius ? `${farenheitToCelcius(temperature)}°C` : `${temperature}°F`;
}

// Formats a temperature difference (a step, not a reading), so no 32° offset is applied.
export function formatTemperatureDelta(deltaF: number, celcius: boolean) {
  if (!celcius) return `${deltaF}°F`;
  const deltaC = Math.round(deltaF * 5 / 9 * 2) / 2;
  return `${deltaC}°C`;
}


export const MIN_TEMP_F = 55;
export const MAX_TEMP_F = 110;

export const MIN_TEMP_C = farenheitToCelcius(MIN_TEMP_F);
export const MAX_TEMP_C = farenheitToCelcius(MAX_TEMP_F);


// The Pod itself works in levels from -100 to 100, and Eight Sleep's app shows those as -10 to +10.
// Free Sleep spreads the levels evenly over 55-110°F, so level 0 is 82.5°F and one step in
// Eight Sleep's app is 2.75°F.
const NEUTRAL_TEMP_F = (MIN_TEMP_F + MAX_TEMP_F) / 2;
const EIGHT_SLEEP_APP_MAX_LEVEL = 10;

// Returns the nearest Eight Sleep app level for a temperature, as text such as "+2", "0" or "-4"
export function formatEightSleepLevel(tempF: number) {
  const level = Math.round((tempF - NEUTRAL_TEMP_F) / (MAX_TEMP_F - NEUTRAL_TEMP_F) * EIGHT_SLEEP_APP_MAX_LEVEL);
  if (level > 0) return `+${level}`;
  // `|| 0` avoids showing "-0"
  return `${level || 0}`;
}


export function getTemperatureColor(tempF: number | undefined) {
  if (tempF === undefined) return '#262626';
  if (tempF <= 70) return '#2196f3';
  if (tempF <= 82) return '#5393ff';
  if (tempF <= 95) return '#db5858';
  return '#d32f2f';
}

