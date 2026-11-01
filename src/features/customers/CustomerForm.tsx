import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import StickyNote2OutlinedIcon from '@mui/icons-material/StickyNote2Outlined';
import { zodResolver } from '@hookform/resolvers/zod';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import Grid from '@mui/material/Grid';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { FormErrorSummary } from '@/components/FormErrorSummary';
import { InsetGroup, SectionCard } from '@/components/SectionCard';
import { UnsavedChangesGuard } from '@/components/UnsavedChangesGuard';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { hasStatus, isApiError, requestIdOf } from '@/lib/api/errors';
import { applyServerFieldErrors } from '@/lib/forms';

import { CUSTOMER_FIELDS, customerFormSchema, type CustomerFormValues } from './model';

const SERVER_MESSAGES: Record<string, string> = {
  REQUIRED: 'customers.errors.nameRequired',
  INVALID_EMAIL: 'customers.errors.emailInvalid',
  INVALID_USDOT: 'customers.errors.usdotDigits',
  USDOT_ALREADY_IN_USE: 'customers.errors.usdotInUse',
};

interface Props {
  defaultValues: CustomerFormValues;
  submitLabel: string;
  onSubmit: (values: CustomerFormValues) => Promise<void>;
  onCancel: () => void;
  onReload?: () => void;
}

type Failure = { kind: 'stale' | 'network' | 'unexpected'; requestId?: string };

export function CustomerForm({ defaultValues, submitLabel, onSubmit, onCancel, onReload }: Props) {
  const { t } = useTranslation();
  const online = useOnlineStatus();
  const [failure, setFailure] = useState<Failure | null>(null);
  const [saved, setSaved] = useState(false);
  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues,
    mode: 'onTouched',
  });
  const { register, control, formState, watch, setError, setFocus } = form;
  const { errors, isSubmitting, isDirty, submitCount } = formState;
  const isBusiness = watch('type') === 'business';

  const message = (name: keyof CustomerFormValues) => {
    const text = errors[name]?.message;
    return text ? t(text) : undefined;
  };

  const submit = form.handleSubmit(
    async (values) => {
      setFailure(null);
      try {
        await onSubmit(values);
        setSaved(true);
      } catch (error) {
        if (hasStatus(error, 412)) return setFailure({ kind: 'stale' });
        const field = applyServerFieldErrors(
          error,
          setError,
          CUSTOMER_FIELDS,
          SERVER_MESSAGES,
          'form.invalid',
        );
        if (field) return setFocus(field);
        setFailure({
          kind: isApiError(error) ? 'unexpected' : 'network',
          requestId: requestIdOf(error),
        });
      }
    },
    (invalid) => {
      const first = CUSTOMER_FIELDS.find((name) => invalid[name]);
      if (first) setFocus(first);
    },
  );

  const labels: Partial<Record<keyof CustomerFormValues, string>> = {
    display_name: t('customers.fields.displayName'),
    contact_name: t('customers.fields.contactName'),
    phone: t('customers.fields.phone'),
    email: t('customers.fields.email'),
    usdot_number: t('customers.fields.usdot'),
    notes: t('customers.fields.notes'),
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
          {t(failure.kind === 'network' ? 'errors.saveFailed' : 'errors.saveUnexpected')}
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
        onPick={(name) => setFocus(name)}
      />
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {t('form.requiredHint')}
      </Typography>

      <Stack spacing={3}>
        <SectionCard title={t('customers.formCustomer')} icon={<PersonOutlineIcon />}>
          <Stack spacing={2.5}>
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <FormControl component="fieldset">
                  <FormLabel
                    component="legend"
                    sx={{ mb: 1, color: 'text.primary', fontWeight: 500 }}
                  >
                    {t('customers.fields.type')}
                  </FormLabel>
                  <RadioGroup row {...field} sx={{ gap: 1.5 }}>
                    {(['business', 'individual'] as const).map((value) => (
                      <FormControlLabel
                        key={value}
                        value={value}
                        control={<Radio />}
                        label={
                          <Box>
                            <Typography sx={{ fontWeight: 600 }}>
                              {t(`customers.type.${value}`)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {t(`customers.typeHint.${value}`)}
                            </Typography>
                          </Box>
                        }
                        sx={{
                          m: 0,
                          pr: 2,
                          py: 1,
                          flex: '1 1 220px',
                          border: 2,
                          borderRadius: 2,
                          borderColor: field.value === value ? 'primary.main' : 'divider',
                          bgcolor: field.value === value ? 'primary.light' : 'background.paper',
                        }}
                      />
                    ))}
                  </RadioGroup>
                </FormControl>
              )}
            />
            <TextField
              label={t(
                isBusiness ? 'customers.fields.businessName' : 'customers.fields.personName',
              )}
              required
              error={Boolean(errors.display_name)}
              helperText={message('display_name')}
              {...register('display_name')}
            />
            <TextField
              label={`${t('customers.fields.usdot')} (${t('form.optional')})`}
              inputMode="numeric"
              error={Boolean(errors.usdot_number)}
              helperText={message('usdot_number') ?? t('customers.usdotHint')}
              {...register('usdot_number')}
            />
          </Stack>
        </SectionCard>

        <SectionCard title={t('customers.contactAndAddress')}>
          <Stack spacing={2.5}>
            <InsetGroup title={t('customers.contact')}>
              <Grid container spacing={2}>
                {isBusiness && (
                  <Grid size={12}>
                    <TextField
                      label={`${t('customers.fields.contactName')} (${t('form.optional')})`}
                      error={Boolean(errors.contact_name)}
                      helperText={message('contact_name')}
                      {...register('contact_name')}
                    />
                  </Grid>
                )}
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label={`${t('customers.fields.phone')} (${t('form.optional')})`}
                    type="tel"
                    autoComplete="off"
                    error={Boolean(errors.phone)}
                    helperText={message('phone') ?? t('customers.phoneHint')}
                    {...register('phone')}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label={`${t('customers.fields.email')} (${t('form.optional')})`}
                    type="email"
                    autoComplete="off"
                    error={Boolean(errors.email)}
                    helperText={message('email')}
                    {...register('email')}
                  />
                </Grid>
              </Grid>
            </InsetGroup>
            <InsetGroup title={t('customers.billingAddress')}>
              <Grid container spacing={2}>
                <Grid size={12}>
                  <TextField
                    label={`${t('customers.fields.address1')} (${t('form.optional')})`}
                    {...register('address_line1')}
                  />
                </Grid>
                <Grid size={12}>
                  <TextField
                    label={`${t('customers.fields.address2')} (${t('form.optional')})`}
                    {...register('address_line2')}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 5 }}>
                  <TextField
                    label={`${t('customers.fields.city')} (${t('form.optional')})`}
                    {...register('city')}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <TextField
                    label={`${t('customers.fields.state')} (${t('form.optional')})`}
                    {...register('state')}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <TextField
                    label={`${t('customers.fields.postalCode')} (${t('form.optional')})`}
                    {...register('postal_code')}
                  />
                </Grid>
              </Grid>
            </InsetGroup>
          </Stack>
        </SectionCard>

        <SectionCard title={t('customers.fields.notes')} icon={<StickyNote2OutlinedIcon />}>
          <TextField
            label={`${t('customers.fields.notes')} (${t('form.optional')})`}
            multiline
            minRows={3}
            error={Boolean(errors.notes)}
            helperText={message('notes') ?? t('customers.notesHint')}
            {...register('notes')}
          />
        </SectionCard>

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
