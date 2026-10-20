import Alert from '@mui/material/Alert';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';

import { ErrorState } from '@/components/ErrorState';
import type { FlashState } from '@/components/FlashMessage';
import { LoadingState } from '@/components/LoadingState';
import { PageHeader } from '@/components/PageHeader';
import { isNotFound } from '@/lib/api/errors';

import { CustomerForm } from './CustomerForm';
import { customerToForm, diffWrite, formToWrite } from './formModel';
import { useCustomer, useUpdateCustomer } from './queries';

export function CustomerEditPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const customerQuery = useCustomer(id);
  const update = useUpdateCustomer(id);
  // Only an explicit reload resets the form, so a background refetch never wipes typed edits.
  const [reloadCount, setReloadCount] = useState(0);

  // Fetch the latest record and restart the form from it. If the fetch fails the form is kept,
  // so typed edits are not lost for nothing.
  const reloadCustomer = async () => {
    const result = await customerQuery.refetch();
    if (!result.isError) setReloadCount((n) => n + 1);
  };

  if (customerQuery.isPending) {
    return <LoadingState label={t('app.loading')} />;
  }

  const customer = customerQuery.data;

  // A failed reload keeps the form; only a first load can end in this screen.
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

  return (
    <>
      <PageHeader title={t('customers.editTitle')} description={customer.display_name} />
      {customerQuery.isRefetchError && (
        <Alert severity="warning" role="status" sx={{ mb: 2 }}>
          {t('common.reloadFailed')}
        </Alert>
      )}
      <CustomerForm
        key={reloadCount}
        defaultValues={customerToForm(customer)}
        submitLabel={t('common.save')}
        onCancel={() => void navigate(`/customers/${customer.id}`)}
        onReload={() => void reloadCustomer()}
        onSubmit={async (values) => {
          const changes = diffWrite(formToWrite(customerToForm(customer)), formToWrite(values));
          if (Object.keys(changes).length > 0) {
            await update.mutateAsync({ version: customer.version, body: changes });
          }
          const state: FlashState = {
            flash: {
              messageKey:
                Object.keys(changes).length > 0 ? 'customers.saved' : 'customers.noChanges',
              severity: Object.keys(changes).length > 0 ? 'success' : 'info',
            },
          };
          void navigate(`/customers/${customer.id}`, { replace: true, state });
        }}
      />
    </>
  );
}
