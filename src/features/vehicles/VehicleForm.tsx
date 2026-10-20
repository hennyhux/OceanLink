import { zodResolver } from '@hookform/resolvers/zod';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
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
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm, type FieldPath } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';

import { UnsavedChangesGuard } from '@/components/UnsavedChangesGuard';
import type { Customer } from '@/features/customers/types';
import { isApiError, isNetworkError, isStaleVersion } from '@/lib/api/errors';

import { CustomerPicker } from './CustomerPicker';
import { vehicleFormSchema, type VehicleFormValues } from './formModel';
import { VEHICLE_TYPES } from './types';

type FieldName = FieldPath<VehicleFormValues>;

interface VehicleFormProps {
  defaultValues: VehicleFormValues;
  // The customer the vehicle is for. Required when the owner is already known.
  initialCustomer: Customer | null;
  // Editing keeps the owner fixed; ownership transfers are a separate, careful workflow.
  lockedOwner?: { id: string; name: string };
  submitLabel: string;
  onSubmit: (values: VehicleFormValues) => Promise<void>;
  onCancel: () => void;
  onReload?: () => void;
  additionalDirty?: boolean;
}

interface SubmitFailure {
  kind: 'stale' | 'network' | 'unexpected' | 'coded';
  requestId?: string;
  // For 'coded': a translation key for a known backend error that has no field to attach to.
  messageKey?: string;
}

const KNOWN_FIELDS: ReadonlySet<string> = new Set<FieldName>([
  'customer_id',
  'vehicle_type',
  'usdot_number',
  'unit_number',
  'plate_number',
  'plate_jurisdiction',
]);

// Error codes the backend can send, mapped to plain-language messages.
const CODE_MESSAGES: Record<string, string> = {
  PLATE_ALREADY_IN_USE: 'vehicles.errors.plateInUse',
  UNIT_NUMBER_ALREADY_IN_USE: 'vehicles.errors.unitInUse',
  IDENTIFIER_REQUIRED: 'vehicles.errors.identifierRequired',
  INVALID_USDOT: 'vehicles.errors.usdotDigits',
  REQUIRED: 'vehicles.errors.required',
};

// When the backend sends only a code, this is the field it belongs to.
const CODE_FIELDS: Record<string, FieldName> = {
  PLATE_ALREADY_IN_USE: 'plate_number',
  UNIT_NUMBER_ALREADY_IN_USE: 'unit_number',
};

const PLATE_FIELDS: ReadonlySet<string> = new Set(['plate_number', 'plate_jurisdiction']);
const USDOT_FIELDS: ReadonlySet<string> = new Set(['usdot_number', 'unit_number']);

export function VehicleForm({
  defaultValues,
  initialCustomer,
  lockedOwner,
  submitLabel,
  onSubmit,
  onCancel,
  onReload,
  additionalDirty = false,
}: VehicleFormProps) {
  const { t } = useTranslation();
  const [failure, setFailure] = useState<SubmitFailure | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(initialCustomer);

  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues,
    mode: 'onTouched',
  });
  const { register, control, handleSubmit, watch, formState, setError, setFocus, setValue } = form;
  const { errors, isSubmitting, isDirty } = formState;
  const method = watch('method');
  const usdotValue = (watch('usdot_number') ?? '').trim();

  // The fields not needed for the chosen method live in the collapsed section.
  const moreFields = method === 'usdot' ? PLATE_FIELDS : USDOT_FIELDS;
  const [moreOpen, setMoreOpen] = useState(() =>
    method === 'usdot'
      ? Boolean(defaultValues.plate_number || defaultValues.plate_jurisdiction)
      : Boolean(defaultValues.usdot_number || defaultValues.unit_number),
  );
  const pendingFocus = useRef<FieldName | undefined>(undefined);

  // Switching method moves fields into the collapsed section. If they hold a value (for example
  // the customer's USDOT number), open it so nothing is sent that the person cannot see.
  useEffect(() => {
    const values = form.getValues();
    const hasHiddenValue =
      method === 'usdot'
        ? Boolean(values.plate_number?.trim() || values.plate_jurisdiction?.trim())
        : Boolean(values.usdot_number?.trim() || values.unit_number?.trim());
    if (hasHiddenValue) setMoreOpen(true);
  }, [method, form]);

  // A field inside the collapsed section can only take focus once the section is open.
  useEffect(() => {
    if (moreOpen && pendingFocus.current) {
      setFocus(pendingFocus.current);
      pendingFocus.current = undefined;
    }
  }, [moreOpen, setFocus]);

  const focusField = (name: FieldName) => {
    if (moreFields.has(name) && !moreOpen) {
      pendingFocus.current = name;
      setMoreOpen(true);
    } else {
      setFocus(name);
    }
  };

  const fieldError = (name: FieldName): string | undefined => {
    const message = errors[name]?.message;
    return message ? t(message) : undefined;
  };

  const chooseCustomer = (next: Customer | null) => {
    const previousUsdot = customer?.usdot_number ?? '';
    setCustomer(next);
    // New trucks usually run under the customer's own USDOT number, so fill it in unless the
    // person already typed something different.
    const current = (form.getValues('usdot_number') ?? '').trim();
    if (!current || current === previousUsdot) {
      setValue('usdot_number', next?.usdot_number ?? '', { shouldDirty: true });
    }
  };

  const submit = handleSubmit(
    async (values) => {
      setFailure(null);
      try {
        await onSubmit(values);
        setSubmitted(true);
      } catch (error) {
        if (isStaleVersion(error)) {
          setFailure({ kind: 'stale' });
          return;
        }
        if (isNetworkError(error)) {
          setFailure({ kind: 'network' });
          return;
        }
        if (isApiError(error)) {
          const fieldErrors: Record<string, string[]> = { ...(error.fieldErrors ?? {}) };
          const codeField = CODE_FIELDS[error.code];
          if (codeField && !fieldErrors[codeField]) fieldErrors[codeField] = [error.code];

          let focusTarget: FieldName | undefined;
          let anyHidden = false;
          for (const [field, messages] of Object.entries(fieldErrors)) {
            if (!KNOWN_FIELDS.has(field)) continue;
            const code = messages[0] ?? '';
            setError(field as FieldName, {
              type: 'server',
              message: CODE_MESSAGES[code] ?? 'vehicles.errors.serverInvalid',
            });
            focusTarget ??= field as FieldName;
            if (moreFields.has(field)) anyHidden = true;
          }
          if (focusTarget) {
            if (anyHidden) setMoreOpen(true);
            focusField(focusTarget);
            return;
          }
          // A known error with no field (for example "needs a USDOT or a plate").
          const messageKey = CODE_MESSAGES[error.code];
          if (messageKey) {
            setFailure({ kind: 'coded', messageKey, requestId: error.requestId });
            return;
          }
        }
        setFailure({
          kind: 'unexpected',
          requestId: isApiError(error) ? error.requestId : undefined,
        });
      }
    },
    (invalid) => {
      // Errors inside the collapsed section would otherwise be invisible.
      const names = Object.keys(invalid) as FieldName[];
      if (names.some((name) => moreFields.has(name))) setMoreOpen(true);
      const first = names.find((name) => moreFields.has(name)) ?? names[0];
      if (first && moreFields.has(first)) focusField(first);
    },
  );

  const customerUsdot = customer?.usdot_number ?? null;
  const usdotDiffers = Boolean(usdotValue && customerUsdot && usdotValue !== customerUsdot);
  const usdotHelp =
    fieldError('usdot_number') ??
    (usdotValue && customerUsdot && usdotValue === customerUsdot
      ? t('vehicles.fields.usdotFromCustomer')
      : t('vehicles.fields.usdotHint'));

  const usdotField = (optional: boolean) => (
    <Box>
      <TextField
        label={
          optional
            ? `${t('vehicles.fields.usdot')} (${t('common.optional')})`
            : t('vehicles.fields.usdot')
        }
        required={!optional}
        inputMode="numeric"
        fullWidth
        error={Boolean(errors.usdot_number)}
        helperText={usdotHelp}
        {...register('usdot_number')}
      />
      {/* A visible, non-blocking note: a leased truck can run under another company's USDOT. */}
      {usdotDiffers && (
        <Alert severity="warning" variant="outlined" role="status" sx={{ mt: 1 }}>
          {t('vehicles.fields.usdotDiffers', { value: customerUsdot })}
        </Alert>
      )}
    </Box>
  );

  const unitField = (optional: boolean) => (
    <TextField
      label={
        optional
          ? `${t('vehicles.fields.unit')} (${t('common.optional')})`
          : t('vehicles.fields.unit')
      }
      required={!optional}
      fullWidth
      error={Boolean(errors.unit_number)}
      helperText={
        fieldError('unit_number') ??
        (optional ? t('vehicles.fields.unitHintOptional') : t('vehicles.fields.unitHintRequired'))
      }
      {...register('unit_number')}
    />
  );

  const plateFields = (optional: boolean) => (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, sm: 7 }}>
        <TextField
          label={
            optional
              ? `${t('vehicles.fields.plate')} (${t('common.optional')})`
              : t('vehicles.fields.plate')
          }
          required={!optional}
          fullWidth
          error={Boolean(errors.plate_number)}
          helperText={fieldError('plate_number') ?? t('vehicles.fields.plateExample')}
          {...register('plate_number')}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 5 }}>
        <TextField
          label={
            optional
              ? `${t('vehicles.fields.jurisdiction')} (${t('common.optional')})`
              : t('vehicles.fields.jurisdiction')
          }
          required={!optional}
          fullWidth
          error={Boolean(errors.plate_jurisdiction)}
          helperText={fieldError('plate_jurisdiction') ?? t('vehicles.fields.jurisdictionExample')}
          {...register('plate_jurisdiction')}
        />
      </Grid>
    </Grid>
  );

  return (
    <Box component="form" onSubmit={submit} noValidate>
      <UnsavedChangesGuard when={(isDirty && !submitted && !isSubmitting) || additionalDirty} />

      <Stack spacing={3}>
        {failure?.kind === 'stale' && (
          <Alert
            severity="warning"
            role="alert"
            action={
              onReload && (
                <Button color="inherit" size="small" onClick={onReload}>
                  {t('common.reload')}
                </Button>
              )
            }
          >
            <AlertTitle>{t('common.staleTitle')}</AlertTitle>
            {t('common.staleBody')}
          </Alert>
        )}
        {failure?.kind === 'network' && (
          <Alert severity="error" role="alert">
            {t('common.saveFailed')}
          </Alert>
        )}
        {failure?.kind === 'coded' && failure.messageKey && (
          <Alert severity="error" role="alert">
            {t(failure.messageKey)}
          </Alert>
        )}
        {failure?.kind === 'unexpected' && (
          <Alert severity="error" role="alert">
            {t('common.saveFailedUnexpected')}
            {failure.requestId && (
              <Typography variant="caption" component="div" sx={{ mt: 0.5 }}>
                {t('common.problemNumber', { id: failure.requestId })}
              </Typography>
            )}
          </Alert>
        )}

        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack spacing={3}>
            <Typography variant="body2" color="text.secondary">
              {t('common.requiredHint')}
            </Typography>

            {lockedOwner ? (
              <Box>
                <Typography variant="body2" color="text.secondary">
                  {t('vehicles.fields.owner')}
                </Typography>
                <Link component={RouterLink} to={`/customers/${lockedOwner.id}`} fontWeight={600}>
                  {lockedOwner.name}
                </Link>
                <Typography variant="body2" color="text.secondary">
                  {t('vehicles.ownerNote')}
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
                    required
                    autoFocus={!initialCustomer}
                    error={Boolean(errors.customer_id)}
                    helperText={fieldError('customer_id') ?? t('vehicles.fields.customerHint')}
                  />
                )}
              />
            )}

            <Controller
              name="vehicle_type"
              control={control}
              render={({ field }) => (
                <FormControl component="fieldset">
                  <FormLabel component="legend">{t('vehicles.type.label')}</FormLabel>
                  <RadioGroup row {...field}>
                    {VEHICLE_TYPES.map((type) => (
                      <FormControlLabel
                        key={type}
                        value={type}
                        control={<Radio />}
                        label={t(`vehicles.type.${type}`)}
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
                  <FormLabel component="legend">{t('vehicles.method.label')}</FormLabel>
                  <RadioGroup row {...field}>
                    <FormControlLabel
                      value="usdot"
                      control={<Radio />}
                      label={t('vehicles.method.usdot')}
                    />
                    <FormControlLabel
                      value="plate"
                      control={<Radio />}
                      label={t('vehicles.method.plate')}
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
          </Stack>
        </Paper>

        <Accordion
          variant="outlined"
          expanded={moreOpen}
          onChange={(_event, expanded) => setMoreOpen(expanded)}
          disableGutters
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls="vehicle-more-details"
            id="vehicle-more-details-header"
          >
            <Typography fontWeight={600}>
              {method === 'usdot'
                ? t('vehicles.fields.moreDetailsUsdotMethod')
                : t('vehicles.fields.moreDetailsPlateMethod')}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
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

        <Stack
          direction={{ xs: 'column-reverse', sm: 'row' }}
          spacing={2}
          justifyContent="flex-end"
        >
          <Button onClick={onCancel} disabled={isSubmitting} size="large">
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
            {isSubmitting ? t('common.saving') : submitLabel}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
