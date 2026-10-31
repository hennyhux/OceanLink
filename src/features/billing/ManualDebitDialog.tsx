import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import type { Customer } from '@/features/customers/types';
import { isApiError } from '@/lib/api/errors';
import { todayInTimeZone } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { paymentsApi } from '@/features/payments/api';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

import { billingApi, billingKeys } from './api';
import {
  manualDebitFormSchema,
  manualDebitToWrite,
  type ManualDebitFormValues,
  type ManualDebitInvoice,
  type ManualDebitWrite,
} from './manualDebitModel';

interface PendingDebit {
  body: ManualDebitWrite;
  draftKey: string;
  issueKey: string;
  draft?: ManualDebitInvoice;
}

export function ManualDebitDialog({
  customer,
  onClose,
  onIssued,
}: {
  customer: Pick<Customer, 'id' | 'display_name'>;
  onClose: () => void;
  onIssued: (invoice: ManualDebitInvoice) => void;
}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const lot = useQuery({ queryKey: ['lot', 'current'], queryFn: paymentsApi.lot });
  const [review, setReview] = useState<ManualDebitWrite | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef<PendingDebit | null>(null);
  const inFlight = useRef(false);
  const form = useForm<ManualDebitFormValues>({
    resolver: zodResolver(manualDebitFormSchema),
    defaultValues: { description: '', amount: '', due_on: '' },
  });
  let today = '';
  try {
    if (lot.data?.currency === 'USD') today = todayInTimeZone(lot.data.time_zone);
  } catch {
    today = '';
  }
  useEffect(() => {
    if (today && !form.getValues('due_on')) form.setValue('due_on', today);
  }, [form, today]);

  const onReview = form.handleSubmit((values) => {
    try {
      const body = manualDebitToWrite(customer.id, values);
      pending.current = {
        body,
        draftKey: crypto.randomUUID(),
        issueKey: crypto.randomUUID(),
      };
      setReview(body);
      setErrorKey(null);
    } catch {
      form.setError('amount', { type: 'validate', message: 'billing.manualAmountInvalid' });
    }
  });

  const confirm = async () => {
    const operation = pending.current;
    if (!operation || inFlight.current || !online) return;
    inFlight.current = true;
    setBusy(true);
    setErrorKey(null);
    try {
      operation.draft ??= await billingApi.createManualDebit(operation.body, operation.draftKey);
      const issued = await billingApi.issueManualDebit(operation.draft.id, operation.issueKey);
      pending.current = null;
      setUncertain(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: billingKeys.ledger(customer.id) }),
        queryClient.invalidateQueries({ queryKey: ['manual-invoices', customer.id] }),
        queryClient.invalidateQueries({ queryKey: ['overview'] }),
        queryClient.invalidateQueries({ queryKey: ['customers', 'list'] }),
      ]);
      onIssued(issued);
    } catch (failure) {
      if (!isApiError(failure) || failure.status >= 500) {
        setUncertain(true);
        setErrorKey('billing.manualUncertain');
      } else {
        setUncertain(false);
        setErrorKey('billing.manualFailed');
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const money = (amount: number) => formatMoney(amount, i18n.resolvedLanguage ?? 'zh-CN');
  const close = () => {
    if (busy || uncertain) return;
    onClose();
  };

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={close} aria-labelledby="manual-debit-title">
      <DialogTitle id="manual-debit-title">
        {t(review ? 'billing.manualReviewTitle' : 'billing.manualTitle')}
      </DialogTitle>
      <form onSubmit={review ? (event) => event.preventDefault() : onReview} noValidate>
        <DialogContent>
          <Stack spacing={2}>
            {!online && <Alert severity="warning">{t('payments.offline')}</Alert>}
            {lot.isPending && <Typography role="status">{t('app.loading')}</Typography>}
            {lot.isError && (
              <Alert
                severity="error"
                action={<Button onClick={() => void lot.refetch()}>{t('app.retry')}</Button>}
              >
                {t('payments.lotUnavailable')}
              </Alert>
            )}
            {!review ? (
              <>
                <Alert severity="info">{t('billing.manualInfo')}</Alert>
                <Typography sx={{ fontSize: 16 }}>{customer.display_name}</Typography>
                <TextField
                  label={t('billing.manualDescription')}
                  required
                  fullWidth
                  disabled={!today}
                  {...form.register('description')}
                  error={Boolean(form.formState.errors.description)}
                  helperText={
                    form.formState.errors.description?.message
                      ? t(form.formState.errors.description.message)
                      : undefined
                  }
                />
                <TextField
                  label={t('billing.manualAmount')}
                  required
                  fullWidth
                  inputMode="decimal"
                  disabled={!today}
                  {...form.register('amount')}
                  error={Boolean(form.formState.errors.amount)}
                  helperText={
                    form.formState.errors.amount?.message
                      ? t(form.formState.errors.amount.message)
                      : undefined
                  }
                />
                <TextField
                  label={t('billing.manualDueDate')}
                  required
                  fullWidth
                  type="date"
                  disabled={!today}
                  slotProps={{ inputLabel: { shrink: true } }}
                  {...form.register('due_on')}
                  error={Boolean(form.formState.errors.due_on)}
                  helperText={
                    form.formState.errors.due_on?.message
                      ? t(form.formState.errors.due_on.message)
                      : undefined
                  }
                />
              </>
            ) : (
              <>
                <Alert severity="warning">{t('billing.manualReviewWarning')}</Alert>
                <Typography sx={{ fontSize: 16, overflowWrap: 'anywhere' }}>
                  {customer.display_name}
                </Typography>
                <Stack component="dl" spacing={1} sx={{ m: 0 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                    <Typography component="dt" color="text.secondary">
                      {t('billing.manualDescription')}
                    </Typography>
                    <Typography
                      component="dd"
                      sx={{ m: 0, textAlign: 'right', overflowWrap: 'anywhere' }}
                    >
                      {review.description}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                    <Typography component="dt" color="text.secondary">
                      {t('billing.manualAmount')}
                    </Typography>
                    <Typography component="dd" sx={{ m: 0, fontWeight: 700 }}>
                      {money(review.amount.amount)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                    <Typography component="dt" color="text.secondary">
                      {t('billing.manualDueDate')}
                    </Typography>
                    <Typography component="dd" sx={{ m: 0 }}>
                      {review.due_on}
                    </Typography>
                  </Box>
                </Stack>
              </>
            )}
            {errorKey && <Alert severity={uncertain ? 'warning' : 'error'}>{t(errorKey)}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button onClick={close} disabled={busy || uncertain} sx={{ minHeight: 48 }}>
            {t('common.cancel')}
          </Button>
          {review ? (
            <>
              {!uncertain && (
                <Button
                  onClick={() => {
                    pending.current = null;
                    setReview(null);
                    setErrorKey(null);
                  }}
                  disabled={busy}
                  sx={{ minHeight: 48 }}
                >
                  {t('billing.manualBack')}
                </Button>
              )}
              <Button
                variant="contained"
                onClick={() => void confirm()}
                disabled={busy || !online}
                sx={{ minHeight: 48 }}
              >
                {t(
                  uncertain
                    ? 'billing.manualCheckResult'
                    : busy
                      ? 'common.saving'
                      : 'billing.manualConfirm',
                )}
              </Button>
            </>
          ) : (
            <Button
              type="submit"
              variant="contained"
              disabled={!today || busy}
              sx={{ minHeight: 48 }}
            >
              {t('billing.manualReview')}
            </Button>
          )}
        </DialogActions>
      </form>
    </Dialog>
  );
}
