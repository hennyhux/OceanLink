import { zodResolver } from '@hookform/resolvers/zod';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Money } from '@/components/Money';
import { ReviewList } from '@/components/ReviewList';
import { CustomerPicker } from '@/features/customers/CustomerPicker';
import type { Customer } from '@/features/customers/types';
import { useAuth } from '@/features/auth/useAuth';
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey';
import { useLot } from '@/hooks/useLot';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { applyServerFieldErrors } from '@/lib/forms';
import { hasCode, isUnknownOutcome, requestIdOf } from '@/lib/api/errors';
import { formatDate, todayInTimeZone } from '@/lib/dates';
import { refreshAfter } from '@/lib/queryKeys';

import { paymentsApi } from './api';
import { paymentFormSchema, toPaymentWrite, type PaymentFormValues } from './model';
import { PAYMENT_METHODS, type Payment, type PaymentWrite } from './types';

type Step = 'form' | 'review';
type Outcome = { kind: 'unknown' | 'failed'; requestId?: string; messageKey: string } | null;

interface Props {
  // Filled in when opened from a customer page.
  customer?: Customer;
  onClose: () => void;
  onRecorded: (payment: Payment) => void;
}

const FIELDS = ['customer_id', 'amount', 'effective_on', 'method', 'reference', 'notes'] as const;

export function RecordPaymentDialog({ customer: fixedCustomer, onClose, onRecorded }: Props) {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const { user } = useAuth();
  const online = useOnlineStatus();
  const lot = useLot();
  const key = useIdempotencyKey();
  const [customer, setCustomer] = useState<Customer | null>(fixedCustomer ?? null);
  const [step, setStep] = useState<Step>('form');
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [pending, setPending] = useState<PaymentWrite | null>(null);
  const language = i18n.resolvedLanguage ?? 'en';
  // "Today" is the lot's date; the form waits for it so a future date can be blocked.
  const today = lot.data ? todayInTimeZone(lot.data.time_zone) : '';

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema(today)),
    defaultValues: {
      customer_id: fixedCustomer?.id ?? '',
      amount: '',
      effective_on: '',
      method: 'cash',
      reference: '',
      notes: '',
    },
  });
  const { errors } = form.formState;

  useEffect(() => {
    if (today && !form.getValues('effective_on')) form.setValue('effective_on', today);
  }, [today, form]);

  // While a result is unknown the dialog stays open so nobody records it twice.
  const locked = busy || outcome?.kind === 'unknown';
  const message = (name: keyof PaymentFormValues) => {
    const text = errors[name]?.message;
    return text ? t(text) : undefined;
  };

  const send = async (body: PaymentWrite) => {
    setBusy(true);
    setOutcome(null);
    try {
      const payment = await paymentsApi.record(body, key.current());
      key.clear();
      await refreshAfter(client, 'paymentChanged');
      onRecorded(payment);
    } catch (error) {
      if (isUnknownOutcome(error)) {
        setOutcome({
          kind: 'unknown',
          messageKey: 'payments.unknown',
          requestId: requestIdOf(error),
        });
      } else {
        key.clear();
        const field = applyServerFieldErrors(error, form.setError, FIELDS, {}, 'form.invalid');
        if (field) setStep('form');
        setOutcome({
          kind: 'failed',
          messageKey: hasCode(error, 'IDEMPOTENCY_CONFLICT')
            ? 'errors.duplicateRequest'
            : 'payments.failed',
          requestId: requestIdOf(error),
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const review = form.handleSubmit((values) => {
    setPending(toPaymentWrite(values));
    setOutcome(null);
    setStep('review');
  });

  return (
    <Dialog
      open
      fullWidth
      maxWidth="sm"
      onClose={locked ? undefined : onClose}
      aria-labelledby="record-payment-title"
    >
      <DialogTitle id="record-payment-title">
        {t(step === 'form' ? 'payments.record' : 'payments.reviewTitle')}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          {!online && <Alert severity="warning">{t('shell.offline')}</Alert>}
          {lot.isError && (
            <Alert
              severity="error"
              action={
                <Button color="inherit" onClick={() => void lot.refetch()}>
                  {t('common.retry')}
                </Button>
              }
            >
              {t('payments.lotUnavailable')}
            </Alert>
          )}
          {outcome && (
            <Alert severity={outcome.kind === 'unknown' ? 'warning' : 'error'}>
              {outcome.kind === 'unknown' && <AlertTitle>{t('payments.unknownTitle')}</AlertTitle>}
              {t(outcome.messageKey)}
              {outcome.requestId && (
                <Typography variant="caption" component="div">
                  {t('errors.problemNumber', { id: outcome.requestId })}
                </Typography>
              )}
            </Alert>
          )}

          {step === 'form' ? (
            <Box component="form" id="payment-form" noValidate onSubmit={review}>
              <Stack spacing={2.5}>
                {fixedCustomer ? (
                  <Box>
                    <Typography color="text.secondary">{t('payments.fields.customer')}</Typography>
                    <Typography sx={{ fontWeight: 600, fontSize: '1.0625rem' }}>
                      {fixedCustomer.display_name}
                    </Typography>
                  </Box>
                ) : (
                  <Controller
                    name="customer_id"
                    control={form.control}
                    render={({ field }) => (
                      <CustomerPicker
                        value={customer}
                        onChange={(next) => {
                          setCustomer(next);
                          field.onChange(next?.id ?? '');
                        }}
                        onBlur={field.onBlur}
                        inputRef={field.ref}
                        label={t('payments.fields.customer')}
                        helperText={t('payments.fields.customerHint')}
                        error={message('customer_id')}
                        includeInactive
                        autoFocus
                      />
                    )}
                  />
                )}
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label={t('payments.fields.amount')}
                      required
                      inputMode="decimal"
                      autoFocus={Boolean(fixedCustomer)}
                      error={Boolean(errors.amount)}
                      helperText={message('amount') ?? t('payments.fields.amountHint')}
                      slotProps={{
                        input: {
                          startAdornment: <InputAdornment position="start">$</InputAdornment>,
                        },
                      }}
                      {...form.register('amount')}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label={t('payments.fields.date')}
                      type="date"
                      required
                      disabled={!today}
                      error={Boolean(errors.effective_on)}
                      helperText={message('effective_on') ?? t('payments.fields.dateHint')}
                      slotProps={{
                        inputLabel: { shrink: true },
                        htmlInput: { max: today || undefined },
                      }}
                      {...form.register('effective_on')}
                    />
                  </Grid>
                </Grid>
                <Controller
                  name="method"
                  control={form.control}
                  render={({ field }) => (
                    <TextField select label={t('payments.fields.method')} required {...field}>
                      {PAYMENT_METHODS.map((method) => (
                        <MenuItem key={method} value={method} sx={{ minHeight: 44 }}>
                          {t(`payments.methods.${method}`)}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
                <TextField
                  label={`${t('payments.fields.reference')} (${t('form.optional')})`}
                  error={Boolean(errors.reference)}
                  helperText={message('reference') ?? t('payments.fields.referenceHint')}
                  {...form.register('reference')}
                />
                <TextField
                  label={`${t('payments.fields.notes')} (${t('form.optional')})`}
                  multiline
                  minRows={2}
                  error={Boolean(errors.notes)}
                  helperText={message('notes')}
                  {...form.register('notes')}
                />
              </Stack>
            </Box>
          ) : (
            pending && (
              <>
                <ReviewList
                  rows={[
                    {
                      label: t('payments.fields.customer'),
                      value: customer?.display_name ?? fixedCustomer?.display_name,
                    },
                    {
                      label: t('payments.fields.amount'),
                      value: <Money cents={pending.amount.amount} />,
                    },
                    {
                      label: t('payments.fields.date'),
                      value: formatDate(pending.effective_on, language),
                    },
                    {
                      label: t('payments.fields.method'),
                      value: t(`payments.methods.${pending.method}`),
                    },
                    {
                      label: t('payments.fields.reference'),
                      value: pending.reference ?? t('common.none'),
                    },
                    ...(pending.notes
                      ? [{ label: t('payments.fields.notes'), value: pending.notes }]
                      : []),
                  ]}
                />
                <Alert severity="info">{t('payments.reviewNote')}</Alert>
                {user?.role !== 'admin' && (
                  <Typography color="text.secondary">{t('payments.onlyAdminReverses')}</Typography>
                )}
              </>
            )
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1, flexWrap: 'wrap' }}>
        {step === 'form' ? (
          <>
            <Button onClick={onClose}>{t('common.cancel')}</Button>
            <Button
              type="submit"
              form="payment-form"
              variant="contained"
              disabled={!online || !today}
            >
              {t('payments.review')}
            </Button>
          </>
        ) : (
          <>
            {outcome?.kind !== 'unknown' && (
              <Button onClick={() => setStep('form')} disabled={busy}>
                {t('common.back')}
              </Button>
            )}
            <Button
              variant="contained"
              disabled={busy || !online || !pending}
              onClick={() => pending && void send(pending)}
            >
              {busy
                ? t('common.saving')
                : outcome?.kind === 'unknown'
                  ? t('payments.checkAgain')
                  : t('payments.confirm')}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
