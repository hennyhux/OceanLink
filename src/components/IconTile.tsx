import Box from '@mui/material/Box';
import type { ReactNode } from 'react';

import { initials } from '@/lib/display';

// Square tile with an icon or initials, used on cards and record headers.
export function IconTile({ children, size = 40 }: { children: ReactNode; size?: number }) {
  return (
    <Box
      aria-hidden
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: 2,
        bgcolor: 'primary.light',
        color: 'primary.main',
        display: 'grid',
        placeItems: 'center',
        fontWeight: 700,
        fontSize: size >= 48 ? '1.125rem' : '0.9375rem',
        '& svg': { fontSize: size >= 48 ? 28 : 22 },
      }}
    >
      {children}
    </Box>
  );
}

export function InitialsTile({ name, size = 40 }: { name: string; size?: number }) {
  return <IconTile size={size}>{initials(name)}</IconTile>;
}
