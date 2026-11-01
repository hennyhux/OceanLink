import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { KeyValueList } from '@/components/KeyValueList';
import { SectionCard } from '@/components/SectionCard';
import { useToast } from '@/components/toastContext';
import { hasCode, hasStatus } from '@/lib/api/errors';
import { formatDateTime } from '@/lib/dates';

import { formatAddress } from './model';
import { useSetCustomerActive } from './api';
import type { Customer } from './types';

export function CustomerDetailsTab({
  customer,
  onReload,
}: {
  customer: Customer;
  onReload: () => void;
}) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const setActive = useSetCustomerActive(customer);
  const [confirm, setConfirm] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const language = i18n.resolvedLanguage ?? 'en';

  const change = async (isActive: boolean) => {
    setErrorKey(null);
    try {
      await setActive.mutateAsync(isActive);
      setConfirm(false);
      toast.success(t(isActive ? 'customers.reactivated' : 'customers.deactivated'));
    } catch (error) {
      setConfirm(false);
      if (hasStatus(error, 412)) {
        setErrorKey('errors.staleReloaded');
        onReload();
      } else if (hasCode(error, 'USDOT_ALREADY_IN_USE'))
        setErrorKey('customers.errors.usdotInUseReactivate');
      else setErrorKey('errors.saveFailed');
    }
  };

  return (
    <SectionCard title={t('customers.allDetails')}>
      <KeyValueList
        items={[
          { label: t('customers.fields.type'), value: t(`customers.type.${customer.type}`) },
          { label: t('customers.fields.displayName'), value: customer.display_name },
          ...(customer.type === 'business'
            ? [{ label: t('customers.fields.contactName'), value: customer.contact_name }]
            : []),
          {
            label: t('customers.fields.phone'),
            value: customer.phone && <Link href={`tel:${customer.phone}`}>{customer.phone}</Link>,
          },
          {
            label: t('customers.fields.email'),
            value: customer.email && (
              <Link href={`mailto:${customer.email}`}>{customer.email}</Link>
            ),
          },
          { label: t('customers.fields.usdot'), value: customer.usdot_number },
          { label: t('customers.fields.address'), value: formatAddress(customer), wide: true },
          { label: t('customers.fields.notes'), value: customer.notes, wide: true },
          {
            label: t('customers.fields.created'),
            value: formatDateTime(customer.created_at, language),
          },
          {
            label: t('customers.fields.updated'),
            value: formatDateTime(customer.updated_at, language),
          },
        ]}
      />
      <Box sx={{ mt: 3, pt: 3, borderTop: 1, borderColor: 'divider' }}>
        {errorKey && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErrorKey(null)}>
            {t(errorKey)}
          </Alert>
        )}
        {customer.is_active ? (
          <Button color="error" variant="outlined" onClick={() => setConfirm(true)}>
            {t('customers.deactivate')}
          </Button>
        ) : (
          <Button
            variant="outlined"
            onClick={() => void change(true)}
            disabled={setActive.isPending}
          >
            {t('customers.reactivate')}
          </Button>
        )}
      </Box>
      <ConfirmDialog
        open={confirm}
        title={t('customers.deactivateTitle', { name: customer.display_name })}
        body={t('customers.deactivateBody')}
        confirmLabel={t('customers.deactivateConfirm')}
        busy={setActive.isPending}
        onConfirm={() => void change(false)}
        onClose={() => setConfirm(false)}
      />
    </SectionCard>
  );
}
