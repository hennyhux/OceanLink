import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

// Read-only summary of exactly what will be sent, shown before a money action.
export function ReviewList({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <Box
      component="dl"
      sx={{ m: 0, border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}
    >
      {rows.map((row, index) => (
        <Box
          key={row.label}
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            flexWrap: 'wrap',
            gap: 2,
            px: 2,
            py: 1.25,
            bgcolor: index % 2 ? 'background.default' : 'background.paper',
          }}
        >
          <Typography component="dt" color="text.secondary">
            {row.label}
          </Typography>
          <Typography
            component="dd"
            sx={{ m: 0, fontWeight: 600, textAlign: 'right', overflowWrap: 'anywhere' }}
          >
            {row.value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
