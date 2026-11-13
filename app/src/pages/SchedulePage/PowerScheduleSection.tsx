import { Box, InputAdornment, Paper, Slider, TextField, Typography } from '@mui/material';
import { useAppStore } from '@state/appStore.tsx';
import { useScheduleStore } from './scheduleStore.tsx';
import {
  TemperatureFormat, describeTemperature, formatTemperature, getTemperatureColor, snapTemperature, MAX_TEMP_F, MIN_TEMP_F,
} from '@lib/temperatureConversions.ts';
import PowerOffTime from './PowerOffTime.tsx';
import AccessTime from '@mui/icons-material/AccessTime';
import { useTheme } from '@mui/material/styles';

export default function PowerScheduleSection({ temperatureFormat }: { temperatureFormat: TemperatureFormat }) {
  const { isUpdating } = useAppStore();
  const theme = useTheme();
  const { selectedSchedule, updateSelectedSchedule } = useScheduleStore();
  const disabled = !selectedSchedule?.power.enabled || isUpdating;
  const onTemperatureValue = selectedSchedule?.power?.onTemperature || 82;
  return (
    <Paper elevation={ 2 } sx={ { p: { xs: 2.5, sm: 3 }, width: '100%' } }>
      <Box sx={ { display: 'flex', alignItems: 'center', gap: 3, p: 0, width: '100%', mb: 3 } }>
        { /* Start time */ }
        <TextField
          label="Power on"
          type="time"
          variant="standard"
          value={ selectedSchedule?.power.on || '21:00' }
          disabled={ disabled }
          onChange={ (event) => {
            updateSelectedSchedule({
              power: {
                on: event.target.value,
              }
            });
          } }
          sx={ {
            width: '110px',
            // Hide native indicator (where it exists)
            '& input::-webkit-calendar-picker-indicator': {
              opacity: 0,
              display: 'none',
            },
          } }
          slotProps={ {
            input: {
              endAdornment: (
                <InputAdornment position="end" sx={ { cursor: 'pointer' } } >
                  <AccessTime sx={ { color: theme.palette.grey[500] } } fontSize='small'/>
                </InputAdornment>
              ),
            }
          } }
        />
        <PowerOffTime/>
      </Box>
      { /* Temperature slider */ }
      <Box sx={ { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, flex: 1, pr: 1 } }>
        { /* Temperature label */ }
        <Typography variant="body2" sx={ { color: 'text.primary', mb: 0, textAlign: 'center' } }>
          { `Power on temperature ${describeTemperature(onTemperatureValue, temperatureFormat)}` }
        </Typography>
        <Slider
          value={ onTemperatureValue }

          onChange={ (_, newValue) => {
            updateSelectedSchedule({
              power: {
                // Snapped so that, in levels, the slider only stops on whole levels
                onTemperature: snapTemperature(newValue as number, temperatureFormat)
              }
            });
          } }
          min={ MIN_TEMP_F }
          max={ MAX_TEMP_F }
          step={ 1 }
          marks={ [
            { value: MIN_TEMP_F, label: formatTemperature(MIN_TEMP_F, temperatureFormat) },
            { value: MAX_TEMP_F, label: formatTemperature(MAX_TEMP_F, temperatureFormat) },
          ] }
          disabled={ disabled }
          sx={ {
            color: getTemperatureColor(onTemperatureValue), // red track and thumb
            width: '100%',
            // ✅ label font color
            '& .MuiSlider-markLabel': {
              color: theme.palette.grey[500], // <--- your color here
              fontSize: '0.75rem', // optional
              fontWeight: 500, // optional
            },
          } }
        />
      </Box>
    </Paper>
  );
}
