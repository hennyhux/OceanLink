import { useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { paymentsApi } from '@/features/payments/api';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { isApiError } from '@/lib/api/errors';
import { todayInTimeZone } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { billingApi } from './api';
import type { BillingRun } from './model';

export function BillingReviewDialog({
  customerId,
  onClose,
  onIssued,
}: {
  customerId: string;
  onClose: () => void;
  onIssued: () => void;
}) {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const online = useOnlineStatus();
  const lot = useQuery({ queryKey: ['lot', 'current'], queryFn: paymentsApi.lot });
  const [through, setThrough] = useState('');
  const today = lot.data ? todayInTimeZone(lot.data.time_zone) : '';
  const selectedDate = through || today;
  const [applyCredit, setApplyCredit] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [issued, setIssued] = useState<BillingRun | null>(null);
  const pending = useRef<{ id: string; apply: boolean; key: string } | null>(null);
  const inFlight = useRef(false);
  const preview = useQuery({
    queryKey: ['billing-preview', customerId, selectedDate],
    queryFn: () => billingApi.preview(customerId, selectedDate),
    enabled: Boolean(selectedDate) && !uncertain && !issued,
    retry: false,
    staleTime: 0,
    refetchOnReconnect: false,
  });
  const run = preview.data;
  const money = (amount: number) => formatMoney(amount, i18n.resolvedLanguage ?? 'zh-CN');
  useEffect(() => {
    if (!busy && !uncertain) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy, uncertain]);
  const issue = async () => {
    if (!run || inFlight.current || !online) return;
    pending.current ??= { id: run.id, apply: applyCredit, key: crypto.randomUUID() };
    inFlight.current = true;
    setBusy(true);
    setErrorKey(null);
    try {
      const operation = pending.current;
      const result = await billingApi.issue(operation.id, operation.apply, operation.key);
      pending.current = null;
      setUncertain(false);
      setIssued(result);
      await Promise.all([
        client.invalidateQueries({ queryKey: ['ledger', customerId] }),
        client.invalidateQueries({ queryKey: ['payments'] }),
      ]);
      onIssued();
    } catch (failure) {
      if (!isApiError(failure) || failure.status >= 500) {
        setUncertain(true);
        setErrorKey('billing.uncertain');
      } else {
        pending.current = null;
        setUncertain(false);
        setErrorKey(
          failure.status === 412 || failure.status === 409 ? 'billing.changed' : 'billing.failed',
        );
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      fullWidth
      maxWidth="sm"
      onClose={() => {
        if (!busy && !uncertain) onClose();
      }}
      aria-labelledby="monthly-billing-title"
    >
      <DialogTitle id="monthly-billing-title">{t('billing.review')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          {!online && <Alert severity="warning">{t('payments.offline')}</Alert>}
          {issued ? (
            <Alert severity="success" role="status">
              {t('billing.issued')}
            </Alert>
          ) : (
            <>
              <TextField
                label={t('billing.through')}
                type="date"
                value={selectedDate}
                onChange={(event) => {
                  setThrough(event.target.value);
                  setErrorKey(null);
                }}
                disabled={busy || uncertain}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today } }}
              />
              {(preview.isPending || lot.isPending) && (
                <Typography role="status">{t('app.loading')}</Typography>
              )}
              {(preview.isError || lot.isError) && (
                <Alert
                  severity="error"
                  action={
                    <Button
                      onClick={() => {
                        void lot.refetch();
                        void preview.refetch();
                      }}
                    >
                      {t('app.retry')}
                    </Button>
                  }
                >
                  {t('common.loadFailedBody')}
                </Alert>
              )}
              {errorKey && (
                <Alert
                  severity={uncertain ? 'warning' : 'error'}
                  action={
                    !uncertain ? (
                      <Button
                        onClick={() => {
                          setErrorKey(null);
                          void preview.refetch();
                        }}
                      >
                        {t('common.reload')}
                      </Button>
                    ) : undefined
                  }
                >
                  {t(errorKey)}
                </Alert>
              )}
              {run && (
                <>
                  {run.lines.length === 0 ? (
                    <Typography>{t('billing.nothingToBill')}</Typography>
                  ) : (
                    <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
                      {run.lines.map((line) => (
                        <Box
                          component="li"
                          key={line.key}
                          sx={{ py: 1.5, borderBottom: 1, borderColor: 'divider' }}
                        >
                          <Stack direction="row" justifyContent="space-between" gap={2}>
                            <Typography fontWeight={600}>
                              {t('vehicles.unitLabel', { unit: line.vehicle_label })}
                            </Typography>
                            <Typography
                              fontWeight={700}
                              sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}
                            >
                              {money(line.amount.amount)}
                            </Typography>
                          </Stack>
                          <Typography color="text.secondary">
                            {line.starts_on} → {line.ends_on}
                          </Typography>
                          {line.service_days !== line.period_days && (
                            <Typography color="text.secondary">
                              {t('billing.prorated', {
                                days: line.service_days,
                                total: line.period_days,
                              })}
                            </Typography>
                          )}
                        </Box>
                      ))}
                    </Box>
                  )}
                  <Typography>
                    {t('billing.total')}: <strong>{money(run.total.amount)}</strong>
                  </Typography>
                  {run.credit_available.amount > 0 && (
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={applyCredit}
                          onChange={(event) => setApplyCredit(event.target.checked)}
                          disabled={busy || uncertain}
                        />
                      }
                      label={t('billing.applyCredit', {
                        amount: money(Math.min(run.credit_available.amount, run.total.amount)),
                      })}
                    />
                  )}
                  <Typography>
                    {t('billing.dueAfter')}:{' '}
                    <strong>{money(run.amount_due_after_credit.amount)}</strong>
                  </Typography>
                  {run.already_billed_count > 0 && (
                    <Typography color="text.secondary">
                      {t('billing.skipped', { count: run.already_billed_count })}
                    </Typography>
                  )}
                  <Typography variant="body2" color="text.secondary">
                    {t('billing.reviewHint')}
                  </Typography>
                </>
              )}
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy || uncertain}>
          {t('payments.close')}
        </Button>
        {!issued && (
          <Button
            variant="contained"
            onClick={() => void issue()}
            disabled={
              busy ||
              !online ||
              !run?.lines.length ||
              preview.isFetching ||
              preview.isError ||
              Boolean(errorKey && !uncertain)
            }
          >
            {t(busy ? 'common.saving' : uncertain ? 'payments.checkResult' : 'billing.issue')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
