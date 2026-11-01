import { zodResolver } from '@hookform/resolvers/zod';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Money } from '@/components/Money';
import { ReviewList } from '@/components/ReviewList';
import { useToast } from '@/components/toastContext';
import type { Customer } from '@/features/customers/types';
import { useLot } from '@/hooks/useLot';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { isUnknownOutcome, requestIdOf } from '@/lib/api/errors';
import { formatDate, isBusinessDate, todayInTimeZone } from '@/lib/dates';
import { USD_INPUT, usdToCents } from '@/lib/money';
import { refreshAfter } from '@/lib/queryKeys';

import { billingApi } from './api';
import type { Invoice, ManualChargeWrite } from './types';

const schema = z.object({
  description: z
    .string()
    .trim()
    .min(1, 'charges.errors.descriptionRequired')
    .max(200, 'form.tooLong'),
  amount: z
    .string()
    .trim()
    .refine((value) => USD_INPUT.test(value) && usdToCents(value) > 0, 'money.positive'),
  due_on: z.string().refine(isBusinessDate, 'charges.errors.dueRequired'),
});
type Values = z.infer<typeof schema>;

// Draft and issue are two steps with their own keys; retries reuse them.
interface Operation {
  body: ManualChargeWrite;
  draftKey: string;
  issueKey: string;
  draft?: Invoice;
}

export function OneTimeChargeDialog({
  customer,
  onClose,
}: {
  customer: Customer;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const toast = useToast();
  const online = useOnlineStatus();
  const lot = useLot();
  const language = i18n.resolvedLanguage ?? 'en';
  const today = lot.data ? todayInTimeZone(lot.data.time_zone) : '';
  const operation = useRef<Operation | null>(null);
  const [review, setReview] = useState<ManualChargeWrite | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{
    key: string;
    unknown: boolean;
    requestId?: string;
  } | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { description: '', amount: '', due_on: '' },
  });
  const { errors } = form.formState;
  const locked = busy || Boolean(problem?.unknown);

  useEffect(() => {
    if (today && !form.getValues('due_on')) form.setValue('due_on', today);
  }, [today, form]);

  const message = (name: keyof Values) => {
    const text = errors[name]?.message;
    return text ? t(text) : undefined;
  };

  const toReview = form.handleSubmit((values) => {
    const body: ManualChargeWrite = {
      customer_id: customer.id,
      description: values.description.trim(),
      amount: { amount: usdToCents(values.amount), currency: 'USD' },
      due_on: values.due_on,
    };
    operation.current = { body, draftKey: crypto.randomUUID(), issueKey: crypto.randomUUID() };
    setProblem(null);
    setReview(body);
  });

  const issue = async () => {
    const current = operation.current;
    if (!current) return;
    setBusy(true);
    setProblem(null);
    try {
      current.draft ??= await billingApi.createCharge(current.body, current.draftKey);
      const invoice = await billingApi.issueCharge(current.draft.id, current.issueKey);
      operation.current = null;
      await refreshAfter(client, 'oneTimeChargeIssued');
      toast.success(
        t('charges.issued', {
          number: invoice.invoice_number ?? '',
          amount: new Intl.NumberFormat(language, { style: 'currency', currency: 'USD' }).format(
            invoice.total.amount / 100,
          ),
        }),
      );
      onClose();
    } catch (error) {
      if (isUnknownOutcome(error))
        setProblem({ key: 'charges.unknown', unknown: true, requestId: requestIdOf(error) });
      else {
        operation.current = null;
        setProblem({ key: 'charges.failed', unknown: false, requestId: requestIdOf(error) });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      fullWidth
      maxWidth="sm"
      onClose={locked ? undefined : onClose}
      aria-labelledby="charge-title"
    >
      <DialogTitle id="charge-title">
        {t(review ? 'charges.reviewTitle' : 'charges.add')}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          {!online && <Alert severity="warning">{t('shell.offline')}</Alert>}
          {problem && (
            <Alert severity={problem.unknown ? 'warning' : 'error'}>
              {problem.unknown && <AlertTitle>{t('charges.unknownTitle')}</AlertTitle>}
              {t(problem.key)}
              {problem.requestId && (
                <Typography variant="caption" component="div">
                  {t('errors.problemNumber', { id: problem.requestId })}
                </Typography>
              )}
            </Alert>
          )}
          {!review ? (
            <Box component="form" id="charge-form" noValidate onSubmit={toReview}>
              <Stack spacing={2.5}>
                <Alert severity="info">{t('charges.intro')}</Alert>
                <Box>
                  <Typography color="text.secondary">{t('payments.fields.customer')}</Typography>
                  <Typography sx={{ fontWeight: 600 }}>{customer.display_name}</Typography>
                </Box>
                <TextField
                  label={t('charges.description')}
                  required
                  autoFocus
                  error={Boolean(errors.description)}
                  helperText={message('description') ?? t('charges.descriptionHint')}
                  {...form.register('description')}
                />
                <TextField
                  label={t('charges.amount')}
                  required
                  inputMode="decimal"
                  error={Boolean(errors.amount)}
                  helperText={message('amount')}
                  slotProps={{
                    input: { startAdornment: <InputAdornment position="start">$</InputAdornment> },
                  }}
                  {...form.register('amount')}
                />
                <TextField
                  label={t('charges.dueOn')}
                  type="date"
                  required
                  disabled={!today}
                  error={Boolean(errors.due_on)}
                  helperText={message('due_on') ?? t('charges.dueHint')}
                  slotProps={{ inputLabel: { shrink: true } }}
                  {...form.register('due_on')}
                />
              </Stack>
            </Box>
          ) : (
            <>
              <ReviewList
                rows={[
                  { label: t('payments.fields.customer'), value: customer.display_name },
                  { label: t('charges.description'), value: review.description },
                  { label: t('charges.amount'), value: <Money cents={review.amount.amount} /> },
                  { label: t('charges.dueOn'), value: formatDate(review.due_on, language) },
                ]}
              />
              <Alert severity="warning">{t('charges.reviewNote')}</Alert>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        {!review ? (
          <>
            <Button onClick={onClose}>{t('common.cancel')}</Button>
            <Button
              type="submit"
              form="charge-form"
              variant="contained"
              disabled={!online || !today}
            >
              {t('charges.review')}
            </Button>
          </>
        ) : (
          <>
            {!problem?.unknown && (
              <Button onClick={() => setReview(null)} disabled={busy}>
                {t('common.back')}
              </Button>
            )}
            <Button variant="contained" onClick={() => void issue()} disabled={busy || !online}>
              {busy
                ? t('common.saving')
                : problem?.unknown
                  ? t('charges.checkAgain')
                  : t('charges.issue')}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
