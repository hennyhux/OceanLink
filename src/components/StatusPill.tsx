import Box from '@mui/material/Box';

import { tokens } from '@/app/theme';

export type PillTone = 'success' | 'neutral' | 'danger' | 'warning' | 'info';

const TONES: Record<PillTone, { color: string; background: string }> = {
  success: { color: tokens.success, background: tokens.successTint },
  neutral: { color: tokens.textSecondary, background: tokens.page },
  danger: { color: tokens.error, background: tokens.errorTint },
  warning: { color: tokens.warning, background: tokens.warningTint },
  info: { color: tokens.primaryDark, background: tokens.primaryTint },
};

// A status always shows its word, never only a color.
export function StatusPill({ label, tone }: { label: string; tone: PillTone }) {
  const colors = TONES[tone];
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1.25,
        py: 0.25,
        minHeight: 28,
        borderRadius: 999,
        border: 1,
        borderColor: colors.color,
        color: colors.color,
        bgcolor: colors.background,
        fontSize: '0.875rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        lineHeight: 1.4,
      }}
    >
      <Box
        component="span"
        aria-hidden
        sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: colors.color, flexShrink: 0 }}
      />
      {label}
    </Box>
  );
}
