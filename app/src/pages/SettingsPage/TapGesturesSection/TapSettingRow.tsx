import { PropsWithChildren } from 'react';
import { Box, Typography } from '@mui/material';

type TapSettingRowProps = PropsWithChildren<{
  // The gesture, e.g. "Double tap"
  gesture: string;
  // What the gesture does, e.g. "Cooler"
  action: string;
}>;

// One line of the tap settings: the gesture and what it does on the left, its control on the right.
// On phones the control drops under the text.
export default function TapSettingRow({ gesture, action, children }: TapSettingRowProps) {
  return (
    <Box
      sx={ {
        display: 'flex', flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between', gap: { xs: 1, sm: 2 },
      } }
    >
      <Box sx={ { minWidth: 0 } }>
        <Typography variant="body2" sx={ { fontWeight: 500 } }>{ gesture }</Typography>
        <Typography variant="caption" sx={ { color: 'text.secondary' } }>{ action }</Typography>
      </Box>
      { children && <Box sx={ { display: 'flex', gap: 1, flexShrink: 0 } }>{ children }</Box> }
    </Box>
  );
}
