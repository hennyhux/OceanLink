import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { ErrorState } from './ErrorState';

export function NotFoundPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <ErrorState
      title={t('notFound.title')}
      body={t('notFound.body')}
      actionLabel={t('app.goToOverview')}
      onAction={() => void navigate('/', { replace: true })}
    />
  );
}
