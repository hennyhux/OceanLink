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
import Paper from '@mui/material/Paper';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { Controller, useForm, type FieldPath } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { UnsavedChangesGuard } from '@/components/UnsavedChangesGuard';
import { isApiError, isNetworkError, isStaleVersion } from '@/lib/api/errors';

import { customerFormSchema, type CustomerFormValues } from './formModel';

interface CustomerFormProps {
  defaultValues: CustomerFormValues;
  submitLabel: string;
  onSubmit: (values: CustomerFormValues) => Promise<void>;
  onCancel: () => void;
  onReload?: () => void;
}

interface SubmitFailure {
  kind: 'stale' | 'network' | 'unexpected';
  requestId?: string;
}

const FIELD_ERROR_KEYS: Record<string, string> = {
  USDOT_ALREADY_IN_USE: 'customers.errors.usdotInUse',
};

const MORE_DETAIL_FIELDS: ReadonlySet<string> = new Set([
  'address_line1',
  'address_line2',
  'city',
  'state',
  'postal_code',
  'notes',
  'billing_anchor_day',
  'payment_terms',
]);

const KNOWN_FIELDS: ReadonlySet<string> = new Set<FieldPath<CustomerFormValues>>([
  'type',
  'display_name',
  'contact_name',
  'phone',
  'email',
  'usdot_number',
  'address_line1',
  'address_line2',
  'city',
  'state',
  'postal_code',
  'notes',
  'billing_anchor_day',
  'payment_terms',
]);

export function CustomerForm({
  defaultValues,
  submitLabel,
  onSubmit,
  onCancel,
  onReload,
}: CustomerFormProps) {
  const { t } = useTranslation();
  const [failure, setFailure] = useState<SubmitFailure | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues,
    mode: 'onTouched',
  });
  const { register, control, handleSubmit, watch, formState, setError, setFocus } = form;
  const { errors, isSubmitting, isDirty } = formState;
  const type = watch('type');

  const hasMoreDetails = Boolean(
    defaultValues.address_line1 ||
    defaultValues.address_line2 ||
    defaultValues.city ||
    defaultValues.state ||
    defaultValues.postal_code ||
    defaultValues.notes,
  );
  const [moreOpen, setMoreOpen] = useState(hasMoreDetails);

  const submit = handleSubmit(async (values) => {
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
        // A duplicate USDOT is a 409 by code; the backend may or may not add field_errors.
        const fieldErrors: Record<string, string[]> = { ...(error.fieldErrors ?? {}) };
        if (error.code === 'USDOT_ALREADY_IN_USE' && !fieldErrors.usdot_number) {
          fieldErrors.usdot_number = ['USDOT_ALREADY_IN_USE'];
        }
        // Put backend validation next to the field it belongs to.
        let focused = false;
        for (const [field, messages] of Object.entries(fieldErrors)) {
          if (!KNOWN_FIELDS.has(field)) continue;
          const code = messages[0] ?? '';
          setError(field as FieldPath<CustomerFormValues>, {
            type: 'server',
            // Known codes get a translated message; anything else gets a generic one.
            message: FIELD_ERROR_KEYS[code] ?? 'customers.errors.serverInvalid',
          });
          if (!focused && field !== 'type') {
            setFocus(field as FieldPath<CustomerFormValues>);
            focused = true;
          }
          if (MORE_DETAIL_FIELDS.has(field)) {
            setMoreOpen(true);
          }
        }
        if (Object.keys(fieldErrors).length > 0) return;
      }
      setFailure({
        kind: 'unexpected',
        requestId: isApiError(error) ? error.requestId : undefined,
      });
    }
  });

  const fieldError = (name: FieldPath<CustomerFormValues>): string | undefined => {
    const message = errors[name]?.message;
    return message ? t(message) : undefined;
  };

  const nameLabel =
    type === 'business'
      ? t('customers.fields.displayNameBusiness')
      : t('customers.fields.displayNameIndividual');

  return (
    <Box component="form" onSubmit={submit} noValidate>
      <UnsavedChangesGuard when={isDirty && !submitted && !isSubmitting} />

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

            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <FormControl component="fieldset">
                  <FormLabel component="legend">{t('customers.type.label')}</FormLabel>
                  <RadioGroup row {...field}>
                    <FormControlLabel
                      value="business"
                      control={<Radio />}
                      label={t('customers.type.business')}
                    />
                    <FormControlLabel
                      value="individual"
                      control={<Radio />}
                      label={t('customers.type.individual')}
                    />
                  </RadioGroup>
                </FormControl>
              )}
            />

            <TextField
              label={nameLabel}
              required
              fullWidth
              autoFocus
              error={Boolean(errors.display_name)}
              helperText={fieldError('display_name') ?? ' '}
              {...register('display_name')}
            />

            {type === 'business' && (
              <TextField
                label={`${t('customers.fields.contactName')} (${t('common.optional')})`}
                fullWidth
                error={Boolean(errors.contact_name)}
                helperText={fieldError('contact_name') ?? ' '}
                {...register('contact_name')}
              />
            )}

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label={`${t('customers.fields.phone')} (${t('common.optional')})`}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  fullWidth
                  error={Boolean(errors.phone)}
                  helperText={fieldError('phone') ?? t('customers.fields.phoneExample')}
                  {...register('phone')}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label={`${t('customers.fields.email')} (${t('common.optional')})`}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  fullWidth
                  error={Boolean(errors.email)}
                  helperText={fieldError('email') ?? ' '}
                  {...register('email')}
                />
              </Grid>
            </Grid>

            <TextField
              label={`${t('customers.fields.usdot')} (${t('common.optional')})`}
              inputMode="numeric"
              fullWidth
              error={Boolean(errors.usdot_number)}
              helperText={fieldError('usdot_number') ?? t('customers.fields.usdotHint')}
              {...register('usdot_number')}
            />
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
            aria-controls="customer-more-details"
            id="customer-more-details-header"
          >
            <Typography fontWeight={600}>{t('customers.fields.moreDetails')}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2}>
              <Typography component="h2" variant="subtitle1" fontWeight={600}>
                {t('parking.customerDefaults')}
              </Typography>
              <TextField
                label={t('parking.anchor')}
                type="number"
                required
                fullWidth
                {...register('billing_anchor_day')}
                error={Boolean(errors.billing_anchor_day)}
                helperText={fieldError('billing_anchor_day') ?? t('parking.defaultsHint')}
              />
              <TextField
                label={t('parking.paymentTerms')}
                fullWidth
                {...register('payment_terms')}
                error={Boolean(errors.payment_terms)}
                helperText={fieldError('payment_terms') ?? t('parking.defaultTerms')}
              />
              <Typography component="h2" variant="subtitle1" fontWeight={600}>
                {t('customers.fields.address')}
              </Typography>
              <TextField
                label={t('customers.fields.addressLine1')}
                autoComplete="address-line1"
                fullWidth
                error={Boolean(errors.address_line1)}
                helperText={fieldError('address_line1') ?? ' '}
                {...register('address_line1')}
              />
              <TextField
                label={t('customers.fields.addressLine2')}
                autoComplete="address-line2"
                fullWidth
                error={Boolean(errors.address_line2)}
                helperText={fieldError('address_line2') ?? ' '}
                {...register('address_line2')}
              />
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label={t('customers.fields.city')}
                    autoComplete="address-level2"
                    fullWidth
                    error={Boolean(errors.city)}
                    helperText={fieldError('city') ?? ' '}
                    {...register('city')}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <TextField
                    label={t('customers.fields.state')}
                    autoComplete="address-level1"
                    fullWidth
                    error={Boolean(errors.state)}
                    helperText={fieldError('state') ?? ' '}
                    {...register('state')}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <TextField
                    label={t('customers.fields.postalCode')}
                    autoComplete="postal-code"
                    inputMode="numeric"
                    fullWidth
                    error={Boolean(errors.postal_code)}
                    helperText={fieldError('postal_code') ?? ' '}
                    {...register('postal_code')}
                  />
                </Grid>
              </Grid>
              <TextField
                label={t('customers.fields.notes')}
                multiline
                minRows={3}
                fullWidth
                error={Boolean(errors.notes)}
                helperText={fieldError('notes') ?? t('customers.fields.notesHint')}
                {...register('notes')}
              />
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
