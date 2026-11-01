import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useId, type ReactNode } from 'react';

import { IconTile } from './IconTile';

interface SectionCardProps {
  title?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  tinted?: boolean;
  headingLevel?: 'h2' | 'h3';
}

// White card with an optional icon tile and title, like the reference form cards.
export function SectionCard({
  title,
  icon,
  action,
  children,
  tinted = false,
  headingLevel = 'h2',
}: SectionCardProps) {
  const headingId = useId();
  return (
    <Paper
      component="section"
      variant="outlined"
      aria-labelledby={title ? headingId : undefined}
      sx={{
        p: { xs: 2, sm: 3 },
        bgcolor: tinted ? 'primary.light' : 'background.paper',
        borderColor: tinted ? 'primary.light' : 'divider',
        minWidth: 0,
      }}
    >
      {(title || action) && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1.5,
            mb: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
            {icon && <IconTile>{icon}</IconTile>}
            {title && (
              <Typography
                id={headingId}
                component={headingLevel}
                variant={headingLevel === 'h2' ? 'h2' : 'h3'}
              >
                {title}
              </Typography>
            )}
          </Box>
          {action}
        </Box>
      )}
      {children}
    </Paper>
  );
}

// Tinted panel inside a card for a small group of related fields.
export function InsetGroup({ title, children }: { title?: ReactNode; children: ReactNode }) {
  const headingId = useId();
  return (
    <Box
      role="group"
      aria-labelledby={title ? headingId : undefined}
      sx={{ bgcolor: 'primary.light', borderRadius: 2, p: 2 }}
    >
      {title && (
        <Typography id={headingId} component="h3" variant="h4" sx={{ mb: 1.5 }}>
          {title}
        </Typography>
      )}
      {children}
    </Box>
  );
}
