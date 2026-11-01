import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export interface KeyValue {
  label: string;
  value: ReactNode;
  wide?: boolean;
}

// Label above value. Empty values say "Not provided" instead of leaving a blank.
export function KeyValueList({ items, columns = 2 }: { items: KeyValue[]; columns?: 1 | 2 }) {
  const { t } = useTranslation();
  return (
    <Box
      component="dl"
      sx={{
        m: 0,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: columns === 2 ? '1fr 1fr' : '1fr' },
        columnGap: 3,
        rowGap: 2,
      }}
    >
      {items.map((item) => (
        <Box key={item.label} sx={{ minWidth: 0, gridColumn: item.wide ? '1 / -1' : undefined }}>
          <Typography
            component="dt"
            sx={{ fontSize: '0.9375rem', fontWeight: 500, color: 'text.secondary' }}
          >
            {item.label}
          </Typography>
          <Typography
            component="dd"
            sx={{ m: 0, overflowWrap: 'anywhere', whiteSpace: 'pre-line' }}
          >
            {item.value === null || item.value === undefined || item.value === '' ? (
              <Box component="span" sx={{ color: 'text.secondary' }}>
                {t('common.notProvided')}
              </Box>
            ) : (
              item.value
            )}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
