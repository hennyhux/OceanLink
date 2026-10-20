import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

interface ErrorStateProps {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  fullPage?: boolean;
}

export function ErrorState({
  title,
  body,
  actionLabel,
  onAction,
  fullPage = false,
}: ErrorStateProps) {
  return (
    <Box
      role="alert"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 2,
        minHeight: fullPage ? '100vh' : 240,
        p: 3,
      }}
    >
      <Typography component="h1" variant="h6" fontWeight={600}>
        {title}
      </Typography>
      {body && (
        <Typography color="text.secondary" sx={{ maxWidth: 480 }}>
          {body}
        </Typography>
      )}
      {actionLabel && onAction && (
        <Button variant="contained" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </Box>
  );
}
