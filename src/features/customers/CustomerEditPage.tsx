import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router';

import { useBreadcrumbs } from '@/components/breadcrumbs';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState, LoadingState } from '@/components/States';
import { useToast } from '@/components/toastContext';
import { hasStatus, requestIdOf } from '@/lib/api/errors';
import { safeReturnTo } from '@/lib/navigation';

import { useCustomer, useSaveCustomer } from './api';
import { CustomerForm } from './CustomerForm';
import { changedFields, customerToForm, formToWrite } from './model';

export default function CustomerEditPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const customerQuery = useCustomer(id);
  const customer = customerQuery.data;
  const save = useSaveCustomer(customer);
  const back = safeReturnTo(params.get('returnTo'), `/customers/${id}`);
  // The form restarts only on an explicit reload, so a background refresh never wipes typing.
  const [formKey, setFormKey] = useState(0);
  useBreadcrumbs([
    { label: t('nav.customers'), to: '/customers' },
    { label: customer?.display_name ?? t('common.loading'), to: back },
    { label: t('common.edit') },
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

  return (
    <>
      <PageHeader title={t('customers.editTitle', { name: customer.display_name })} />
      <CustomerForm
        key={`${customer.id}-${formKey}`}
        defaultValues={customerToForm(customer)}
        submitLabel={t('customers.saveChanges')}
        onCancel={() => void navigate(back)}
        onReload={() => {
          void customerQuery.refetch().then((result) => {
            if (!result.isError) setFormKey((value) => value + 1);
          });
        }}
        onSubmit={async (values) => {
          const changes = changedFields(formToWrite(customerToForm(customer)), formToWrite(values));
          if (Object.keys(changes).length > 0) {
            await save.mutateAsync(changes);
            toast.success(t('customers.saved'));
          } else {
            toast.success(t('common.noChanges'));
          }
          void navigate(back, { replace: true });
        }}
      />
    </>
  );
}
