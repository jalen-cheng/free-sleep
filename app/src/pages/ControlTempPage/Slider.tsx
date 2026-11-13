import { CircularSliderWithChildren } from 'react-circular-slider-svg';
import { Box, Typography } from '@mui/material';
import { useAppStore } from '@state/appStore';
import styles from './Slider.module.scss';
import TemperatureLabel from './TemperatureLabel.tsx';
import TemperatureButtons from './TemperatureButtons.tsx';
import { useControlTempStore } from './controlTempStore.tsx';
import { useTargetTemperature } from './useTargetTemperature.ts';
import { useTheme } from '@mui/material/styles';
import { useResizeDetector } from 'react-resize-detector';
import { useSettings } from '@api/settings.ts';
import { useTemperatureFormat } from '@lib/useTemperatureFormat.ts';
import {
  MAX_TEMP_F, MIN_TEMP_F, formatTemperature, getTemperatureColor,
} from '@lib/temperatureConversions.ts';

type SliderProps = {
  isOn: boolean;
  currentTargetTemp: number;
  currentTemperatureF: number;
  refetch: () => Promise<unknown>;
}

// Labels for the two ends of the dial, placed just under where the arc stops
const rangeLabelSx = { position: 'absolute', top: '72%', color: 'text.secondary', pointerEvents: 'none' };

export default function Slider({ isOn, currentTargetTemp, refetch, currentTemperatureF }: SliderProps) {
  const deviceStatus = useControlTempStore(state => state.deviceStatus);
  const { isUpdating, side } = useAppStore();
  const { data: settings } = useSettings();
  const temperatureFormat = useTemperatureFormat();
  const { previewTargetTemperature, commitTargetTemperature, stepTargetTemperature } = useTargetTemperature(refetch);
  const isInAwayMode = settings?.[side]?.awayMode;
  const disabled = isUpdating || isInAwayMode || !isOn;
  const { width, ref } = useResizeDetector();
  const theme = useTheme();
  const sideStatus = deviceStatus?.[side];
  const targetTemperatureF = sideStatus?.targetTemperatureF ?? currentTargetTemp;
  const sliderColor = getTemperatureColor(sideStatus?.targetTemperatureF);
  const arcBackgroundColor = theme.palette.divider;

  // The arc is drawn between the bed's current temperature and the target, so the dial has two
  // handles. The stylesheet hides whichever one sits on the current temperature.
  const minTemp = Math.min(sideStatus?.currentTemperatureF || MIN_TEMP_F, targetTemperatureF);
  const maxTemp = Math.max(sideStatus?.currentTemperatureF || MIN_TEMP_F, targetTemperatureF);
  const isHeating = (sideStatus?.currentTemperatureF ?? MIN_TEMP_F) < targetTemperatureF;

  const handleDrag = (value: number) => {
    if (!disabled) previewTargetTemperature(value);
  };

  return (
    <div
      ref={ ref }
      style={ { position: 'relative', display: 'inline-block', width: '100%', maxWidth: '320px' } }
    >
      { /* The dial is square, and its labels and buttons are placed over the open bottom of the arc */ }
      <div style={ { position: 'relative' } }>
        { /* Circular Slider */ }
        <div className={ `${styles.Slider} ${disabled && styles.Disabled} ${isHeating && styles.Heating}` }>
          <CircularSliderWithChildren
            disabled={ disabled }
            onControlFinished={ () => void commitTargetTemperature() }
            size={ width ?? 280 }
            trackWidth={ 7 }
            minValue={ MIN_TEMP_F }
            maxValue={ MAX_TEMP_F }
            startAngle={ 60 }
            endAngle={ 300 }
            angleType={ {
              direction: 'cw',
              axis: '-y'
            } }
            handle1={ { value: minTemp, onChange: handleDrag } }
            arcColor={ isOn ? sliderColor : arcBackgroundColor }
            arcBackgroundColor={ arcBackgroundColor }
            handle2={ { value: maxTemp, onChange: handleDrag } }
            handleSize={ 11 }
          >
            <TemperatureLabel
              isOn={ isOn }
              sliderTemp={ targetTemperatureF }
              sliderColor={ sliderColor }
              currentTargetTemp={ currentTargetTemp }
              currentTemperatureF={ currentTemperatureF }
              temperatureFormat={ temperatureFormat }
            />
          </CircularSliderWithChildren>
        </div>
        { isOn && (
          <>
            <Typography variant="caption" sx={ { ...rangeLabelSx, left: 0 } }>
              { formatTemperature(MIN_TEMP_F, temperatureFormat) }
            </Typography>
            <Typography variant="caption" sx={ { ...rangeLabelSx, right: 0 } }>
              { formatTemperature(MAX_TEMP_F, temperatureFormat) }
            </Typography>
          </>
        ) }
        { isOn && !isInAwayMode && (
          <TemperatureButtons
            targetTemperatureF={ targetTemperatureF }
            temperatureFormat={ temperatureFormat }
            disabled={ isUpdating }
            onStep={ stepTargetTemperature }
          />
        ) }
      </div>
      { isOn && (
        <Box sx={ { textAlign: 'center', mb: 1.5 } }>
          <Typography variant="caption" sx={ { color: 'text.secondary' } }>
            { /* Shows the target in the other scale, so levels and degrees can be matched up */ }
            { temperatureFormat === 'level'
              ? `About ${formatTemperature(targetTemperatureF, 'fahrenheit')}`
              : `About ${formatTemperature(targetTemperatureF, 'level')} in the Eight Sleep app` }
          </Typography>
        </Box>
      ) }
    </div>
  );
};
