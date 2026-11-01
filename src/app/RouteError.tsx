import Box from '@mui/material/Box';
import { useTranslation } from 'react-i18next';
import { isRouteErrorResponse, useRouteError } from 'react-router';

import { NotFoundPage } from '@/components/MessagePages';
import { ErrorState } from '@/components/States';

// Shown when a page crashes or its code fails to download (for example after a deploy).
export function RouteError() {
  const { t } = useTranslation();
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  return (
    <Box sx={{ p: 4 }}>
      <ErrorState
        title={t('errors.crashTitle')}
        body={t('errors.crashBody')}
        retryLabel={t('errors.reload')}
        onRetry={() => window.location.reload()}
      />
    </Box>
  );
}
