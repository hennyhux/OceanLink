import { useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/features/auth/useAuth';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { isApiError } from '@/lib/api/errors';
import { formatMoney } from '@/lib/money';
import { paymentKeys, paymentsApi, usePaymentMutation } from './api';
import type { Payment } from './model';

export function PaymentDetailsDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const online = useOnlineStatus();
  const query = useQuery({
    queryKey: paymentKeys.detail(id),
    queryFn: ({ signal }) => paymentsApi.get(id, signal),
  });
  const mutation = usePaymentMutation();
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState('');
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [done, setDone] = useState(false);
  const pending = useRef<{ payment: Payment; reason: string; key: string } | null>(null);
  const inFlight = useRef(false);
  const busy = mutation.isPending;
  const payment = query.data;
  useEffect(() => {
    if (!reason && !uncertain) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [reason, uncertain]);
  const reverse = async () => {
    if (!payment || inFlight.current || !online) return;
    if (!pending.current) {
      if (!reason.trim() || reason.trim().length > 1000) {
        setErrorKey('payments.reasonRequired');
        return;
      }
      pending.current = { payment, reason: reason.trim(), key: crypto.randomUUID() };
    }
    const operation = pending.current;
    inFlight.current = true;
    setErrorKey(null);
    try {
      await mutation.mutateAsync(() =>
        paymentsApi.reverse(operation.payment, operation.reason, operation.key),
      );
      pending.current = null;
      setUncertain(false);
      setConfirm(false);
      setReason('');
      setDone(true);
    } catch (error) {
      if (!isApiError(error) || error.status >= 500) {
        setUncertain(true);
        setErrorKey('payments.unknownReverse');
      } else {
        pending.current = null;
        setUncertain(false);
        setErrorKey(
          error.status === 412
            ? 'payments.stale'
            : error.status === 403
              ? 'payments.forbidden'
              : error.code === 'PAYMENT_ALREADY_REVERSED'
                ? 'payments.alreadyReversed'
                : 'payments.reverseFailed',
        );
      }
    } finally {
      inFlight.current = false;
    }
  };
  const money = (amount: number) => formatMoney(amount, i18n.resolvedLanguage ?? 'zh-CN');
  return (
    <Dialog
      open
      fullWidth
      maxWidth="sm"
      onClose={() => {
        if (!busy && !uncertain && !reason.trim()) onClose();
      }}
      aria-labelledby="payment-detail-title"
    >
      <DialogTitle id="payment-detail-title">{t('payments.details')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ overflowWrap: 'anywhere' }}>
          {query.isPending && <Typography role="status">{t('app.loading')}</Typography>}
          {query.isError && (
            <Alert
              severity="error"
              action={<Button onClick={() => void query.refetch()}>{t('app.retry')}</Button>}
            >
              {t('common.loadFailedBody')}
            </Alert>
          )}
          {!online && <Alert severity="warning">{t('payments.offline')}</Alert>}
          {done && (
            <Alert severity="success" role="status">
              {t('payments.reversed')}
            </Alert>
          )}
          {errorKey && <Alert severity={uncertain ? 'warning' : 'error'}>{t(errorKey)}</Alert>}
          {payment && (
            <>
              <Typography component="h3" variant="h6">
                {payment.customer_name} · {money(payment.amount.amount)}
              </Typography>
              <Typography>
                {payment.effective_on} · {t(`account.methods.${payment.method}`)} ·{' '}
                {t(`payments.status.${payment.status}`)}
              </Typography>
              <Typography>
                {t('payments.reference')}: {payment.reference ?? t('common.notProvided')}
              </Typography>
              <Typography>
                {t('payments.notes')}: {payment.notes ?? t('common.notProvided')}
              </Typography>
              <Typography>
                {t('payments.recordedBy')}: {payment.recorded_by.name}
              </Typography>
              <Typography>
                {t('payments.allocated')}:{' '}
                {money(payment.status === 'received' ? payment.allocated_amount.amount : 0)}
              </Typography>
              <Typography>
                {t('payments.availableCredit')}: {money(payment.available_credit.amount)}
              </Typography>
              {payment.reversal && (
                <Alert severity="info">
                  {t('payments.reversalReason')}: {payment.reversal.reason} ·{' '}
                  {payment.reversal.actor.name}
                </Alert>
              )}
              <Typography component="h3" variant="h6">
                {t('payments.audit')}
              </Typography>
              {payment.audit_events.map((event, index) => (
                <Typography key={`${event.created_at}-${index}`}>
                  {t(`payments.auditAction.${event.action}`)} ·{' '}
                  {new Intl.DateTimeFormat(i18n.resolvedLanguage, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(event.created_at))}
                  {event.reason ? ` · ${event.reason}` : ''}
                </Typography>
              ))}
              {user?.role === 'admin' && payment.status === 'received' && !confirm && (
                <Button
                  color="error"
                  variant="outlined"
                  onClick={() => setConfirm(true)}
                  disabled={!online}
                >
                  {t('payments.reverse')}
                </Button>
              )}
              {confirm && (
                <>
                  <Alert severity="warning">{t('payments.reverseWarning')}</Alert>
                  <TextField
                    label={t('payments.reversalReason')}
                    required
                    fullWidth
                    multiline
                    minRows={2}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    slotProps={{ input: { readOnly: busy || uncertain } }}
                  />
                  <Button
                    variant="contained"
                    color="error"
                    disabled={
                      busy ||
                      !online ||
                      errorKey === 'payments.stale' ||
                      errorKey === 'payments.alreadyReversed'
                    }
                    onClick={() => void reverse()}
                  >
                    {t(uncertain ? 'payments.checkResult' : 'payments.confirmReverse')}
                  </Button>
                  {!uncertain && (
                    <Button
                      disabled={busy}
                      onClick={() => {
                        setConfirm(false);
                        setReason('');
                        setErrorKey(null);
                      }}
                    >
                      {t('common.cancel')}
                    </Button>
                  )}
                </>
              )}
              {(errorKey === 'payments.stale' || errorKey === 'payments.alreadyReversed') && (
                <Button
                  onClick={async () => {
                    const refreshed = await query.refetch();
                    if (!refreshed.isError) {
                      setConfirm(false);
                      setReason('');
                      setErrorKey(null);
                    }
                  }}
                >
                  {t('common.reload')}
                </Button>
              )}
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy || uncertain || Boolean(confirm && reason.trim())}>
          {t('payments.close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
