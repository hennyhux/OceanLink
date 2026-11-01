import { zodResolver } from '@hookform/resolvers/zod';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { KeyValueList } from '@/components/KeyValueList';
import { Money } from '@/components/Money';
import { StatusPill } from '@/components/StatusPill';
import { ErrorState, LoadingState } from '@/components/States';
import { useToast } from '@/components/toastContext';
import { useAuth } from '@/features/auth/useAuth';
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { hasCode, hasStatus, isUnknownOutcome, requestIdOf } from '@/lib/api/errors';
import { formatDate, formatDateTime } from '@/lib/dates';
import { refreshAfter } from '@/lib/queryKeys';

import { paymentsApi, usePayment } from './api';
import { reasonSchema } from './model';

export function ReceiptDialog({ paymentId, onClose }: { paymentId: string; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const online = useOnlineStatus();
  const query = usePayment(paymentId);
  const key = useIdempotencyKey();
  const [reversing, setReversing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ key: string; unknown: boolean } | null>(null);
  const form = useForm<{ reason: string }>({
    resolver: zodResolver(reasonSchema()),
    defaultValues: { reason: '' },
  });
  const language = i18n.resolvedLanguage ?? 'en';
  const payment = query.data;
  const locked = busy || Boolean(problem?.unknown);

  const reverse = form.handleSubmit(async ({ reason }) => {
    if (!payment) return;
    setBusy(true);
    setProblem(null);
    try {
      await paymentsApi.reverse(payment, reason.trim(), key.current());
      key.clear();
      await refreshAfter(client, 'paymentChanged');
      setReversing(false);
      toast.success(t('payments.reversed'));
    } catch (error) {
      if (isUnknownOutcome(error)) setProblem({ key: 'payments.unknown', unknown: true });
      else {
        key.clear();
        if (hasStatus(error, 412)) void query.refetch();
        setProblem({
          key: hasStatus(error, 412)
            ? 'errors.staleReloaded'
            : hasCode(error, 'PAYMENT_ALREADY_REVERSED')
              ? 'payments.alreadyReversed'
              : hasCode(error, 'ADMIN_REQUIRED', 'FORBIDDEN')
                ? 'payments.onlyAdminReverses'
                : 'errors.saveFailed',
          unknown: false,
        });
      }
    } finally {
      setBusy(false);
    }
  });

  return (
    <Dialog
      open
      fullWidth
      maxWidth="sm"
      onClose={locked ? undefined : onClose}
      aria-labelledby="receipt-title"
    >
      <DialogTitle id="receipt-title">{t('payments.receiptTitle')}</DialogTitle>
      <DialogContent>
        {query.isPending && <LoadingState rows={4} />}
        {query.isError && !payment && (
          <ErrorState onRetry={() => void query.refetch()} requestId={requestIdOf(query.error)} />
        )}
        {payment && (
          <Stack spacing={2.5}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Money cents={payment.amount.amount} size="kpi" />
              {payment.status === 'reversed' ? (
                <StatusPill tone="neutral" label={t('status.reversed')} />
              ) : (
                <StatusPill tone="success" label={t('status.received')} />
              )}
            </Box>
            <KeyValueList
              items={[
                { label: t('payments.fields.customer'), value: payment.customer_name },
                {
                  label: t('payments.fields.date'),
                  value: formatDate(payment.effective_on, language),
                },
                {
                  label: t('payments.fields.method'),
                  value: t(`payments.methods.${payment.method}`),
                },
                { label: t('payments.fields.reference'), value: payment.reference },
                {
                  label: t('payments.appliedToInvoices'),
                  value: <Money cents={payment.allocated_amount.amount} />,
                },
                {
                  label: t('payments.unusedCredit'),
                  value: <Money cents={payment.available_credit.amount} />,
                },
                { label: t('payments.fields.notes'), value: payment.notes, wide: true },
                {
                  label: t('payments.recordedBy'),
                  value: `${payment.recorded_by.name} · ${formatDateTime(payment.created_at, language)}`,
                  wide: true,
                },
              ]}
            />
            {payment.reversal && (
              <Alert severity="info">
                <AlertTitle>{t('payments.reversalTitle')}</AlertTitle>
                {t('payments.reversalBy', {
                  name: payment.reversal.actor.name,
                  time: formatDateTime(payment.reversal.created_at, language),
                })}
                <Typography sx={{ mt: 0.5 }}>{payment.reversal.reason}</Typography>
              </Alert>
            )}
            {problem && (
              <Alert severity={problem.unknown ? 'warning' : 'error'}>
                {problem.unknown && <AlertTitle>{t('payments.unknownTitle')}</AlertTitle>}
                {t(problem.key)}
              </Alert>
            )}
            {reversing && (
              <Box component="form" id="reverse-form" noValidate onSubmit={reverse}>
                <Alert severity="warning" sx={{ mb: 2 }}>
                  {t('payments.reverseExplain')}
                </Alert>
                <TextField
                  label={t('payments.reverseReason')}
                  required
                  multiline
                  minRows={2}
                  autoFocus
                  disabled={Boolean(problem?.unknown)}
                  error={Boolean(form.formState.errors.reason)}
                  helperText={
                    form.formState.errors.reason?.message
                      ? t(form.formState.errors.reason.message)
                      : undefined
                  }
                  {...form.register('reason')}
                />
              </Box>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1, flexWrap: 'wrap' }}>
        {!reversing && (
          <>
            {payment && payment.status === 'received' && user?.role === 'admin' && (
              <Button
                color="error"
                onClick={() => setReversing(true)}
                disabled={!online}
                sx={{ mr: 'auto' }}
              >
                {t('payments.reverse')}
              </Button>
            )}
            <Button variant="contained" onClick={onClose}>
              {t('common.close')}
            </Button>
          </>
        )}
        {reversing && (
          <>
            {!problem?.unknown && (
              <Button onClick={() => setReversing(false)} disabled={busy}>
                {t('common.back')}
              </Button>
            )}
            <Button
              type="submit"
              form="reverse-form"
              color="error"
              variant="contained"
              disabled={busy || !online}
            >
              {busy
                ? t('common.saving')
                : problem?.unknown
                  ? t('payments.checkAgain')
                  : t('payments.reverseConfirm')}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
