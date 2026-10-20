import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

export interface Flash {
  messageKey: string;
  severity?: 'success' | 'info';
}

export interface FlashState {
  flash?: Flash;
}

// Shows a one-time message passed through navigation state, then clears it from history.
export function FlashMessage({ message }: { message: (key: string) => string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const incoming = (location.state as FlashState | null)?.flash;
  const [flash, setFlash] = useState<Flash | undefined>(incoming);
  const [open, setOpen] = useState(Boolean(incoming));

  useEffect(() => {
    if (!incoming) return;
    setFlash(incoming);
    setOpen(true);
    // Replace state so a refresh or back navigation does not show the message again.
    void navigate(location.pathname + location.search, { replace: true, state: null });
  }, [incoming, navigate, location.pathname, location.search]);

  if (!flash) return null;

  return (
    <Snackbar
      open={open}
      autoHideDuration={5000}
      onClose={() => setOpen(false)}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert
        severity={flash.severity ?? 'success'}
        variant="filled"
        onClose={() => setOpen(false)}
        role="status"
      >
        {message(flash.messageKey)}
      </Alert>
    </Snackbar>
  );
}
