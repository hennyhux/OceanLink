import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { PageHeader } from '@/components/PageHeader';
import type { FlashState } from '@/components/FlashMessage';

import { CustomerForm } from './CustomerForm';
import { emptyCustomerForm, formToWrite } from './formModel';
import { useCreateCustomer } from './queries';

export function CustomerNewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const create = useCreateCustomer();

  return (
    <>
      <PageHeader title={t('customers.newTitle')} />
      <CustomerForm
        defaultValues={emptyCustomerForm}
        submitLabel={t('customers.add')}
        onCancel={() => void navigate('/customers')}
        onSubmit={async (values) => {
          const created = await create.mutateAsync(formToWrite(values));
          const state: FlashState = { flash: { messageKey: 'customers.created' } };
          void navigate(`/customers/${created.id}`, { replace: true, state });
        }}
      />
    </>
  );
}
