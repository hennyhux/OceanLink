import { useTranslation } from 'react-i18next';

import { StatusPill } from './StatusPill';

export function ActiveStatus({ isActive }: { isActive: boolean }) {
  const { t } = useTranslation();
  return isActive ? (
    <StatusPill tone="success" label={t('status.active')} />
  ) : (
    <StatusPill tone="neutral" label={t('status.inactive')} />
  );
}
