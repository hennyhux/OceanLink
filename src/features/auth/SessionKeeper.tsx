import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from './useAuth';

const WARN_BEFORE_MS = 2 * 60_000;
const REPORT_EVERY_MS = 60_000;

// Reports real use at most once a minute and warns before the idle sign-out.
export function SessionKeeper() {
  const { t } = useTranslation();
  const { session, keepAlive, logout, expire } = useAuth();
  const [warning, setWarning] = useState(false);
  const lastReport = useRef(Date.now());
  const idleExpiresAt = session ? Date.parse(session.idle_expires_at) : NaN;

  useEffect(() => {
    if (!session) return;
    const report = () => {
      if (Date.now() - lastReport.current < REPORT_EVERY_MS) return;
      lastReport.current = Date.now();
      keepAlive().catch(() => undefined);
    };
    const events = ['pointerdown', 'keydown', 'touchstart'] as const;
    events.forEach((name) => window.addEventListener(name, report, { passive: true }));
    return () => events.forEach((name) => window.removeEventListener(name, report));
  }, [session, keepAlive]);

  useEffect(() => {
    if (Number.isNaN(idleExpiresAt)) return;
    const now = Date.now();
    setWarning(idleExpiresAt - now <= WARN_BEFORE_MS);
    const warnTimer = setTimeout(
      () => setWarning(true),
      Math.max(0, idleExpiresAt - now - WARN_BEFORE_MS),
    );
    const endTimer = setTimeout(expire, Math.max(0, idleExpiresAt - now));
    return () => {
      clearTimeout(warnTimer);
      clearTimeout(endTimer);
    };
  }, [idleExpiresAt, expire]);

  return (
    <Dialog
      open={warning}
      aria-labelledby="session-warning-title"
      aria-describedby="session-warning-body"
    >
      <DialogTitle id="session-warning-title">{t('session.warningTitle')}</DialogTitle>
      <DialogContent>
        <Typography id="session-warning-body">{t('session.warningBody')}</Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={() => void logout()}>{t('shell.signOut')}</Button>
        <Button
          variant="contained"
          autoFocus
          onClick={() => {
            lastReport.current = Date.now();
            keepAlive()
              .then(() => setWarning(false))
              .catch(() => expire());
          }}
        >
          {t('session.stay')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
