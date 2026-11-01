import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';

import { useBreadcrumbs } from '@/components/breadcrumbs';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState, LoadingState } from '@/components/States';
import { useToast } from '@/components/toastContext';
import { useCustomer } from '@/features/customers/api';
import { hasStatus, requestIdOf } from '@/lib/api/errors';
import { safeReturnTo } from '@/lib/navigation';

import { useCreateVehicle } from './api';
import { emptyVehicleForm, formToCreate } from './model';
import { VehicleForm } from './VehicleForm';

export default function VehicleNewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const customerId = params.get('customer_id') ?? '';
  const back = safeReturnTo(params.get('returnTo'), '/vehicles');
  const create = useCreateVehicle();
  // When the owner is known (coming from a customer page) it is filled in.
  const customerQuery = useCustomer(customerId || undefined);
  useBreadcrumbs([{ label: t('nav.vehicles'), to: '/vehicles' }, { label: t('vehicles.add') }]);

  if (customerId && customerQuery.isPending) return <LoadingState rows={6} />;
  if (customerId && customerQuery.isError) {
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
  const customer = customerId ? (customerQuery.data ?? null) : null;

  return (
    <>
      <PageHeader
        title={t('vehicles.add')}
        subtitle={customer ? t('vehicles.addFor', { name: customer.display_name }) : undefined}
      />
      <VehicleForm
        defaultValues={emptyVehicleForm(customer?.id ?? '', customer?.usdot_number ?? null)}
        initialCustomer={customer}
        submitLabel={t('vehicles.add')}
        onCancel={() => void navigate(back)}
        onSubmit={async (values) => {
          await create.mutateAsync(formToCreate(values, t('parking.firstReason')));
          toast.success(t('vehicles.created'));
          void navigate(back, { replace: true });
        }}
      />
    </>
  );
}
