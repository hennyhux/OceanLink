import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate, useParams } from 'react-router';

import { ActiveStatusChip } from '@/components/ActiveStatusChip';
import { ErrorState } from '@/components/ErrorState';
import { FlashMessage } from '@/components/FlashMessage';
import { LoadingState } from '@/components/LoadingState';
import { PageHeader } from '@/components/PageHeader';
import { CustomerVehicles } from '@/features/vehicles/CustomerVehicles';
import { CustomerAccount } from '@/features/billing/CustomerAccount';
import { PaymentsPage } from '@/features/payments/PaymentsPage';
import { isApiError, isNetworkError, isNotFound, isStaleVersion } from '@/lib/api/errors';

import { useCustomer, useSetCustomerActive } from './queries';
import type { Customer } from './types';

function Field({ label, value }: { label: string; value: ReactNode }) {
  const { t } = useTranslation();
  return (
    <Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant="body2" color="text.secondary" component="dt">
        {label}
      </Typography>
      <Typography component="dd" sx={{ m: 0, overflowWrap: 'anywhere' }}>
        {value || (
          <span style={{ color: 'inherit', opacity: 0.75 }}>{t('common.notProvided')}</span>
        )}
      </Typography>
    </Grid>
  );
}

function formatAddress(customer: Customer): string {
  const line = [customer.address_line1, customer.address_line2].filter(Boolean).join(', ');
  const cityLine = [customer.city, customer.state].filter(Boolean).join(', ');
  return [line, [cityLine, customer.postal_code].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join('\n');
}

function formatDate(iso: string, language: string): string {
  try {
    return new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function CustomerDetailPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const customerQuery = useCustomer(id);
  const setActive = useSetCustomerActive(id);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionDone, setActionDone] = useState<string | null>(null);

  if (customerQuery.isPending) {
    return <LoadingState label={t('app.loading')} />;
  }

  const customer = customerQuery.data;

  // A failed background refresh keeps showing what we already have; only a first load can fail.
  if (!customer) {
    const notFound = isNotFound(customerQuery.error);
    return (
      <ErrorState
        title={notFound ? t('customers.notFoundTitle') : t('common.loadFailedTitle')}
        body={notFound ? t('customers.notFoundBody') : t('common.loadFailedBody')}
        actionLabel={notFound ? t('customers.backToList') : t('app.retry')}
        onAction={() =>
          notFound ? void navigate('/customers', { replace: true }) : void customerQuery.refetch()
        }
      />
    );
  }

  const changeActive = async (isActive: boolean) => {
    setActionError(null);
    setActionDone(null);
    try {
      await setActive.mutateAsync({ version: customer.version, isActive });
      setConfirmOpen(false);
      setActionDone(isActive ? t('customers.reactivated') : t('customers.deactivated'));
    } catch (error) {
      setConfirmOpen(false);
      if (isStaleVersion(error)) {
        // The query refetches below, so the page already shows the latest version.
        setActionError(t('common.staleRefreshed'));
        void customerQuery.refetch();
      } else if (isNetworkError(error)) {
        setActionError(t('common.saveFailed'));
      } else if (isApiError(error) && error.code === 'USDOT_ALREADY_IN_USE') {
        setActionError(t('customers.errors.usdotInUseReactivate'));
      } else {
        const requestId = isApiError(error) ? error.requestId : undefined;
        setActionError(
          requestId
            ? `${t('common.saveFailedUnexpected')} ${t('common.problemNumber', { id: requestId })}`
            : t('common.saveFailedUnexpected'),
        );
      }
    }
  };

  const address = formatAddress(customer);

  return (
    <>
      <FlashMessage message={(key) => t(key)} />
      <Link
        component={RouterLink}
        to="/customers"
        underline="hover"
        sx={{ display: 'inline-block', mb: 1 }}
      >
        ← {t('customers.backToList')}
      </Link>
      <PageHeader
        title={customer.display_name}
        description={`${t(`customers.type.${customer.type}`)}${
          customer.usdot_number ? ` · USDOT ${customer.usdot_number}` : ''
        }`}
        action={
          <Stack direction="row" spacing={1} alignItems="center">
            <ActiveStatusChip isActive={customer.is_active} />
            <Button
              component={RouterLink}
              to={`/customers/${customer.id}/edit`}
              variant="contained"
              startIcon={<EditOutlinedIcon />}
            >
              {t('common.edit')}
            </Button>
          </Stack>
        }
      />

      {!customer.is_active && (
        <Alert severity="warning" role="status" sx={{ mb: 2 }}>
          {t('customers.inactiveBanner')}
        </Alert>
      )}
      {actionDone && (
        <Alert severity="success" role="status" sx={{ mb: 2 }} onClose={() => setActionDone(null)}>
          {actionDone}
        </Alert>
      )}
      {actionError && (
        <Alert severity="error" role="alert" sx={{ mb: 2 }} onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      <Stack spacing={2}>
        <CustomerAccount customerId={customer.id} />
        <PaymentsPage customer={customer} />
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography component="h2" variant="h6" fontWeight={600} sx={{ mb: 2 }}>
            {t('customers.sections.contact')}
          </Typography>
          <Grid container spacing={2} component="dl" sx={{ m: 0 }}>
            {customer.type === 'business' && (
              <Field label={t('customers.fields.contactName')} value={customer.contact_name} />
            )}
            <Field
              label={t('customers.fields.phone')}
              value={customer.phone && <Link href={`tel:${customer.phone}`}>{customer.phone}</Link>}
            />
            <Field
              label={t('customers.fields.email')}
              value={
                customer.email && <Link href={`mailto:${customer.email}`}>{customer.email}</Link>
              }
            />
            <Field label={t('customers.fields.usdot')} value={customer.usdot_number} />
            <Field
              label={t('customers.fields.address')}
              value={address && <span style={{ whiteSpace: 'pre-line' }}>{address}</span>}
            />
            <Field
              label={t('customers.fields.notes')}
              value={
                customer.notes && <span style={{ whiteSpace: 'pre-line' }}>{customer.notes}</span>
              }
            />
            <Field
              label={t('customers.fields.created')}
              value={formatDate(customer.created_at, i18n.resolvedLanguage ?? 'en')}
            />
            <Field
              label={t('customers.fields.updated')}
              value={formatDate(customer.updated_at, i18n.resolvedLanguage ?? 'en')}
            />
          </Grid>
        </Paper>

        <CustomerVehicles customerId={customer.id} />

        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
          {customer.is_active ? (
            <Button
              color="error"
              variant="outlined"
              onClick={() => setConfirmOpen(true)}
              disabled={setActive.isPending}
            >
              {t('customers.deactivate.action')}
            </Button>
          ) : (
            <Button
              variant="outlined"
              onClick={() => void changeActive(true)}
              disabled={setActive.isPending}
            >
              {t('customers.reactivate.action')}
            </Button>
          )}
        </Paper>
      </Stack>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        aria-labelledby="deactivate-title"
        aria-describedby="deactivate-body"
      >
        <DialogTitle id="deactivate-title">
          {t('customers.deactivate.title', { name: customer.display_name })}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="deactivate-body">
            {t('customers.deactivate.body')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} autoFocus disabled={setActive.isPending}>
            {t('common.cancel')}
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => void changeActive(false)}
            disabled={setActive.isPending}
          >
            {t('customers.deactivate.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
