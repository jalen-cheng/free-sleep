import { Box, MenuItem, TextField, Typography } from '@mui/material';
import Switch from '@mui/material/Switch';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { z } from 'zod';

import { TapConfig } from '@api/settingsSchema.ts';
import { useAppStore } from '@state/appStore.tsx';
import { formatTemperatureDelta } from '@lib/temperatureConversions.ts';
import SettingToggle from '../SettingToggle.tsx';

type TapConfigValue = z.infer<typeof TapConfig>;
type TemperatureTapConfig = Extract<TapConfigValue, { type: 'temperature' }>;
type AlarmTapConfig = Extract<TapConfigValue, { type: 'alarm' }>;

// Used when a gesture is switched to a type it was not configured for before
const DEFAULT_TEMPERATURE_TAP: TemperatureTapConfig = { type: 'temperature', change: 'decrement', amount: 1 };
const DEFAULT_ALARM_TAP: AlarmTapConfig = {
  type: 'alarm',
  behavior: 'dismiss',
  snoozeDuration: 300,
  inactiveAlarmBehavior: 'power',
};

const TEMPERATURE_AMOUNTS_F = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const SNOOZE_MINUTES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const SECONDS_PER_MINUTE = 60;

const toggleGroupSx = { width: '100%', '& .MuiToggleButton-root': { flex: 1, py: 0.5 } };

type TapGestureControlProps = {
  label: string;
  displayCelsius: boolean;
  tapConfig: TapConfigValue;
  // Always receives a complete config: the server replaces a gesture's config as a whole
  onChange: (tapConfig: TapConfigValue) => void;
}

// Editor for one tap gesture: what it does, and the options for that action.
export default function TapGestureControl({ label, displayCelsius, tapConfig, onChange }: TapGestureControlProps) {
  const { isUpdating } = useAppStore();

  const handleTypeChange = (_: React.MouseEvent<HTMLElement>, newType: TapConfigValue['type'] | null) => {
    if (newType === null || newType === tapConfig.type) return;
    onChange(newType === 'temperature' ? DEFAULT_TEMPERATURE_TAP : DEFAULT_ALARM_TAP);
  };

  return (
    <Box sx={ { display: 'flex', flexDirection: 'column', gap: 1.25, minWidth: 0 } }>
      <Typography variant="body2" sx={ { fontWeight: 500 } }>{ label }</Typography>
      <ToggleButtonGroup
        disabled={ isUpdating }
        color="primary"
        size="small"
        value={ tapConfig.type }
        exclusive
        onChange={ handleTypeChange }
        aria-label={ `${label} action` }
        sx={ toggleGroupSx }
      >
        <ToggleButton value="temperature">Temperature</ToggleButton>
        <ToggleButton value="alarm">Alarm</ToggleButton>
      </ToggleButtonGroup>

      { tapConfig.type === 'temperature' && (
        <Box sx={ { display: 'flex', gap: 1 } }>
          <ToggleButtonGroup
            disabled={ isUpdating }
            size="small"
            value={ tapConfig.change }
            exclusive
            onChange={ (_, newChange: TemperatureTapConfig['change'] | null) => {
              if (newChange !== null) onChange({ ...tapConfig, change: newChange });
            } }
            aria-label={ `${label} temperature direction` }
            sx={ { ...toggleGroupSx, flex: 1 } }
          >
            <ToggleButton value="decrement">Cooler</ToggleButton>
            <ToggleButton value="increment">Warmer</ToggleButton>
          </ToggleButtonGroup>
          <TextField
            select
            label="By"
            size="small"
            value={ tapConfig.amount }
            onChange={ (event) => onChange({ ...tapConfig, amount: Number(event.target.value) }) }
            disabled={ isUpdating }
            sx={ { width: 96, flexShrink: 0 } }
          >
            { TEMPERATURE_AMOUNTS_F.map(amount => (
              <MenuItem key={ amount } value={ amount }>{ formatTemperatureDelta(amount, displayCelsius) }</MenuItem>
            )) }
          </TextField>
        </Box>
      ) }

      { tapConfig.type === 'alarm' && (
        <>
          <Box sx={ { display: 'flex', gap: 1 } }>
            <ToggleButtonGroup
              disabled={ isUpdating }
              size="small"
              value={ tapConfig.behavior }
              exclusive
              onChange={ (_, newBehavior: AlarmTapConfig['behavior'] | null) => {
                if (newBehavior !== null) onChange({ ...tapConfig, behavior: newBehavior });
              } }
              aria-label={ `${label} alarm behavior` }
              sx={ { ...toggleGroupSx, flex: 1 } }
            >
              <ToggleButton value="dismiss">Dismiss</ToggleButton>
              <ToggleButton value="snooze">Snooze</ToggleButton>
            </ToggleButtonGroup>
            <TextField
              select
              label="Snooze for"
              size="small"
              value={ Math.round(tapConfig.snoozeDuration / SECONDS_PER_MINUTE) }
              onChange={ (event) => onChange({ ...tapConfig, snoozeDuration: Number(event.target.value) * SECONDS_PER_MINUTE }) }
              disabled={ isUpdating || tapConfig.behavior !== 'snooze' }
              sx={ { width: 96, flexShrink: 0 } }
            >
              { SNOOZE_MINUTES.map(minutes => (
                <MenuItem key={ minutes } value={ minutes }>{ minutes } min</MenuItem>
              )) }
            </TextField>
          </Box>
          <SettingToggle
            label="Toggle power when no alarm is going off"
            control={
              <Switch
                disabled={ isUpdating }
                checked={ tapConfig.inactiveAlarmBehavior === 'power' }
                onChange={ (event) => onChange({ ...tapConfig, inactiveAlarmBehavior: event.target.checked ? 'power' : 'none' }) }
              />
            }
          />
        </>
      ) }
    </Box>
  );
}
