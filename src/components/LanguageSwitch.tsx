import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { useTranslation } from 'react-i18next';

import { changeLanguage, isLanguage } from '@/lib/i18n';

export function LanguageSwitch() {
  const { t, i18n } = useTranslation();
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={i18n.resolvedLanguage}
      onChange={(_event, value: unknown) => {
        if (isLanguage(value)) void changeLanguage(value);
      }}
      aria-label={t('shell.language')}
    >
      <ToggleButton value="en" lang="en" sx={{ px: 1.5, minHeight: 40, fontWeight: 600 }}>
        EN
      </ToggleButton>
      <ToggleButton value="zh-CN" lang="zh-CN" sx={{ px: 1.5, minHeight: 40, fontWeight: 600 }}>
        中文
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
