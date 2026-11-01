import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';

import { IconTile } from '@/components/IconTile';

import type { CardState } from './cardState';

// Loading and error states for one card. A failed card never shows made-up numbers.
export function CardBody({
  state,
  rows = 3,
  children,
}: {
  state: CardState;
  rows?: number;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  if (state.hasData) return <>{children}</>;
  if (state.isError) {
    return (
      <Stack role="alert" spacing={1} alignItems="flex-start">
        <Typography color="text.secondary">{t('overview.cardFailed')}</Typography>
        <Button size="small" variant="outlined" onClick={state.onRetry}>
          {t('common.retry')}
        </Button>
      </Stack>
    );
  }
  return (
    <Stack spacing={1} role="status" aria-label={t('common.loading')}>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} variant="rounded" height={28} />
      ))}
    </Stack>
  );
}

interface DashboardCardProps {
  title: string;
  icon?: ReactNode;
  footer?: { label: string; to: string };
  children: ReactNode;
}

export function DashboardCard({ title, icon, footer, children }: DashboardCardProps) {
  const headingId = useId();
  return (
    <Paper
      component="section"
      variant="outlined"
      aria-labelledby={headingId}
      sx={{ p: { xs: 2, sm: 3 }, height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: { xs: 1.5, sm: 2 } }}>
        {icon && (
          // The icon is decoration; on phones the width goes to the text instead.
          <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
            <IconTile>{icon}</IconTile>
          </Box>
        )}
        <Typography id={headingId} component="h2" variant="h3">
          {title}
        </Typography>
      </Box>
      <Box sx={{ flex: 1 }}>{children}</Box>
      {footer && (
        <Box sx={{ mt: 2, pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
          <Link
            component={RouterLink}
            to={footer.to}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              fontWeight: 600,
              minHeight: 44,
            }}
          >
            {footer.label}
            <ArrowForwardIcon fontSize="small" aria-hidden />
          </Link>
        </Box>
      )}
    </Paper>
  );
}
