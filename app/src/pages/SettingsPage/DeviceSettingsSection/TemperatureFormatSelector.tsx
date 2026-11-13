import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { DeepPartial } from 'ts-essentials';

import { Settings } from '@api/settingsSchema.ts';
import { useAppStore } from '@state/appStore.tsx';
import { TEMPERATURES } from '@api/settingsSchema.ts';
import { DEFAULT_TEMPERATURE_FORMAT } from '@lib/temperatureConversions.ts';

type TemperatureFormatSelectorProps = {
  settings?: Settings
  updateSettings: (settings: DeepPartial<Settings>) => void
}

export default function TemperatureFormatSelector({
  settings,
  updateSettings,
}: TemperatureFormatSelectorProps) {
  const { isUpdating } = useAppStore();

  const handleChange = (
    _: React.MouseEvent<HTMLElement>,
    newFormat: string
  ) => {
    if (newFormat !== null) {
      updateSettings({
        temperatureFormat: newFormat as Settings['temperatureFormat'],
      });
    }
  };

  return (
    <Box sx={ { minWidth: 0 } }>
      <Typography variant="body2" sx={ { fontWeight: 500, mb: 1 } }>Temperature format</Typography>
      <ToggleButtonGroup
        disabled={ isUpdating }
        color='primary'
        value={ settings?.temperatureFormat || DEFAULT_TEMPERATURE_FORMAT }
        exclusive
        onChange={ handleChange }
        aria-label="Temperature format"
        sx={ { width: '100%', '& .MuiToggleButton-root': { flex: 1, textTransform: 'capitalize' } } }
      >
        { TEMPERATURES.map((format) => (
          <ToggleButton value={ format } key={ format }>
            { format }
          </ToggleButton>
        )) }
      </ToggleButtonGroup>
    </Box>
  );
}
