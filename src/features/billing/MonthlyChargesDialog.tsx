import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableFooter from '@mui/material/TableFooter';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Money } from '@/components/Money';
import { ErrorState, LoadingState } from '@/components/States';
import { vehicleTitle } from '@/features/vehicles/display';
import type { Vehicle } from '@/features/vehicles/types';
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey';
import { useLot } from '@/hooks/useLot';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { hasCode, hasStatus, isUnknownOutcome, requestIdOf } from '@/lib/api/errors';
import { addDays, formatDate, todayInTimeZone } from '@/lib/dates';
import { refreshAfter } from '@/lib/queryKeys';

import { billingApi } from './api';
import type { BillingRun } from './types';

interface Props {
  customerId: string;
  vehicles: Vehicle[];
  onClose: () => void;
}

type Problem = { key: string; unknown: boolean; requestId?: string } | null;

export function MonthlyChargesDialog({ customerId, vehicles, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const online = useOnlineStatus();
  const lot = useLot();
  const key = useIdempotencyKey();
  const language = i18n.resolvedLanguage ?? 'en';
  const today = lot.data ? todayInTimeZone(lot.data.time_zone) : '';
  const [through, setThrough] = useState('');
  const date = through || today;
  const [applyCredit, setApplyCredit] = useState(true);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem>(null);
  const [issued, setIssued] = useState<BillingRun | null>(null);
  // The run being issued is pinned so a retry sends exactly the same request.
  const [pinned, setPinned] = useState<{ id: string; apply: boolean } | null>(null);
  const locked = busy || Boolean(problem?.unknown);

  const preview = useQuery({
    queryKey: ['billing-preview', customerId, date],
    queryFn: () => billingApi.preview(customerId, date),
    enabled: Boolean(date) && !issued && !pinned,
    retry: false,
    staleTime: 0,
  });
  const run = preview.data;
  const nameOf = (vehicleId: string, fallback: string) => {
    const vehicle = vehicles.find((item) => item.id === vehicleId);
    return vehicle ? vehicleTitle(vehicle, t) : fallback;
  };

  const issue = async () => {
    if (!run) return;
    const target = pinned ?? { id: run.id, apply: applyCredit && run.credit_available.amount > 0 };
    setPinned(target);
    setBusy(true);
    setProblem(null);
    try {
      const result = await billingApi.issue(target.id, target.apply, key.current());
      key.clear();
      setPinned(null);
      setIssued(result);
      await refreshAfter(client, 'monthlyChargesIssued');
    } catch (error) {
      if (isUnknownOutcome(error)) {
        setProblem({ key: 'billing.unknown', unknown: true, requestId: requestIdOf(error) });
      } else {
        key.clear();
        setPinned(null);
        const changed =
          hasStatus(error, 412) ||
          hasCode(error, 'VEHICLE_PERIOD_ALREADY_BILLED', 'ALREADY_ISSUED');
        setProblem({
          key: changed ? 'billing.changed' : 'billing.failed',
          unknown: false,
          requestId: requestIdOf(error),
        });
        if (changed) void preview.refetch();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      fullWidth
      maxWidth="md"
      onClose={locked ? undefined : onClose}
      aria-labelledby="monthly-title"
    >
      <DialogTitle id="monthly-title">{t('billing.review')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          {!online && <Alert severity="warning">{t('shell.offline')}</Alert>}
          {issued ? (
            <Alert severity="success" role="status">
              <AlertTitle>{t('billing.issuedTitle')}</AlertTitle>
              {t('billing.issuedBody', {
                count: issued.invoice_numbers.length,
                numbers: issued.invoice_numbers.join(', '),
              })}
            </Alert>
          ) : (
            <>
              <TextField
                type="date"
                label={t('billing.through')}
                value={date}
                disabled={locked || !today}
                onChange={(event) => setThrough(event.target.value)}
                helperText={t('billing.throughHint')}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today || undefined } }}
                sx={{ maxWidth: 280 }}
              />
              {lot.isError && <ErrorState onRetry={() => void lot.refetch()} />}
              {(preview.isPending && preview.fetchStatus !== 'idle') ||
              (!lot.data && lot.isPending) ? (
                <LoadingState rows={3} />
              ) : null}
              {preview.isError && !run && (
                <ErrorState
                  title={t('billing.previewFailed')}
                  body={
                    hasCode(preview.error, 'INVALID_BILLING_RANGE')
                      ? t('billing.futureDate')
                      : t('errors.loadBody')
                  }
                  onRetry={() => void preview.refetch()}
                  requestId={requestIdOf(preview.error)}
                />
              )}
              {run && run.lines.length === 0 && (
                <Alert severity="info">
                  {t('billing.nothingDue')}
                  {run.already_billed_count > 0 &&
                    ` ${t('billing.alreadyBilled', { count: run.already_billed_count })}`}
                </Alert>
              )}
              {run && run.lines.length > 0 && (
                <>
                  <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 2 }}>
                    <Table aria-label={t('billing.linesLabel')}>
                      <TableHead>
                        <TableRow>
                          <TableCell scope="col">{t('vehicles.columns.vehicle')}</TableCell>
                          <TableCell scope="col">{t('billing.servicePeriod')}</TableCell>
                          <TableCell scope="col">{t('billing.days')}</TableCell>
                          <TableCell scope="col" align="right">
                            {t('transactions.amount')}
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {run.lines.map((line) => (
                          <TableRow key={line.key}>
                            <TableCell sx={{ fontWeight: 600 }}>
                              {nameOf(line.vehicle_id, line.vehicle_label)}
                            </TableCell>
                            <TableCell>
                              {t('billing.period', {
                                from: formatDate(line.starts_on, language),
                                to: formatDate(addDays(line.ends_on, -1), language),
                              })}
                            </TableCell>
                            <TableCell>
                              {line.service_days === line.period_days
                                ? t('billing.fullMonth')
                                : t('billing.partOfMonth', {
                                    days: line.service_days,
                                    of: line.period_days,
                                  })}
                            </TableCell>
                            <TableCell align="right">
                              <Money cents={line.amount.amount} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      <TableFooter>
                        <TableRow>
                          <TableCell
                            colSpan={3}
                            sx={{ fontWeight: 700, color: 'text.primary', fontSize: '1rem' }}
                          >
                            {t('billing.total')}
                          </TableCell>
                          <TableCell align="right" sx={{ fontSize: '1rem' }}>
                            <Money cents={run.total.amount} />
                          </TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </TableContainer>
                  {run.already_billed_count > 0 && (
                    <Typography color="text.secondary">
                      {t('billing.alreadyBilled', { count: run.already_billed_count })}
                    </Typography>
                  )}
                  {run.credit_available.amount > 0 && (
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={applyCredit}
                          disabled={locked}
                          onChange={(event) => setApplyCredit(event.target.checked)}
                        />
                      }
                      label={t('billing.applyCredit', {
                        amount: new Intl.NumberFormat(language, {
                          style: 'currency',
                          currency: 'USD',
                        }).format(run.credit_available.amount / 100),
                      })}
                    />
                  )}
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: 'primary.light',
                      display: 'flex',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 1,
                    }}
                  >
                    <Typography sx={{ fontWeight: 600 }}>{t('billing.owedAfter')}</Typography>
                    <Money
                      cents={run.amount_due_after_credit.amount}
                      tone={run.amount_due_after_credit.amount > 0 ? 'owed' : 'neutral'}
                    />
                  </Box>
                  <Alert severity="info">{t('billing.issueNote')}</Alert>
                </>
              )}
              {problem && (
                <Alert severity={problem.unknown ? 'warning' : 'error'}>
                  {problem.unknown && <AlertTitle>{t('billing.unknownTitle')}</AlertTitle>}
                  {t(problem.key)}
                  {problem.requestId && (
                    <Typography variant="caption" component="div">
                      {t('errors.problemNumber', { id: problem.requestId })}
                    </Typography>
                  )}
                </Alert>
              )}
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        {issued ? (
          <Button variant="contained" onClick={onClose}>
            {t('common.close')}
          </Button>
        ) : (
          <>
            {!problem?.unknown && (
              <Button onClick={onClose} disabled={busy}>
                {t('common.cancel')}
              </Button>
            )}
            <Button
              variant="contained"
              onClick={() => void issue()}
              disabled={busy || !online || !run || run.lines.length === 0}
            >
              {busy
                ? t('common.saving')
                : problem?.unknown
                  ? t('billing.checkAgain')
                  : t('billing.issue')}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
