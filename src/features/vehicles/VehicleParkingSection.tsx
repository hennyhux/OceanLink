import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useState, type ChangeEvent } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/features/auth/useAuth';
import type { Customer } from '@/features/customers/types';
import { isApiError } from '@/lib/api/errors';
import { formatMoney } from '@/lib/money';
import { vehiclesApi, vehicleKeys } from './api';
import { parkingSchema, parkingToWrite, type ParkingFormValues } from './parkingModel';
import type { Vehicle } from './types';

export function VehicleParkingSection({
  vehicle,
  customer,
  onDirtyChange,
}: {
  vehicle: Vehicle;
  customer?: Customer;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const client = useQueryClient();
  const [baseline, setBaseline] = useState(vehicle);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [confirm, setConfirm] = useState<ParkingFormValues | null>(null);
  const parking = baseline.parking;
  const defaults = (record: Vehicle): ParkingFormValues => ({
    pool_id: record.parking?.pool_id ?? '',
    starts_on: record.parking?.starts_on ?? '',
    ends_on: record.parking?.ends_on ?? '',
    rate: record.parking
      ? (
          (record.parking.rate_history.at(-1)?.monthly_rate.amount ??
            record.parking.monthly_rate.amount) / 100
        ).toFixed(2)
      : '',
    effective_on: record.parking?.rate_history.at(-1)?.effective_on ?? '',
    reason: '',
  });
  const form = useForm<ParkingFormValues>({
    resolver: zodResolver(parkingSchema),
    defaultValues: defaults(baseline),
  });
  const pools = useQuery({ queryKey: ['capacity-pools'], queryFn: vehiclesApi.pools });
  const save = useMutation({
    mutationFn: (values: ParkingFormValues) =>
      vehiclesApi.saveParking(vehicle.id, baseline.version, parkingToWrite(values)),
  });
  const busy = save.isPending;
  useEffect(() => {
    onDirtyChange(form.formState.isDirty);
  }, [form.formState.isDirty, onDirtyChange]);
  const canEdit = !parking || user?.role === 'admin';
  const errors = form.formState.errors;
  const persist = async (values: ParkingFormValues) => {
    setErrorKey(null);
    setDone(false);
    try {
      const updated = await save.mutateAsync(values);
      setBaseline(updated);
      form.reset(defaults(updated));
      setConfirm(null);
      setDone(true);
      client.setQueryData(vehicleKeys.detail(updated.id), updated);
      await client.invalidateQueries({ queryKey: vehicleKeys.lists() });
      await client.invalidateQueries({ queryKey: ['ledger'] });
    } catch (error) {
      setConfirm(null);
      setErrorKey(
        isApiError(error) && error.status === 412
          ? 'parking.stale'
          : isApiError(error) && error.code === 'CAPACITY_UNAVAILABLE'
            ? 'parking.noCapacity'
            : isApiError(error) && error.code === 'INVALID_EFFECTIVE_DATE'
              ? 'parking.invalidFuture'
              : isApiError(error) && error.status === 403
                ? 'parking.adminOnly'
                : 'parking.saveFailed',
      );
    }
  };
  const submit = form.handleSubmit(async (values) => {
    if (parking && values.ends_on !== (parking.ends_on ?? '')) setConfirm(values);
    else await persist(values);
  });
  const money = (amount: number) => formatMoney(amount, i18n.resolvedLanguage ?? 'zh-CN');
  return (
    <Box component="section" sx={{ borderBottom: 1, borderColor: 'divider', py: 3 }}>
      <Typography component="h2" variant="h5" mb={2}>
        {t('parking.title')}
      </Typography>
      {parking && (
        <>
          <Box
            sx={{
              p: 2,
              mb: 2,
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              bgcolor: 'background.paper',
            }}
          >
            <Typography variant="body2" color="text.secondary" fontWeight={600}>
              {t('parking.currentRate')}
            </Typography>
            <Typography
              variant="h5"
              component="p"
              fontWeight={700}
              sx={{ mt: 0.25, mb: 1, fontVariantNumeric: 'tabular-nums' }}
            >
              {money(vehicle.parking?.monthly_rate.amount ?? parking.monthly_rate.amount)}
            </Typography>
            <Typography color="text.secondary">
              {parking.starts_on} → {parking.ends_on ?? t('parking.openEnded')} ·{' '}
              {parking.pool_label}
            </Typography>
            <Typography color="text.secondary">
              {t('parking.anchor')}: {parking.billing_anchor_day} ·{' '}
              {parking.payment_terms || t('parking.defaultTerms')}
            </Typography>
          </Box>
          <Typography component="h3" variant="h6" mt={2}>
            {t('parking.history')}
          </Typography>
          <Box
            component="ul"
            sx={{
              p: 0,
              m: 0,
              listStyle: 'none',
              borderTop: 1,
              borderColor: 'divider',
            }}
          >
            {parking.rate_history.map((rate) => (
              <Box
                component="li"
                key={rate.effective_on}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'minmax(9rem, auto) 1fr' },
                  columnGap: 2,
                  rowGap: 0.25,
                  py: 1.25,
                  borderBottom: 1,
                  borderColor: 'divider',
                }}
              >
                <Typography fontWeight={600}>{rate.effective_on}</Typography>
                <Typography sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {money(rate.monthly_rate.amount)}
                  {rate.reason && (
                    <Typography component="span" color="text.secondary">
                      {' · '}
                      {rate.reason}
                    </Typography>
                  )}
                </Typography>
              </Box>
            ))}
          </Box>
        </>
      )}
      {!parking && <Typography mb={2}>{t('parking.noSetup')}</Typography>}
      {!canEdit && <Alert severity="info">{t('parking.adminOnly')}</Alert>}
      {done && (
        <Alert severity="success" role="status">
          {t('parking.saved')}
        </Alert>
      )}
      {errorKey && <Alert severity="error">{t(errorKey)}</Alert>}
      {canEdit && (
        <Box component="form" onSubmit={submit} noValidate mt={2}>
          <Stack spacing={2}>
            {pools.isError && (
              <Alert
                severity="error"
                action={<Button onClick={() => void pools.refetch()}>{t('app.retry')}</Button>}
              >
                {t('common.loadFailedBody')}
              </Alert>
            )}
            <Controller
              name="pool_id"
              control={form.control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label={t('parking.category')}
                  required
                  disabled={busy || Boolean(parking)}
                  error={Boolean(errors.pool_id)}
                  helperText={errors.pool_id?.message ? t(errors.pool_id.message) : undefined}
                >
                  <MenuItem value="">{t('parking.choose')}</MenuItem>
                  {field.value && !pools.data?.some((pool) => pool.id === field.value) && (
                    <MenuItem value={field.value}>
                      {parking?.pool_label ?? t('app.loading')}
                    </MenuItem>
                  )}
                  {pools.data?.map((pool) => (
                    <MenuItem
                      key={pool.id}
                      value={pool.id}
                      disabled={!pool.allowed_vehicle_types.includes(vehicle.vehicle_type)}
                    >
                      {pool.label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <TextField
              label={t('parking.starts')}
              type="date"
              required
              {...form.register('starts_on', {
                onChange: (event: ChangeEvent<HTMLInputElement>) => {
                  if (!parking) form.setValue('effective_on', event.target.value);
                },
              })}
              slotProps={{
                inputLabel: { shrink: true },
                input: { readOnly: busy || Boolean(parking) },
              }}
              error={Boolean(errors.starts_on)}
              helperText={errors.starts_on?.message ? t(errors.starts_on.message) : undefined}
            />
            <TextField
              label={t('parking.ends')}
              type="date"
              {...form.register('ends_on')}
              slotProps={{ inputLabel: { shrink: true }, input: { readOnly: busy } }}
              error={Boolean(errors.ends_on)}
              helperText={
                errors.ends_on?.message ? t(errors.ends_on.message) : t('parking.endHint')
              }
            />
            <TextField
              label={t('parking.rate')}
              required
              {...form.register('rate')}
              slotProps={{ input: { readOnly: busy } }}
              error={Boolean(errors.rate)}
              helperText={errors.rate?.message ? t(errors.rate.message) : undefined}
            />
            {parking && (
              <TextField
                label={t('parking.effective')}
                type="date"
                required
                {...form.register('effective_on')}
                slotProps={{ inputLabel: { shrink: true }, input: { readOnly: busy } }}
                error={Boolean(errors.effective_on)}
                helperText={
                  errors.effective_on?.message
                    ? t(errors.effective_on.message)
                    : t('parking.historyHint')
                }
              />
            )}
            {!parking && (
              <Typography>
                {t('parking.inherit', { day: customer?.billing_anchor_day ?? 1 })}{' '}
                {customer?.payment_terms ?? ''}
              </Typography>
            )}
            <TextField
              label={t('parking.reason')}
              required
              {...form.register('reason')}
              slotProps={{ input: { readOnly: busy } }}
              error={Boolean(errors.reason)}
              helperText={errors.reason?.message ? t(errors.reason.message) : undefined}
            />
            <Typography variant="body2">{t('parking.noDebt')}</Typography>
            <Button
              type="submit"
              variant="contained"
              disabled={
                busy || !pools.data?.length || !vehicle.is_active || errorKey === 'parking.stale'
              }
            >
              {t('parking.save')}
            </Button>
            {errorKey === 'parking.stale' && (
              <Button
                onClick={async () => {
                  try {
                    const fresh = await vehiclesApi.get(vehicle.id);
                    setBaseline(fresh);
                    form.reset(defaults(fresh));
                    setErrorKey(null);
                  } catch {
                    setErrorKey('parking.saveFailed');
                  }
                }}
              >
                {t('common.reload')}
              </Button>
            )}
          </Stack>
        </Box>
      )}
      {confirm && (
        <Alert
          severity="warning"
          sx={{ mt: 2 }}
          action={
            <Stack direction="row">
              <Button disabled={busy} onClick={() => setConfirm(null)}>
                {t('common.cancel')}
              </Button>
              <Button disabled={busy} onClick={() => void persist(confirm)}>
                {t('parking.confirmEnd')}
              </Button>
            </Stack>
          }
        >
          {t('parking.endReview')}
        </Alert>
      )}
    </Box>
  );
}
