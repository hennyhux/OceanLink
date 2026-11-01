import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Fab from '@mui/material/Fab';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router';

export interface PrimaryAction {
  label: string;
  icon: ReactNode;
  to?: string;
  onClick?: () => void;
  disabled?: boolean;
}

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  status?: ReactNode;
  // Labeled button on wide screens, round floating button on narrow ones.
  primaryAction?: PrimaryAction;
  secondaryActions?: ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  leading,
  status,
  primaryAction,
  secondaryActions,
}: PageHeaderProps) {
  const theme = useTheme();
  const narrow = useMediaQuery(theme.breakpoints.down('md'));
  const linkProps = primaryAction?.to ? { component: RouterLink, to: primaryAction.to } : {};

  return (
    <Box
      component="header"
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        mb: 3,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0, flex: '1 1 320px' }}>
        {leading}
        <Box sx={{ minWidth: 0 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              columnGap: 1.5,
              rowGap: 0.5,
            }}
          >
            <Typography variant="h1" sx={{ overflowWrap: 'anywhere' }}>
              {title}
            </Typography>
            {status}
          </Box>
          {subtitle && (
            <Typography color="text.secondary" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>
              {subtitle}
            </Typography>
          )}
        </Box>
      </Box>
      {(primaryAction || secondaryActions) && (
        <Stack direction="row" flexWrap="wrap" gap={1.5} sx={{ flexShrink: 0 }}>
          {secondaryActions}
          {primaryAction && !narrow && (
            <Button
              variant="contained"
              size="large"
              startIcon={primaryAction.icon}
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
              {...linkProps}
            >
              {primaryAction.label}
            </Button>
          )}
        </Stack>
      )}
      {primaryAction && narrow && (
        <Fab
          color="primary"
          aria-label={primaryAction.label}
          title={primaryAction.label}
          onClick={primaryAction.onClick}
          disabled={primaryAction.disabled}
          {...linkProps}
          sx={{ position: 'fixed', right: 20, bottom: 20, zIndex: (t) => t.zIndex.speedDial }}
        >
          {primaryAction.icon}
        </Fab>
      )}
    </Box>
  );
}
