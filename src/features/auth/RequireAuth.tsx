import { Navigate, Outlet, useLocation } from 'react-router';

import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { useTranslation } from 'react-i18next';

import { useAuth } from './useAuth';

export function RequireAuth() {
  const { status, recheck } = useAuth();
  const location = useLocation();
  const { t } = useTranslation();

  if (status === 'checking') {
    return <LoadingState label={t('auth.sessionCheck.title')} fullPage />;
  }

  if (status === 'unavailable') {
    // The server could not be reached. Do not assume the user is signed out.
    return (
      <ErrorState
        title={t('auth.sessionCheck.failedTitle')}
        body={t('auth.sessionCheck.failedBody')}
        actionLabel={t('app.retry')}
        onAction={() => void recheck()}
        fullPage
      />
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
