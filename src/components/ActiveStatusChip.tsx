import Chip from '@mui/material/Chip';
import { useTranslation } from 'react-i18next';

// Status is shown as text plus color, never color alone.
export function ActiveStatusChip({ isActive }: { isActive: boolean }) {
  const { t } = useTranslation();
  return (
    <Chip
      size="small"
      variant={isActive ? 'filled' : 'outlined'}
      color={isActive ? 'success' : 'default'}
      label={isActive ? t('common.status.active') : t('common.status.inactive')}
    />
  );
}
