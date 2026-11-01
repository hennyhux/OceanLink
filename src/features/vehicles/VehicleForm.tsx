import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import { zodResolver } from '@hookform/resolvers/zod';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import Grid from '@mui/material/Grid';
import InputAdornment from '@mui/material/InputAdornment';
import Link from '@mui/material/Link';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';

import { FormErrorSummary } from '@/components/FormErrorSummary';
import { InsetGroup, SectionCard } from '@/components/SectionCard';
import { UnsavedChangesGuard } from '@/components/UnsavedChangesGuard';
import type { Customer } from '@/features/customers/types';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { hasCode, hasStatus, isApiError, requestIdOf } from '@/lib/api/errors';
import { applyServerFieldErrors } from '@/lib/forms';

import { CustomerPicker } from '@/features/customers/CustomerPicker';
import { VEHICLE_FIELDS, vehicleFormSchema, type VehicleFormValues } from './model';
import { VEHICLE_TYPES } from './types';

type FieldName = (typeof VEHICLE_FIELDS)[number];

const SERVER_MESSAGES: Record<string, string> = {
  PLATE_ALREADY_IN_USE: 'vehicles.errors.plateInUse',
  UNIT_NUMBER_ALREADY_IN_USE: 'vehicles.errors.unitInUse',
  IDENTIFIER_REQUIRED: 'vehicles.errors.identifierRequired',
  INVALID_USDOT: 'vehicles.errors.usdotDigits',
  REQUIRED: 'form.required',
};
const PLATE_FIELDS: readonly FieldName[] = ['plate_number', 'plate_jurisdiction'];
const USDOT_FIELDS: readonly FieldName[] = ['usdot_number', 'unit_number'];

interface Props {
  defaultValues: VehicleFormValues;
  initialCustomer: Customer | null;
  // Editing keeps the owner fixed. Ownership transfers are a separate workflow.
  lockedOwner?: { id: string; name: string; usdot: string | null };
  submitLabel: string;
  onSubmit: (values: VehicleFormValues) => Promise<void>;
  onCancel: () => void;
  onReload?: () => void;
}

type Failure = { kind: 'stale' | 'network' | 'unexpected' | 'parking'; requestId?: string };

export function VehicleForm({
  defaultValues,
  initialCustomer,
  lockedOwner,
  submitLabel,
  onSubmit,
  onCancel,
  onReload,
}: Props) {
  const { t } = useTranslation();
  const online = useOnlineStatus();
  const [customer, setCustomer] = useState<Customer | null>(initialCustomer);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [saved, setSaved] = useState(false);
  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues,
    mode: 'onTouched',
  });
  const { register, control, formState, watch, setError, setFocus, setValue, getValues } = form;
  const { errors, isSubmitting, isDirty, submitCount } = formState;
  const method = watch('method');
  const hasRate = Boolean(watch('monthly_rate')?.trim());
  const usdot = watch('usdot_number')?.trim() ?? '';
  const ownerUsdot = lockedOwner?.usdot ?? customer?.usdot_number ?? null;
  const hiddenFields = method === 'usdot' ? PLATE_FIELDS : USDOT_FIELDS;
  const [moreOpen, setMoreOpen] = useState(() =>
    hiddenFields.some((name) => Boolean(defaultValues[name])),
  );
  const pendingFocus = useRef<FieldName | null>(null);

  // A field inside the folded section can only take focus once it is open.
  useEffect(() => {
    if (moreOpen && pendingFocus.current) {
      setFocus(pendingFocus.current);
      pendingFocus.current = null;
    }
  }, [moreOpen, setFocus]);

  // Switching method moves fields into the folded section. Open it if they hold a value.
  useEffect(() => {
    if (hiddenFields.some((name) => Boolean(getValues(name)?.toString().trim()))) setMoreOpen(true);
  }, [method, hiddenFields, getValues]);

  const focusField = (name: FieldName) => {
    if (hiddenFields.includes(name) && !moreOpen) {
      pendingFocus.current = name;
      setMoreOpen(true);
    } else setFocus(name);
  };

  const message = (name: FieldName) => {
    const text = errors[name]?.message;
    return text ? t(text) : undefined;
  };

  // New trucks usually run under the customer's own USDOT number.
  const chooseCustomer = (next: Customer | null) => {
    const previous = customer?.usdot_number ?? '';
    setCustomer(next);
    const current = getValues('usdot_number').trim();
    if (!current || current === previous) {
      setValue('usdot_number', next?.usdot_number ?? '', { shouldDirty: true });
    }
  };

  const submit = form.handleSubmit(
    async (values) => {
      setFailure(null);
      try {
        await onSubmit(values);
        setSaved(true);
      } catch (error) {
        if (hasStatus(error, 412)) return setFailure({ kind: 'stale' });
        if (hasCode(error, 'INVALID_PARKING'))
          return setFailure({ kind: 'parking', requestId: requestIdOf(error) });
        const field = applyServerFieldErrors(
          error,
          setError,
          VEHICLE_FIELDS,
          SERVER_MESSAGES,
          'form.invalid',
        );
        // Only fields from VEHICLE_FIELDS can come back here.
        if (field) return focusField(field as FieldName);
        setFailure({
          kind: isApiError(error) ? 'unexpected' : 'network',
          requestId: requestIdOf(error),
        });
      }
    },
    (invalid) => {
      const first = VEHICLE_FIELDS.find((name) => invalid[name]);
      if (first) focusField(first);
    },
  );

  const optional = (label: string) => `${label} (${t('form.optional')})`;
  const usdotField = (folded: boolean) => (
    <TextField
      label={folded ? optional(t('vehicles.fields.usdot')) : t('vehicles.fields.usdot')}
      required={!folded}
      inputMode="numeric"
      error={Boolean(errors.usdot_number)}
      helperText={
        message('usdot_number') ??
        (ownerUsdot && usdot && usdot !== ownerUsdot
          ? t('vehicles.usdotDiffers', { usdot: ownerUsdot })
          : t('vehicles.fields.usdotHint'))
      }
      slotProps={{
        formHelperText: {
          sx:
            ownerUsdot && usdot && usdot !== ownerUsdot && !errors.usdot_number
              ? { color: 'warning.main', fontWeight: 600 }
              : undefined,
        },
      }}
      {...register('usdot_number')}
    />
  );
  const unitField = (folded: boolean) => (
    <TextField
      label={folded ? optional(t('vehicles.fields.unit')) : t('vehicles.fields.unit')}
      required={!folded}
      error={Boolean(errors.unit_number)}
      helperText={message('unit_number') ?? t('vehicles.fields.unitHint')}
      {...register('unit_number')}
    />
  );
  const plateFields = (folded: boolean) => (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, sm: 7 }}>
        <TextField
          label={folded ? optional(t('vehicles.fields.plate')) : t('vehicles.fields.plate')}
          required={!folded}
          error={Boolean(errors.plate_number)}
          helperText={message('plate_number') ?? t('vehicles.fields.plateHint')}
          {...register('plate_number')}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 5 }}>
        <TextField
          label={folded ? optional(t('vehicles.fields.state')) : t('vehicles.fields.state')}
          required={!folded}
          error={Boolean(errors.plate_jurisdiction)}
          helperText={message('plate_jurisdiction') ?? t('vehicles.fields.stateHint')}
          {...register('plate_jurisdiction')}
        />
      </Grid>
    </Grid>
  );

  const labels: Partial<Record<keyof VehicleFormValues, string>> = {
    customer_id: t('vehicles.fields.customer'),
    usdot_number: t('vehicles.fields.usdot'),
    unit_number: t('vehicles.fields.unit'),
    plate_number: t('vehicles.fields.plate'),
    plate_jurisdiction: t('vehicles.fields.state'),
    monthly_rate: t('parking.amount'),
    parking_starts_on: t('parking.startsOn'),
  };

  return (
    <Box component="form" noValidate onSubmit={submit} sx={{ maxWidth: 760 }}>
      <UnsavedChangesGuard when={isDirty && !saved && !isSubmitting} />
      {failure?.kind === 'stale' && (
        <Alert
          severity="warning"
          sx={{ mb: 3 }}
          action={
            onReload && (
              <Button color="inherit" onClick={onReload}>
                {t('common.reload')}
              </Button>
            )
          }
        >
          <AlertTitle>{t('errors.staleTitle')}</AlertTitle>
          {t('errors.staleBody')}
        </Alert>
      )}
      {failure && failure.kind !== 'stale' && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {t(
            failure.kind === 'parking'
              ? 'parking.errors.invalidOnCreate'
              : failure.kind === 'network'
                ? 'errors.saveFailed'
                : 'errors.saveUnexpected',
          )}
          {failure.requestId && (
            <Typography variant="caption" component="div">
              {t('errors.problemNumber', { id: failure.requestId })}
            </Typography>
          )}
        </Alert>
      )}
      <FormErrorSummary
        errors={errors}
        labels={labels}
        submitCount={submitCount}
        onPick={(name) => focusField(name as FieldName)}
      />
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {t('form.requiredHint')}
      </Typography>

      <Stack spacing={3}>
        <SectionCard title={t('vehicles.formVehicle')} icon={<LocalShippingOutlinedIcon />}>
          <Stack spacing={2.5}>
            {lockedOwner ? (
              <Box>
                <Typography sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  {t('vehicles.fields.owner')}
                </Typography>
                <Link
                  component={RouterLink}
                  to={`/customers/${lockedOwner.id}`}
                  sx={{ fontWeight: 600, fontSize: '1.0625rem' }}
                >
                  {lockedOwner.name}
                </Link>
                <Typography variant="body2" color="text.secondary">
                  {t('vehicles.ownerFixed')}
                </Typography>
              </Box>
            ) : (
              <Controller
                name="customer_id"
                control={control}
                render={({ field }) => (
                  <CustomerPicker
                    value={customer}
                    onChange={(next) => {
                      field.onChange(next?.id ?? '');
                      chooseCustomer(next);
                    }}
                    onBlur={field.onBlur}
                    inputRef={field.ref}
                    label={t('vehicles.fields.customer')}
                    helperText={t('vehicles.fields.customerHint')}
                    error={message('customer_id')}
                    autoFocus={!initialCustomer}
                  />
                )}
              />
            )}

            <Controller
              name="vehicle_type"
              control={control}
              render={({ field }) => (
                <FormControl component="fieldset">
                  <FormLabel
                    component="legend"
                    sx={{ color: 'text.primary', fontWeight: 500, mb: 0.5 }}
                  >
                    {t('vehicles.fields.type')}
                  </FormLabel>
                  <RadioGroup row {...field} sx={{ columnGap: 1 }}>
                    {VEHICLE_TYPES.map((type) => (
                      <FormControlLabel
                        key={type}
                        value={type}
                        control={<Radio />}
                        label={t(`vehicles.type.${type}`)}
                        sx={{ minHeight: 44 }}
                      />
                    ))}
                  </RadioGroup>
                </FormControl>
              )}
            />

            <Controller
              name="method"
              control={control}
              render={({ field }) => (
                <FormControl component="fieldset">
                  <FormLabel
                    component="legend"
                    sx={{ color: 'text.primary', fontWeight: 500, mb: 0.5 }}
                  >
                    {t('vehicles.fields.method')}
                  </FormLabel>
                  <RadioGroup row {...field} sx={{ columnGap: 1 }}>
                    <FormControlLabel
                      value="usdot"
                      control={<Radio />}
                      label={t('vehicles.method.usdot')}
                      sx={{ minHeight: 44 }}
                    />
                    <FormControlLabel
                      value="plate"
                      control={<Radio />}
                      label={t('vehicles.method.plate')}
                      sx={{ minHeight: 44 }}
                    />
                  </RadioGroup>
                </FormControl>
              )}
            />

            {method === 'usdot' ? (
              <>
                {usdotField(false)}
                {unitField(false)}
              </>
            ) : (
              plateFields(false)
            )}

            <Accordion
              disableGutters
              variant="outlined"
              expanded={moreOpen}
              onChange={(_event, open) => setMoreOpen(open)}
              sx={{ borderRadius: 2, '&::before': { display: 'none' } }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                aria-controls="vehicle-more"
                id="vehicle-more-header"
              >
                <Typography sx={{ fontWeight: 600 }}>
                  {t(method === 'usdot' ? 'vehicles.morePlate' : 'vehicles.moreUsdot')}
                </Typography>
              </AccordionSummary>
              <AccordionDetails id="vehicle-more">
                <Stack spacing={2}>
                  {method === 'usdot' ? (
                    plateFields(true)
                  ) : (
                    <>
                      {usdotField(true)}
                      {unitField(true)}
                    </>
                  )}
                </Stack>
              </AccordionDetails>
            </Accordion>
          </Stack>
        </SectionCard>

        {!lockedOwner && (
          <SectionCard title={t('parking.titleOptional')} icon={<CalendarMonthOutlinedIcon />}>
            <InsetGroup>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label={optional(t('parking.amount'))}
                    inputMode="decimal"
                    error={Boolean(errors.monthly_rate)}
                    helperText={message('monthly_rate') ?? t('parking.amountHint')}
                    slotProps={{
                      input: {
                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                      },
                    }}
                    {...register('monthly_rate')}
                  />
                </Grid>
                {hasRate && (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label={t('parking.startsOn')}
                      type="date"
                      required
                      error={Boolean(errors.parking_starts_on)}
                      helperText={message('parking_starts_on') ?? t('parking.startsOnHint')}
                      slotProps={{ inputLabel: { shrink: true } }}
                      {...register('parking_starts_on')}
                    />
                  </Grid>
                )}
              </Grid>
            </InsetGroup>
            <Typography color="text.secondary" sx={{ mt: 2, maxWidth: '72ch' }}>
              {t('parking.notDebt')}
            </Typography>
          </SectionCard>
        )}

        {!online && <Alert severity="warning">{t('shell.offline')}</Alert>}
        <Stack
          direction={{ xs: 'column-reverse', sm: 'row' }}
          spacing={1.5}
          justifyContent="flex-end"
        >
          <Button size="large" onClick={onCancel} disabled={isSubmitting}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" size="large" variant="contained" disabled={isSubmitting || !online}>
            {isSubmitting ? t('common.saving') : submitLabel}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
