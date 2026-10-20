import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useBlocker } from 'react-router';

interface UnsavedChangesGuardProps {
  when: boolean;
}

// Stops in-app navigation and tab close while a form has unsaved edits.
export function UnsavedChangesGuard({ when }: UnsavedChangesGuardProps) {
  const { t } = useTranslation();
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      when && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!when) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Older Chromium still needs this to show the prompt.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [when]);

  const open = blocker.state === 'blocked';

  return (
    <Dialog
      open={open}
      onClose={() => blocker.reset?.()}
      aria-labelledby="unsaved-title"
      aria-describedby="unsaved-body"
    >
      <DialogTitle id="unsaved-title">{t('common.unsavedTitle')}</DialogTitle>
      <DialogContent>
        <DialogContentText id="unsaved-body">{t('common.unsavedBody')}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => blocker.reset?.()} autoFocus>
          {t('common.stay')}
        </Button>
        <Button color="error" onClick={() => blocker.proceed?.()}>
          {t('common.leave')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
