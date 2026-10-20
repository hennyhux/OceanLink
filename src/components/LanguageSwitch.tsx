import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { useTranslation } from 'react-i18next';

import { changeLanguage, isLanguage, SUPPORTED_LANGUAGES } from '@/lib/i18n';

// A toggle, not a select, so both choices are always visible.
export function LanguageSwitch() {
  const { t, i18n } = useTranslation();
  const current = isLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : 'zh-CN';

  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={current}
      aria-label={t('language.switchTo')}
      onChange={(_event, next: unknown) => {
        if (isLanguage(next) && next !== current) void changeLanguage(next);
      }}
    >
      {SUPPORTED_LANGUAGES.map((lang) => (
        <ToggleButton
          key={lang}
          value={lang}
          aria-label={t(`language.${lang}`)}
          sx={{ px: { xs: 1.25, sm: 2 }, whiteSpace: 'nowrap' }}
        >
          {t(`language.${lang}`)}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
