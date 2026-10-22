import AddIcon from '@mui/icons-material/Add';
import Fab from '@mui/material/Fab';
import Tooltip from '@mui/material/Tooltip';
import { useTheme } from '@mui/material/styles';
import { Link as RouterLink } from 'react-router';

type MobilePrimaryActionProps = {
  label: string;
  hideAt?: 'md' | 'lg';
} & ({ to: string; onClick?: never } | { to?: never; onClick: () => void });

export function MobilePrimaryAction({
  label,
  to,
  onClick,
  hideAt = 'md',
}: MobilePrimaryActionProps) {
  const theme = useTheme();
  const sx = {
    display:
      hideAt === 'md' ? { xs: 'inline-flex', md: 'none' } : { xs: 'inline-flex', lg: 'none' },
    position: 'fixed',
    right: '16px',
    bottom: 'calc(16px + env(safe-area-inset-bottom))',
    zIndex: theme.zIndex.speedDial,
  } as const;
  const button = to ? (
    <Fab component={RouterLink} to={to} color="primary" aria-label={label} sx={sx}>
      <AddIcon />
    </Fab>
  ) : (
    <Fab onClick={onClick} color="primary" aria-label={label} sx={sx}>
      <AddIcon />
    </Fab>
  );

  return (
    <Tooltip title={label} placement="top">
      {button}
    </Tooltip>
  );
}
