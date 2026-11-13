import { useTheme } from '@mui/material/styles';
import { Button, Box, Typography } from '@mui/material';
import { Add, Remove } from '@mui/icons-material';
import { MIN_TEMP_F, MAX_TEMP_F, formatTemperatureDelta } from '@lib/temperatureConversions.ts';

// How far one press of + or - moves the target
export const BUTTON_STEP_F = 1;

type TemperatureButtonsProps = {
  // The target shown on screen, which may be ahead of what the Pod has confirmed
  targetTemperatureF: number;
  displayCelsius: boolean;
  disabled: boolean;
  onStep: (changeF: number) => void;
}

// The - and + buttons under the dial, with the size of one step shown between them
export default function TemperatureButtons({ targetTemperatureF, displayCelsius, disabled, onStep }: TemperatureButtonsProps) {
  const theme = useTheme();
  const iconColor = theme.palette.text.primary;

  const buttonStyle = {
    borderWidth: '1px',
    borderColor: theme.palette.divider,
    width: 48,
    height: 48,
    borderRadius: '50%',
    minWidth: 0,
    padding: 0,
  };

  return (
    <Box
      sx={ {
        top: '78%',
        position: 'absolute',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        marginLeft: 'auto',
        marginRight: 'auto',
      } }
    >
      <Button
        variant="outlined"
        color="primary"
        aria-label="Decrease temperature"
        sx={ buttonStyle }
        onClick={ () => onStep(-BUTTON_STEP_F) }
        disabled={ disabled || targetTemperatureF <= MIN_TEMP_F }
      >
        <Remove sx={ { color: iconColor } }/>
      </Button>
      <Typography variant="caption" sx={ { width: 88, textAlign: 'center', color: 'text.secondary' } }>
        { formatTemperatureDelta(BUTTON_STEP_F, displayCelsius) } steps
      </Typography>
      <Button
        variant="outlined"
        aria-label="Increase temperature"
        sx={ buttonStyle }
        onClick={ () => onStep(BUTTON_STEP_F) }
        disabled={ disabled || targetTemperatureF >= MAX_TEMP_F }
      >
        <Add sx={ { color: iconColor } }/>
      </Button>
    </Box>
  );
}
