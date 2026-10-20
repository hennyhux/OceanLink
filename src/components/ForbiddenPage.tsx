import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { ErrorState } from './ErrorState';

export function ForbiddenPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <ErrorState
      title={t('forbidden.title')}
      body={t('forbidden.body')}
      actionLabel={t('app.goToOverview')}
      onAction={() => void navigate('/', { replace: true })}
    />
  );
}
