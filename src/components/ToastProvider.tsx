import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import { useMemo, useState, type ReactNode } from 'react';

import { ToastContext, type ToastApi } from './toastContext';

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<{ text: string; id: number } | null>(null);
  const api = useMemo<ToastApi>(
    () => ({ success: (text) => setMessage({ text, id: Date.now() }) }),
    [],
  );
  return (
    <ToastContext.Provider value={api}>
      {children}
      <Snackbar
        key={message?.id}
        open={Boolean(message)}
        autoHideDuration={6000}
        onClose={(_event, reason) => {
          if (reason !== 'clickaway') setMessage(null);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="success"
          variant="filled"
          role="status"
          onClose={() => setMessage(null)}
          sx={{ fontSize: '1rem', alignItems: 'center' }}
        >
          {message?.text}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
}
