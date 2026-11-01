import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import { zodResolver } from '@hookform/resolvers/zod';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState, type ReactNode } from 'react';
import { useForm, type FieldValues, type Path, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Money } from '@/components/Money';
import { InsetGroup, SectionCard } from '@/components/SectionCard';
import { StatusPill } from '@/components/StatusPill';
import { useToast } from '@/components/toastContext';
import { useAuth } from '@/features/auth/useAuth';
import { useLot } from '@/hooks/useLot';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { hasCode, hasStatus } from '@/lib/api/errors';
import { formatDate, todayInTimeZone } from '@/lib/dates';
import { formatMoney } from '@/lib/money';

import { useSaveParking } from './api';
import {
  endDateSchema,
  endDateToWrite,
  firstSetupSchema,
  firstSetupToWrite,
  rateChangeSchema,
  rateChangeToWrite,
  type EndDateValues,
  type FirstSetupValues,
  type RateChangeValues,
} from './parkingModel';
import type { ParkingWrite, Vehicle } from './types';

function errorKeyFor(error: unknown): string {
  if (hasStatus(error, 412)) return 'errors.staleReloaded';
  if (hasCode(error, 'ADMIN_REQUIRED')) return 'parking.errors.adminOnly';
  if (hasCode(error, 'INVALID_EFFECTIVE_DATE')) return 'parking.errors.futureDate';
  if (hasCode(error, 'SERVICE_HISTORY_IMMUTABLE')) return 'parking.errors.startFixed';
  if (hasCode(error, 'INVALID_PARKING')) return 'parking.errors.inactive';
  return 'errors.saveFailed';
}

// A small labeled field bound to a react-hook-form instance.
function Field<T extends FieldValues>({
  form,
  name,
  label,
  hint,
  type = 'text',
  money = false,
}: {
  form: UseFormReturn<T>;
  name: Path<T>;
  label: string;
  hint?: string;
  type?: 'text' | 'date';
  money?: boolean;
}) {
  const { t } = useTranslation();
  const message = form.formState.errors[name]?.message;
  return (
    <TextField
      label={label}
      type={type}
      required
      inputMode={money ? 'decimal' : undefined}
      error={Boolean(message)}
      helperText={typeof message === 'string' ? t(message) : hint}
      slotProps={{
        inputLabel: type === 'date' ? { shrink: true } : undefined,
        input: money
          ? { startAdornment: <InputAdornment position="start">$</InputAdornment> }
          : undefined,
      }}
      {...form.register(name)}
    />
  );
}

interface ChangeDialogProps<T extends FieldValues> {
  title: string;
  intro: ReactNode;
  form: UseFormReturn<T>;
  busy: boolean;
  errorKey: string | null;
  confirmLabel: string;
  onSubmit: () => void;
  onClose: () => void;
  children: ReactNode;
}

function ChangeDialog<T extends FieldValues>({
  title,
  intro,
  form,
  busy,
  errorKey,
  confirmLabel,
  onSubmit,
  onClose,
  children,
}: ChangeDialogProps<T>) {
  const { t } = useTranslation();
  return (
    <Dialog
      open
      fullWidth
      maxWidth="sm"
      onClose={busy ? undefined : onClose}
      aria-labelledby="parking-change-title"
    >
      <Box component="form" noValidate onSubmit={form.handleSubmit(onSubmit)}>
        <DialogTitle id="parking-change-title">{title}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 0.5 }}>
            <Alert severity="info">{intro}</Alert>
            {errorKey && <Alert severity="error">{t(errorKey)}</Alert>}
            {children}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="contained" disabled={busy}>
            {busy ? t('common.saving') : confirmLabel}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

interface Props {
  vehicle: Vehicle;
  ownerActive: boolean;
  onStale: () => void;
}

export function ParkingSection({ vehicle, ownerActive, onStale }: Props) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const online = useOnlineStatus();
  const lot = useLot();
  const save = useSaveParking(vehicle);
  const language = i18n.resolvedLanguage ?? 'en';
  const today = todayInTimeZone(
    lot.data?.time_zone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const parking = vehicle.parking;
  const isAdmin = user?.role === 'admin';
  const latest = parking?.rate_history.at(-1);
  const [dialog, setDialog] = useState<'rate' | 'end' | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const first = useForm<FirstSetupValues>({
    resolver: zodResolver(firstSetupSchema),
    defaultValues: { starts_on: '', rate: '', reason: t('parking.firstReason') },
  });
  const rateForm = useForm<RateChangeValues>({
    resolver: zodResolver(rateChangeSchema(today, latest?.effective_on ?? '')),
    defaultValues: { rate: '', effective_on: '', reason: '' },
  });
  const endForm = useForm<EndDateValues>({
    resolver: zodResolver(endDateSchema(parking?.starts_on ?? '')),
    defaultValues: { ends_on: parking?.ends_on ?? '', reason: '' },
  });

  const send = async (body: ParkingWrite, done: string) => {
    setErrorKey(null);
    try {
      await save.mutateAsync(body);
      setDialog(null);
      toast.success(t(done));
    } catch (error) {
      const key = errorKeyFor(error);
      setErrorKey(key);
      if (hasStatus(error, 412)) {
        setDialog(null);
        onStale();
      }
    }
  };

  if (!parking) {
    const allowed = vehicle.is_active && ownerActive;
    return (
      <SectionCard title={t('parking.title')} icon={<CalendarMonthOutlinedIcon />}>
        <Typography sx={{ mb: 2 }}>{t('parking.noSetup')}</Typography>
        {!allowed ? (
          <Alert severity="info">{t('parking.errors.inactive')}</Alert>
        ) : (
          <Box
            component="form"
            noValidate
            onSubmit={first.handleSubmit((values) =>
              send(firstSetupToWrite(values), 'parking.saved'),
            )}
          >
            <InsetGroup title={t('parking.setUp')}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Field
                    form={first}
                    name="rate"
                    label={t('parking.amount')}
                    hint={t('parking.amountHint')}
                    money
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Field
                    form={first}
                    name="starts_on"
                    label={t('parking.startsOn')}
                    hint={t('parking.startsOnHint')}
                    type="date"
                  />
                </Grid>
                <Grid size={12}>
                  <Field form={first} name="reason" label={t('parking.reason')} />
                </Grid>
              </Grid>
            </InsetGroup>
            {errorKey && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {t(errorKey)}
              </Alert>
            )}
            <Typography color="text.secondary" sx={{ mt: 2, maxWidth: '72ch' }}>
              {t('parking.notDebt')}
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={save.isPending || !online}
              >
                {save.isPending ? t('common.saving') : t('parking.save')}
              </Button>
            </Box>
          </Box>
        )}
      </SectionCard>
    );
  }

  const scheduled = parking.rate_history.filter((rate) => rate.effective_on > today);
  return (
    <SectionCard title={t('parking.title')} icon={<CalendarMonthOutlinedIcon />}>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'primary.light', height: '100%' }}>
            <Typography sx={{ color: 'text.secondary', fontWeight: 600 }}>
              {t('parking.currentRate')}
            </Typography>
            <Money cents={parking.monthly_rate.amount} size="kpi" component="p" />
            <Typography color="text.secondary">{t('account.perMonth')}</Typography>
            {scheduled.map((rate) => (
              <Box key={rate.effective_on} sx={{ mt: 1 }}>
                <StatusPill
                  tone="info"
                  label={t('parking.scheduledRate', {
                    rate: formatMoney(rate.monthly_rate.amount, language),
                    date: formatDate(rate.effective_on, language),
                  })}
                />
              </Box>
            ))}
          </Box>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Box
            component="dl"
            sx={{ m: 0, p: 2, borderRadius: 2, border: 1, borderColor: 'divider', height: '100%' }}
          >
            <Typography component="dt" color="text.secondary">
              {t('parking.startsOn')}
            </Typography>
            <Typography component="dd" sx={{ m: 0, mb: 1.5, fontWeight: 600 }}>
              {formatDate(parking.starts_on, language)}
            </Typography>
            <Typography component="dt" color="text.secondary">
              {t('parking.endsOn')}
            </Typography>
            <Typography component="dd" sx={{ m: 0, fontWeight: 600 }}>
              {parking.ends_on ? formatDate(parking.ends_on, language) : t('parking.noEnd')}
            </Typography>
          </Box>
        </Grid>
      </Grid>

      <Typography component="h3" variant="h4" sx={{ mt: 3, mb: 1 }}>
        {t('parking.history')}
      </Typography>
      <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 2 }}>
        <Table size="small" aria-label={t('parking.history')}>
          <TableHead>
            <TableRow>
              <TableCell scope="col">{t('parking.effectiveOn')}</TableCell>
              <TableCell scope="col" align="right">
                {t('parking.rate')}
              </TableCell>
              <TableCell scope="col">{t('parking.reason')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {[...parking.rate_history].reverse().map((rate) => (
              <TableRow key={rate.effective_on}>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {formatDate(rate.effective_on, language)}
                  {rate.effective_on > today && (
                    <Box component="span" sx={{ ml: 1 }}>
                      <StatusPill tone="info" label={t('parking.scheduled')} />
                    </Box>
                  )}
                </TableCell>
                <TableCell align="right">
                  <Money cents={rate.monthly_rate.amount} />
                </TableCell>
                <TableCell sx={{ overflowWrap: 'anywhere' }}>{rate.reason}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {errorKey && !dialog && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {t(errorKey)}
        </Alert>
      )}
      {isAdmin ? (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2.5 }}>
          <Button
            variant="outlined"
            disabled={!online}
            onClick={() => {
              setErrorKey(null);
              rateForm.reset({ rate: '', effective_on: '', reason: '' });
              setDialog('rate');
            }}
          >
            {t('parking.changeRate')}
          </Button>
          <Button
            variant="outlined"
            disabled={!online}
            onClick={() => {
              setErrorKey(null);
              endForm.reset({ ends_on: parking.ends_on ?? '', reason: '' });
              setDialog('end');
            }}
          >
            {t('parking.changeEnd')}
          </Button>
        </Stack>
      ) : (
        <Alert severity="info" sx={{ mt: 2.5 }}>
          {t('parking.errors.adminOnly')}
        </Alert>
      )}

      {dialog === 'rate' && (
        <ChangeDialog
          title={t('parking.changeRate')}
          intro={t('parking.changeRateIntro')}
          form={rateForm}
          busy={save.isPending}
          errorKey={errorKey}
          confirmLabel={t('parking.scheduleRate')}
          onClose={() => setDialog(null)}
          onSubmit={() =>
            void send(rateChangeToWrite(parking, rateForm.getValues()), 'parking.rateScheduled')
          }
        >
          <Field form={rateForm} name="rate" label={t('parking.newRate')} money />
          <Field
            form={rateForm}
            name="effective_on"
            label={t('parking.effectiveOn')}
            hint={t('parking.effectiveHint')}
            type="date"
          />
          <Field form={rateForm} name="reason" label={t('parking.reason')} />
        </ChangeDialog>
      )}
      {dialog === 'end' && (
        <ChangeDialog
          title={t('parking.changeEnd')}
          intro={t('parking.changeEndIntro')}
          form={endForm}
          busy={save.isPending}
          errorKey={errorKey}
          confirmLabel={t('parking.confirmEnd')}
          onClose={() => setDialog(null)}
          onSubmit={() => void send(endDateToWrite(parking, endForm.getValues()), 'parking.saved')}
        >
          <TextField
            label={`${t('parking.endsOn')} (${t('form.optional')})`}
            type="date"
            error={Boolean(endForm.formState.errors.ends_on)}
            helperText={
              endForm.formState.errors.ends_on?.message
                ? t(endForm.formState.errors.ends_on.message)
                : t('parking.endsOnHint')
            }
            slotProps={{ inputLabel: { shrink: true } }}
            {...endForm.register('ends_on')}
          />
          <Field form={endForm} name="reason" label={t('parking.reason')} />
        </ChangeDialog>
      )}
    </SectionCard>
  );
}
