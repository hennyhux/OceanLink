import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation } from 'react-router';

import { ForbiddenPage, PlaceholderPage } from '@/components/MessagePages';
import { ErrorState } from '@/components/States';

import type { StaffRole } from './types';
import { useAuth } from './useAuth';

function FullPageLoading() {
  const { t } = useTranslation();
  return (
    <Box role="status" sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center', gap: 2 }}>
      <CircularProgress aria-hidden />
      <Typography>{t('common.loading')}</Typography>
    </Box>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === 'loading') return <FullPageLoading />;
  if (auth.status === 'error') {
    return (
      <ErrorState
        title={t('auth.checkFailedTitle')}
        body={t('auth.checkFailedBody')}
        onRetry={auth.retry}
      />
    );
  }
  if (auth.status === 'signedOut') {
    const returnTo = `${location.pathname}${location.search}`;
    const search = returnTo !== '/' ? `?returnTo=${encodeURIComponent(returnTo)}` : '';
    return <Navigate to={`/login${search}`} replace />;
  }
  return <>{children}</>;
}

// Staff with a temporary password must change it before seeing business data.
export function RequirePasswordCurrent({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.must_change_password) {
    return (
      <PlaceholderPage titleKey="auth.changePasswordTitle" purposeKey="auth.changePasswordBody" />
    );
  }
  return <>{children}</>;
}

// Hiding a page is a convenience. The backend still checks every request.
export function RequireRole({ role, children }: { role: StaffRole; children: ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== role) return <ForbiddenPage />;
  return <>{children}</>;
}

export { FullPageLoading };
