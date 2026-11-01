import Box from '@mui/material/Box';
import { useTranslation } from 'react-i18next';

import { visuallyHidden } from '@/lib/a11y';
import { balanceLabelKey, balanceTone } from '@/lib/display';
import { formatMoney } from '@/lib/money';

export type MoneyTone = 'neutral' | 'owed' | 'credit';

const COLORS: Record<MoneyTone, string> = {
  neutral: 'text.primary',
  owed: 'error.main',
  credit: 'success.main',
};

const SIZES = {
  body: { fontSize: 'inherit', fontWeight: 600 },
  kpi: { fontSize: { xs: '1.375rem', sm: '1.75rem' }, fontWeight: 700, lineHeight: 1.2 },
  hero: { fontSize: { xs: '2rem', sm: '2.25rem' }, fontWeight: 700, lineHeight: 1.15 },
} as const;

interface MoneyProps {
  cents: number;
  tone?: MoneyTone;
  size?: keyof typeof SIZES;
  // Read before the amount by screen readers, for example "Owes".
  srLabel?: string;
  component?: 'span' | 'p' | 'dd' | 'div';
}

// Shows an amount in USD. Totals always come from the API; this only formats them.
export function Money({
  cents,
  tone = 'neutral',
  size = 'body',
  srLabel,
  component = 'span',
}: MoneyProps) {
  const { i18n } = useTranslation();
  return (
    <Box
      component={component}
      sx={{
        m: 0,
        color: COLORS[tone],
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
        ...SIZES[size],
      }}
    >
      {srLabel && (
        <Box component="span" sx={visuallyHidden}>
          {srLabel}:{' '}
        </Box>
      )}
      {formatMoney(cents, i18n.resolvedLanguage ?? 'en')}
    </Box>
  );
}

interface BalanceProps {
  cents: number;
  size?: keyof typeof SIZES;
  showLabel?: boolean;
}

// A balance with its meaning in words, so color is never the only signal.
// Credit always shows its word; an amount owed is red with "Owes" for screen readers.
export function Balance({ cents, size = 'body', showLabel = false }: BalanceProps) {
  const { t } = useTranslation();
  const label = t(balanceLabelKey(cents));
  const visible = showLabel || cents < 0;
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 0.75,
        flexWrap: 'wrap',
        justifyContent: 'inherit',
      }}
    >
      {visible && (
        <Box
          component="span"
          sx={{
            color: cents < 0 ? 'success.main' : 'text.secondary',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          {label}
        </Box>
      )}
      <Money
        cents={Math.abs(cents)}
        tone={balanceTone(cents)}
        size={size}
        srLabel={visible ? undefined : label}
      />
    </Box>
  );
}
