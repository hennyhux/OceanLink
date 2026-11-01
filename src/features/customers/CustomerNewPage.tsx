import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { useBreadcrumbs } from '@/components/breadcrumbs';
import { PageHeader } from '@/components/PageHeader';
import { useToast } from '@/components/toastContext';

import { useSaveCustomer } from './api';
import { CustomerForm } from './CustomerForm';
import { emptyCustomerForm, formToWrite } from './model';

export default function CustomerNewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const save = useSaveCustomer();
  useBreadcrumbs([{ label: t('nav.customers'), to: '/customers' }, { label: t('customers.add') }]);

  return (
    <>
      <PageHeader title={t('customers.add')} subtitle={t('customers.addSubtitle')} />
      <CustomerForm
        defaultValues={emptyCustomerForm()}
        submitLabel={t('customers.save')}
        onCancel={() => void navigate('/customers')}
        onSubmit={async (values) => {
          const created = await save.mutateAsync(formToWrite(values));
          toast.success(t('customers.created'));
          void navigate(`/customers/${created.id}`, { replace: true });
        }}
      />
    </>
  );
}
