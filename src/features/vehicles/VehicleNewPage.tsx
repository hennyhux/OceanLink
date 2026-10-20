import Link from '@mui/material/Link';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router';

import { useCustomer } from '@/features/customers/queries';
import { ErrorState } from '@/components/ErrorState';
import type { FlashState } from '@/components/FlashMessage';
import { LoadingState } from '@/components/LoadingState';
import { PageHeader } from '@/components/PageHeader';
import { isNotFound } from '@/lib/api/errors';
import { safeReturnTo } from '@/lib/navigation';

import { emptyVehicleForm, formToWrite } from './formModel';
import { useCreateVehicle } from './queries';
import { VehicleForm } from './VehicleForm';

export function VehicleNewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const customerId = searchParams.get('customer_id') ?? '';
  const returnTo = safeReturnTo(searchParams.get('returnTo'), '/vehicles');
  const create = useCreateVehicle();
  // When the owner is already known (from the customer page) it is filled in and shown first.
  const customerQuery = useCustomer(customerId || undefined);

  if (customerId && customerQuery.isPending) {
    return <LoadingState label={t('app.loading')} />;
  }

  if (customerId && customerQuery.isError) {
    const notFound = isNotFound(customerQuery.error);
    return (
      <ErrorState
        title={notFound ? t('customers.notFoundTitle') : t('common.loadFailedTitle')}
        body={notFound ? t('customers.notFoundBody') : t('common.loadFailedBody')}
        actionLabel={notFound ? t('vehicles.backToList') : t('app.retry')}
        onAction={() =>
          notFound ? void navigate('/vehicles', { replace: true }) : void customerQuery.refetch()
        }
      />
    );
  }

  const customer = customerId ? (customerQuery.data ?? null) : null;

  return (
    <>
      <Link
        component={RouterLink}
        to={returnTo}
        underline="hover"
        sx={{ display: 'inline-block', mb: 1 }}
      >
        ← {t('common.back')}
      </Link>
      <PageHeader title={t('vehicles.newTitle')} />
      <VehicleForm
        defaultValues={emptyVehicleForm(customer?.id ?? '', customer?.usdot_number ?? null)}
        initialCustomer={customer}
        submitLabel={t('vehicles.add')}
        onCancel={() => void navigate(returnTo)}
        onSubmit={async (values) => {
          await create.mutateAsync(formToWrite(values));
          const state: FlashState = { flash: { messageKey: 'vehicles.created' } };
          void navigate(returnTo, { replace: true, state });
        }}
      />
    </>
  );
}
