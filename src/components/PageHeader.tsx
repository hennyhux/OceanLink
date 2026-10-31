import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { SxProps, Theme } from '@mui/material/styles';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: ReactNode;
  titleSx?: SxProps<Theme>;
  description?: string;
  action?: ReactNode;
}

export function PageHeader({ title, titleSx, description, action }: PageHeaderProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 2,
        mb: 3,
      }}
    >
      <Box>
        <Typography
          component="h1"
          variant="h4"
          fontWeight={600}
          sx={[
            { fontSize: { xs: '1.5rem', md: '2.125rem' }, lineHeight: 1.2 },
            ...(Array.isArray(titleSx) ? titleSx : titleSx ? [titleSx] : []),
          ]}
        >
          {title}
        </Typography>
        {description && (
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            {description}
          </Typography>
        )}
      </Box>
      {action}
    </Box>
  );
}
