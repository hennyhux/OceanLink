import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ContactPhoneOutlinedIcon from '@mui/icons-material/ContactPhoneOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useParams, useSearchParams } from 'react-router';

import { ActiveStatus } from '@/components/ActiveStatus';
import { useBreadcrumbs } from '@/components/breadcrumbs';
import { InitialsTile } from '@/components/IconTile';
import { KeyValueList } from '@/components/KeyValueList';
import { PageHeader } from '@/components/PageHeader';
import { SectionCard } from '@/components/SectionCard';
import { ErrorState, LoadingState } from '@/components/States';
import { useToast } from '@/components/toastContext';
import { MonthlyChargesDialog } from '@/features/billing/MonthlyChargesDialog';
import { OneTimeChargeDialog } from '@/features/billing/OneTimeChargeDialog';
import { RecordPaymentDialog } from '@/features/payments/RecordPaymentDialog';
import { useVehicleList } from '@/features/vehicles/api';
import { hasStatus, requestIdOf } from '@/lib/api/errors';
import { safeReturnTo, withReturnTo } from '@/lib/navigation';

import { useCustomer } from './api';
import { CustomerAccountCard } from './CustomerAccountCard';
import { CustomerDetailsTab } from './CustomerDetailsTab';
import { CustomerTransactionsTab } from './CustomerTransactionsTab';
import { CustomerVehiclesTab } from './CustomerVehiclesTab';

const TABS = ['vehicles', 'transactions', 'details'] as const;
type TabName = (typeof TABS)[number];
type DialogName = 'payment' | 'charge' | 'monthly' | null;

export default function CustomerDetailPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const customerQuery = useCustomer(id);
  const vehicles = useVehicleList({ customer_id: id, page_size: 100 }, Boolean(id));
  const [dialog, setDialog] = useState<DialogName>(null);
  const tabParam = params.get('tab');
  const tab: TabName = TABS.includes(tabParam as TabName) ? (tabParam as TabName) : 'vehicles';
  const listLink = safeReturnTo(params.get('returnTo'), '/customers');
  const customer = customerQuery.data;

  useBreadcrumbs([
    { label: t('nav.customers'), to: listLink },
    { label: customer?.display_name ?? t('common.loading') },
  ]);

  if (customerQuery.isPending) return <LoadingState rows={6} />;
  if (!customer) {
    const missing = hasStatus(customerQuery.error, 404);
    return (
      <ErrorState
        title={missing ? t('customers.notFoundTitle') : undefined}
        body={missing ? t('customers.notFoundBody') : undefined}
        onRetry={missing ? undefined : () => void customerQuery.refetch()}
        requestId={requestIdOf(customerQuery.error)}
      />
    );
  }

  const selectTab = (next: TabName) =>
    setParams(
      (current) => {
        const copy = new URLSearchParams(current);
        copy.set('tab', next);
        return copy;
      },
      { replace: true },
    );
  const editLink = withReturnTo(
    `/customers/${customer.id}/edit`,
    `/customers/${customer.id}?tab=${tab}`,
  );
  const vehicleCount = vehicles.data?.total;

  return (
    <>
      <PageHeader
        leading={<InitialsTile name={customer.display_name} size={56} />}
        title={customer.display_name}
        status={<ActiveStatus isActive={customer.is_active} />}
        subtitle={[
          t(`customers.type.${customer.type}`),
          customer.usdot_number ? t('vehicles.usdotLabel', { usdot: customer.usdot_number }) : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        secondaryActions={
          <Button
            component={RouterLink}
            to={editLink}
            variant="outlined"
            size="large"
            startIcon={<EditOutlinedIcon />}
          >
            {t('common.edit')}
          </Button>
        }
      />
      {!customer.is_active && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {t('customers.inactiveBanner')}
        </Alert>
      )}

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 7 }}>
          <CustomerAccountCard
            customerId={customer.id}
            onRecordPayment={() => setDialog('payment')}
            onAddCharge={() => setDialog('charge')}
            onReviewCharges={() => setDialog('monthly')}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <SectionCard title={t('customers.contact')} icon={<ContactPhoneOutlinedIcon />}>
            <KeyValueList
              columns={1}
              items={[
                ...(customer.type === 'business'
                  ? [{ label: t('customers.fields.contactName'), value: customer.contact_name }]
                  : []),
                {
                  label: t('customers.fields.phone'),
                  value: customer.phone && (
                    <Link href={`tel:${customer.phone}`}>{customer.phone}</Link>
                  ),
                },
                {
                  label: t('customers.fields.email'),
                  value: customer.email && (
                    <Link href={`mailto:${customer.email}`}>{customer.email}</Link>
                  ),
                },
              ]}
            />
            <Button onClick={() => selectTab('details')} sx={{ mt: 2, px: 0 }}>
              {t('customers.showAllDetails')}
            </Button>
          </SectionCard>
        </Grid>
      </Grid>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs
          value={tab}
          onChange={(_event, value: TabName) => selectTab(value)}
          variant="scrollable"
          allowScrollButtonsMobile
          aria-label={t('customers.sections')}
        >
          <Tab
            value="vehicles"
            id="tab-vehicles"
            aria-controls="panel-vehicles"
            label={
              vehicleCount === undefined
                ? t('nav.vehicles')
                : t('customers.vehiclesWithCount', { count: vehicleCount })
            }
          />
          <Tab
            value="transactions"
            id="tab-transactions"
            aria-controls="panel-transactions"
            label={t('transactions.title')}
          />
          <Tab
            value="details"
            id="tab-details"
            aria-controls="panel-details"
            label={t('customers.details')}
          />
        </Tabs>
      </Box>
      <Box role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'vehicles' && <CustomerVehiclesTab customerId={customer.id} query={vehicles} />}
        {tab === 'transactions' && <CustomerTransactionsTab customerId={customer.id} />}
        {tab === 'details' && (
          <CustomerDetailsTab customer={customer} onReload={() => void customerQuery.refetch()} />
        )}
      </Box>

      {dialog === 'payment' && (
        <RecordPaymentDialog
          customer={customer}
          onClose={() => setDialog(null)}
          onRecorded={() => {
            setDialog(null);
            toast.success(t('payments.recorded'));
          }}
        />
      )}
      {dialog === 'charge' && (
        <OneTimeChargeDialog customer={customer} onClose={() => setDialog(null)} />
      )}
      {dialog === 'monthly' && (
        <MonthlyChargesDialog
          customerId={customer.id}
          vehicles={vehicles.data?.items ?? []}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
