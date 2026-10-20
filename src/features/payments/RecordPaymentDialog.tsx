import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm, type FieldPath } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { Customer } from '@/features/customers/types';
import { CustomerPicker } from '@/features/vehicles/CustomerPicker';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { isApiError } from '@/lib/api/errors';
import { todayInTimeZone } from '@/lib/dates';
import { paymentsApi, usePaymentMutation } from './api';
import {
  PAYMENT_METHODS,
  paymentFormSchema,
  toPaymentWrite,
  type Payment,
  type PaymentFormValues,
  type PaymentWrite,
} from './model';

export function RecordPaymentDialog({
  customer,
  onClose,
  onSaved,
}: {
  customer?: Customer;
  onClose: () => void;
  onSaved: (payment: Payment) => void;
}) {
  const { t } = useTranslation();
  const lot = useQuery({ queryKey: ['lot', 'current'], queryFn: paymentsApi.lot });
  let today: string | undefined;
  try {
    if (lot.data?.currency === 'USD') today = todayInTimeZone(lot.data.time_zone);
  } catch {
    today = undefined;
  }
  if (today)
    return <ReceiptForm today={today} customer={customer} onClose={onClose} onSaved={onSaved} />;
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="payment-config-title">
      <DialogTitle id="payment-config-title">{t('payments.record')}</DialogTitle>
      <DialogContent>
        {lot.isPending ? (
          <Typography role="status">{t('app.loading')}</Typography>
        ) : (
          <Alert
            severity="error"
            action={<Button onClick={() => void lot.refetch()}>{t('app.retry')}</Button>}
          >
            {t('payments.lotUnavailable')}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
      </DialogActions>
    </Dialog>
  );
}

function ReceiptForm({
  today,
  customer,
  onClose,
  onSaved,
}: {
  today: string;
  customer?: Customer;
  onClose: () => void;
  onSaved: (payment: Payment) => void;
}) {
  const { t } = useTranslation();
  const online = useOnlineStatus();
  const mutation = usePaymentMutation();
  const [selected, setSelected] = useState<Customer | null>(customer ?? null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | undefined>();
  const [uncertain, setUncertain] = useState(false);
  const [discard, setDiscard] = useState(false);
  const pending = useRef<{ key: string; body: PaymentWrite } | null>(null);
  const inFlight = useRef(false);
  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema(today)),
    defaultValues: {
      customer_id: customer?.id ?? '',
      amount: '',
      effective_on: today,
      method: 'cash',
      reference: '',
      notes: '',
    },
  });
  const busy = mutation.isPending;
  const locked = busy || uncertain;
  const errors = form.formState.errors;
  useEffect(() => {
    if (!form.formState.isDirty && !uncertain) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [form.formState.isDirty, uncertain]);
  const close = () => {
    if (locked) return;
    if (form.formState.isDirty) setDiscard(true);
    else onClose();
  };
  const attempt = async (operation: { key: string; body: PaymentWrite }) => {
    if (inFlight.current || !online) return;
    inFlight.current = true;
    setErrorKey(null);
    setRequestId(undefined);
    try {
      const payment = await mutation.mutateAsync(() =>
        paymentsApi.record(operation.body, operation.key),
      );
      pending.current = null;
      setUncertain(false);
      onSaved(payment);
    } catch (error) {
      setRequestId(isApiError(error) ? error.requestId : undefined);
      const unknown = !isApiError(error) || error.status >= 500;
      if (unknown) {
        setUncertain(true);
        setErrorKey('payments.unknown');
      } else {
        pending.current = null;
        setUncertain(false);
        setErrorKey(
          error.status === 403
            ? error.code === 'CSRF_REJECTED'
              ? 'payments.csrf'
              : 'payments.forbidden'
            : error.status === 409
              ? 'payments.keyConflict'
              : 'payments.validationFailed',
        );
        const keys: Record<string, string> = {
          customer_id: 'payments.customerRequired',
          amount: 'payments.invalidAmount',
          effective_on: 'payments.invalidDate',
          reference: 'payments.referenceLong',
          notes: 'payments.notesLong',
        };
        for (const field of Object.keys(error.fieldErrors ?? {})) {
          const name = field === 'amount.amount' ? 'amount' : field;
          if (keys[name])
            form.setError(name as FieldPath<PaymentFormValues>, {
              type: 'server',
              message: keys[name],
            });
        }
      }
    } finally {
      inFlight.current = false;
    }
  };
  const submit = form.handleSubmit(async (values) => {
    if (pending.current || !online) return;
    const operation = { key: crypto.randomUUID(), body: toPaymentWrite(values) };
    pending.current = operation;
    await attempt(operation);
  });
  return (
    <>
      <Dialog open fullWidth maxWidth="sm" onClose={close} aria-labelledby="record-payment-title">
        <DialogTitle id="record-payment-title">{t('payments.record')}</DialogTitle>
        <form onSubmit={submit} noValidate>
          <DialogContent>
            <Stack spacing={2}>
              <Alert severity="info">{t('payments.offlineReceipt')}</Alert>
              {!online && <Alert severity="warning">{t('payments.offline')}</Alert>}
              {errorKey && (
                <Alert severity={uncertain ? 'warning' : 'error'} role="alert">
                  {t(errorKey)}
                  {requestId && (
                    <Typography variant="caption" component="div">
                      {t('common.problemNumber', { id: requestId })}
                    </Typography>
                  )}
                </Alert>
              )}
              {customer ? (
                <Typography>{customer.display_name}</Typography>
              ) : (
                <Controller
                  name="customer_id"
                  control={form.control}
                  render={({ field }) => (
                    <CustomerPicker
                      label={t('payments.customer')}
                      required
                      value={selected}
                      onChange={(next) => {
                        setSelected(next);
                        field.onChange(next?.id ?? '');
                      }}
                      includeInactive
                      disabled={locked}
                      onBlur={field.onBlur}
                      inputRef={field.ref}
                      error={Boolean(errors.customer_id)}
                      helperText={
                        errors.customer_id?.message
                          ? t(errors.customer_id.message)
                          : t('payments.customerHint')
                      }
                    />
                  )}
                />
              )}
              <TextField
                label={t('payments.amount')}
                required
                inputMode="decimal"
                fullWidth
                {...form.register('amount')}
                slotProps={{ input: { readOnly: locked }, inputLabel: { shrink: true } }}
                error={Boolean(errors.amount)}
                helperText={errors.amount?.message ? t(errors.amount.message) : undefined}
              />
              <TextField
                label={t('payments.date')}
                required
                type="date"
                fullWidth
                {...form.register('effective_on')}
                slotProps={{
                  input: { readOnly: locked },
                  inputLabel: { shrink: true },
                  htmlInput: { max: today },
                }}
                error={Boolean(errors.effective_on)}
                helperText={
                  errors.effective_on?.message ? t(errors.effective_on.message) : undefined
                }
              />
              <Controller
                name="method"
                control={form.control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    select
                    required
                    label={t('payments.method')}
                    disabled={locked}
                  >
                    {PAYMENT_METHODS.map((method) => (
                      <MenuItem key={method} value={method}>
                        {t(`account.methods.${method}`)}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
              <TextField
                label={t('payments.reference')}
                fullWidth
                {...form.register('reference')}
                slotProps={{ input: { readOnly: locked }, inputLabel: { shrink: true } }}
                error={Boolean(errors.reference)}
                helperText={
                  errors.reference?.message
                    ? t(errors.reference.message)
                    : t('payments.referenceHint')
                }
              />
              <TextField
                label={t('payments.notes')}
                fullWidth
                multiline
                minRows={2}
                {...form.register('notes')}
                slotProps={{ input: { readOnly: locked }, inputLabel: { shrink: true } }}
                error={Boolean(errors.notes)}
                helperText={errors.notes?.message ? t(errors.notes.message) : undefined}
              />
              <Typography>{t('payments.unallocatedHint')}</Typography>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
            <Button onClick={close} disabled={locked}>
              {t('common.cancel')}
            </Button>
            {uncertain ? (
              <Button
                variant="contained"
                disabled={busy || !online}
                onClick={() => {
                  if (pending.current) void attempt(pending.current);
                }}
              >
                {t(busy ? 'payments.checking' : 'payments.checkResult')}
              </Button>
            ) : (
              <Button type="submit" variant="contained" disabled={busy || !online}>
                {t(busy ? 'common.saving' : 'payments.record')}
              </Button>
            )}
          </DialogActions>
        </form>
      </Dialog>
      <Dialog
        open={discard}
        onClose={() => setDiscard(false)}
        aria-labelledby="payment-discard-title"
      >
        <DialogTitle id="payment-discard-title">{t('common.unsavedTitle')}</DialogTitle>
        <DialogContent>{t('common.unsavedBody')}</DialogContent>
        <DialogActions>
          <Button autoFocus onClick={() => setDiscard(false)}>
            {t('common.stay')}
          </Button>
          <Button onClick={onClose}>{t('common.leave')}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
