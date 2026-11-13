import { useSettings } from '@api/settings.ts';
import { DEFAULT_TEMPERATURE_FORMAT, TemperatureFormat } from './temperatureConversions.ts';

// The unit temperatures are shown in (°F, °C or level), from Settings
export function useTemperatureFormat(): TemperatureFormat {
  const { data: settings } = useSettings();
  return settings?.temperatureFormat ?? DEFAULT_TEMPERATURE_FORMAT;
}
