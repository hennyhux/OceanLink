import { useTranslation } from 'react-i18next';
import { useNavigate, useRouteError } from 'react-router';

import { ErrorState } from './ErrorState';

// Catches render errors so the user never sees the router's default English page.
export function RouteErrorBoundary() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const error = useRouteError();

  if (import.meta.env.DEV) {
    console.error(error);
  }

  return (
    <ErrorState
      title={t('app.crashed.title')}
      body={t('app.crashed.body')}
      actionLabel={t('app.goToOverview')}
      onAction={() => void navigate('/', { replace: true })}
      fullPage
    />
  );
}
