import Chip from '@mui/material/Chip';
import { useTranslation } from 'react-i18next';

// Status is shown as text plus color, never color alone.
export function ActiveStatusChip({
  isActive,
  subtle = false,
}: {
  isActive: boolean;
  subtle?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Chip
      size="small"
      variant={subtle ? 'outlined' : isActive ? 'filled' : 'outlined'}
      color={subtle ? 'default' : isActive ? 'success' : 'default'}
      label={isActive ? t('common.status.active') : t('common.status.inactive')}
      sx={
        subtle
          ? { bgcolor: 'action.hover', borderColor: 'divider', color: 'text.secondary' }
          : undefined
      }
    />
  );
}
