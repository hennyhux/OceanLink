import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { visuallyHidden } from '@/lib/a11y';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export function EmptyState({
  message,
  action,
  icon = <InboxOutlinedIcon />,
}: {
  message: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Stack alignItems="center" spacing={1.5} sx={{ py: 5, px: 2, textAlign: 'center' }}>
      <Box aria-hidden sx={{ color: 'text.secondary', '& svg': { fontSize: 40 } }}>
        {icon}
      </Box>
      <Typography sx={{ maxWidth: '48ch' }}>{message}</Typography>
      {action}
    </Stack>
  );
}

interface ErrorStateProps {
  title?: string;
  body?: string;
  onRetry?: () => void;
  retryLabel?: string;
  requestId?: string;
}

// Says what failed and offers a way forward. Never stands in for a zero.
export function ErrorState({ title, body, onRetry, retryLabel, requestId }: ErrorStateProps) {
  const { t } = useTranslation();
  return (
    <Stack
      role="alert"
      alignItems="center"
      spacing={1.5}
      sx={{ py: 5, px: 2, textAlign: 'center' }}
    >
      <Box aria-hidden sx={{ color: 'error.main', '& svg': { fontSize: 40 } }}>
        <ErrorOutlineIcon />
      </Box>
      <Typography component="h2" variant="h3">
        {title ?? t('errors.loadTitle')}
      </Typography>
      <Typography sx={{ maxWidth: '56ch' }}>{body ?? t('errors.loadBody')}</Typography>
      {onRetry && (
        <Button variant="contained" onClick={onRetry}>
          {retryLabel ?? t('common.retry')}
        </Button>
      )}
      {requestId && (
        <Typography variant="caption" color="text.secondary">
          {t('errors.problemNumber', { id: requestId })}
        </Typography>
      )}
    </Stack>
  );
}

export function LoadingState({ rows = 4, label }: { rows?: number; label?: string }) {
  const { t } = useTranslation();
  return (
    <Box role="status" aria-live="polite" sx={{ py: 1 }}>
      <Typography sx={visuallyHidden}>{label ?? t('common.loading')}</Typography>
      <Stack spacing={1.5}>
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} variant="rounded" height={48} />
        ))}
      </Stack>
    </Box>
  );
}
