import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router';

// Phone layout for list rows: one card per record with the same facts as the table.
export function RecordCardList({ children, label }: { children: ReactNode; label: string }) {
  return (
    <Stack component="ul" aria-label={label} spacing={0} sx={{ listStyle: 'none', m: 0, p: 0 }}>
      {children}
    </Stack>
  );
}

interface RecordCardProps {
  to: string;
  title: ReactNode;
  status?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}

export function RecordCard({ to, title, status, children, footer }: RecordCardProps) {
  return (
    <Box
      component="li"
      sx={{
        position: 'relative',
        borderTop: 1,
        borderColor: 'divider',
        px: 2,
        py: 1.75,
        '&:hover': { bgcolor: 'primary.light' },
        '&:focus-within': { bgcolor: 'primary.light' },
      }}
    >
      <Box
        sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}
      >
        <Box
          component={RouterLink}
          to={to}
          sx={{
            color: 'primary.main',
            fontWeight: 600,
            fontSize: '1.0625rem',
            textDecoration: 'none',
            overflowWrap: 'anywhere',
            // The whole card is clickable through the link's stretched area.
            '&::after': { content: '""', position: 'absolute', inset: 0 },
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          {title}
        </Box>
        {status}
      </Box>
      {children && <Box sx={{ mt: 0.75, color: 'text.secondary' }}>{children}</Box>}
      {footer && (
        <Box
          sx={{
            mt: 1,
            pt: 1,
            borderTop: 1,
            borderColor: 'divider',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 1,
            flexWrap: 'wrap',
          }}
        >
          {footer}
        </Box>
      )}
    </Box>
  );
}
