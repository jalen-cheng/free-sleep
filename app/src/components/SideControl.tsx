import { Box, ToggleButtonGroup, ToggleButton, Typography } from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import { useAppStore } from '@state/appStore.tsx';
import { useSettings } from '@api/settings.ts';
import { useDeviceStatus } from '@api/deviceStatus.ts';
import { formatTemperature } from '@lib/temperatureConversions.ts';

type SideControlProps = {
  showTemp?: boolean;
  // What linking the sides means on this page, shown while they are linked
  linkedHint?: string;
  // Called after the link is switched on or off, for pages that need to act on it right away
  onLinkSidesChange?: (linkSides: boolean) => void;
};

// Picks the side being viewed, with a button to link both sides so changes apply to the whole bed
export default function SideControl({ showTemp, linkedHint, onLinkSidesChange }: SideControlProps) {
  const { side, setSide, linkSides, setLinkSides, isUpdating } = useAppStore();
  const { data: settings } = useSettings();
  const { data: deviceStatus } = useDeviceStatus();
  const isCelsius = settings?.temperatureFormat === 'celsius';

  const handleLinkToggle = () => {
    const nextLinkSides = !linkSides;
    setLinkSides(nextLinkSides);
    onLinkSidesChange?.(nextLinkSides);
  };

  return (
    <Box sx={ { display: 'flex', flexDirection: 'column', gap: 0.75 } }>
      <Box sx={ { display: 'flex', gap: 1 } }>
        <ToggleButtonGroup
          exclusive
          value={ side }
          onChange={ (_, selectedSide: unknown) => {
            if (selectedSide === 'left' || selectedSide === 'right') setSide(selectedSide);
          } }
          size="small"
          aria-label="Bed side"
          sx={ { flex: 1, minWidth: 0, '& .MuiToggleButton-root': { flex: 1, minWidth: 0 } } }
        >
          { (['left', 'right'] as const).map(bedSide => (
            <ToggleButton key={ bedSide } value={ bedSide } aria-label={ `${bedSide} side` }>
              <Box component="span" sx={ { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, minWidth: 0 } }>
                <Typography component="span" variant="body2" sx={ { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }>
                  { settings?.[bedSide]?.name || `${bedSide === 'left' ? 'Left' : 'Right'} side` }
                </Typography>
                { showTemp && side !== bedSide && (
                  <Typography component="span" variant="caption" sx={ { color: 'text.secondary', flexShrink: 0 } }>
                    { deviceStatus?.[bedSide]?.isOn ? formatTemperature(deviceStatus[bedSide].targetTemperatureF, isCelsius) : 'Off' }
                  </Typography>
                ) }
              </Box>
            </ToggleButton>
          )) }
        </ToggleButtonGroup>
        <ToggleButton
          value="linkSides"
          size="small"
          color="primary"
          selected={ linkSides }
          disabled={ isUpdating }
          onChange={ handleLinkToggle }
          aria-label={ linkSides ? 'Unlink sides' : 'Link both sides' }
          sx={ { gap: 0.75, px: 1.5, flexShrink: 0 } }
        >
          { linkSides ? <LinkIcon fontSize="small"/> : <LinkOffIcon fontSize="small"/> }
          { /* Icon only on phones, where the side names need the room */ }
          <Typography component="span" variant="body2" sx={ { display: { xs: 'none', sm: 'inline' } } }>
            { linkSides ? 'Linked' : 'Link sides' }
          </Typography>
        </ToggleButton>
      </Box>
      { linkSides && linkedHint && (
        <Typography variant="caption" sx={ { color: 'text.secondary', textAlign: 'center' } }>{ linkedHint }</Typography>
      ) }
    </Box>
  );
}
