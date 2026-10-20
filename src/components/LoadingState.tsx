import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';

interface LoadingStateProps {
  label: string;
  fullPage?: boolean;
}

export function LoadingState({ label, fullPage = false }: LoadingStateProps) {
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        minHeight: fullPage ? '100vh' : 240,
        p: 3,
      }}
    >
      <CircularProgress aria-hidden />
      <Typography>{label}</Typography>
    </Box>
  );
}
