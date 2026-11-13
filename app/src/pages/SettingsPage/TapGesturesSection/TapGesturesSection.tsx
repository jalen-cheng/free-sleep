import { Fragment } from 'react';
import { Box, Divider, Typography } from '@mui/material';
import TouchAppOutlinedIcon from '@mui/icons-material/TouchAppOutlined';
import { DeepPartial } from 'ts-essentials';

import { useDeviceStatus } from '@api/deviceStatus.ts';
import { Version } from '@api/deviceStatusSchema.ts';
import { Gesture, GestureSchema, Settings } from '@api/settingsSchema.ts';
import { Side } from '@state/appStore.tsx';
import Section from '../Section.tsx';
import SettingsHint from '../SettingsHint.tsx';
import TapGestureControl from './TapGestureControl.tsx';

const SIDES: Side[] = ['left', 'right'];
const GESTURE_LABELS: Record<Gesture, string> = {
  doubleTap: 'Double tap',
  tripleTap: 'Triple tap',
  quadTap: 'Quadruple tap',
};

type TapGesturesSectionProps = {
  settings?: Settings;
  updateSettings: (settings: DeepPartial<Settings>) => void;
}

// Per-side configuration of what tapping the side of the bed does. Pod 3 covers have no tap sensors.
export default function TapGesturesSection({ settings, updateSettings }: TapGesturesSectionProps) {
  const { data: deviceStatus } = useDeviceStatus();
  if (!settings || !deviceStatus || deviceStatus.coverVersion === Version.Pod3) return null;

  return (
    <Section title="Tap gestures" icon={ <TouchAppOutlinedIcon/> }>
      <Box sx={ { display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5 } }>
        { SIDES.map(side => (
          <Box
            key={ side }
            sx={ {
              display: 'flex', flexDirection: 'column', gap: 1.5, p: 2,
              border: '1px solid', borderColor: 'divider', borderRadius: 1, minWidth: 0,
            } }
          >
            <Typography component="h3" variant="h6" sx={ { fontSize: 13 } }>{ settings[side].name }</Typography>
            { GestureSchema.options.map((gesture, gestureIndex) => (
              <Fragment key={ gesture }>
                { gestureIndex > 0 && <Divider/> }
                <TapGestureControl
                  label={ GESTURE_LABELS[gesture] }
                  tapConfig={ settings[side].taps[gesture] }
                  onChange={ (tapConfig) => updateSettings({ [side]: { taps: { [gesture]: tapConfig } } }) }
                />
              </Fragment>
            )) }
          </Box>
        )) }
      </Box>
      <Box sx={ { mt: 2 } }>
        <SettingsHint>
          Tap the side of the bed, near where you sleep.
          Alarm taps dismiss or snooze an alarm while it is vibrating.
          Temperature steps are always in °F.
        </SettingsHint>
      </Box>
    </Section>
  );
}
