import AddIcon from '@mui/icons-material/Add';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';

import { useBreadcrumbs } from '@/components/breadcrumbs';
import { FilterBar, SearchField } from '@/components/FilterBar';
import { ListCard } from '@/components/ListCard';
import { Money } from '@/components/Money';
import { PageHeader } from '@/components/PageHeader';
import { StatusPill } from '@/components/StatusPill';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useToast } from '@/components/toastContext';
import { useListSearch } from '@/hooks/useListSearch';
import { hasCode, requestIdOf } from '@/lib/api/errors';
import { pageCount } from '@/lib/api/paging';
import { formatDate } from '@/lib/dates';

import { usePayments } from './api';
import { ReceiptDialog } from './ReceiptDialog';
import { RecordPaymentDialog } from './RecordPaymentDialog';
import { PAYMENT_METHODS, type Payment, type PaymentMethod, type PaymentStatus } from './types';

const PAGE_SIZE = 20;

function Status({ payment }: { payment: Payment }) {
  const { t } = useTranslation();
  return payment.status === 'reversed' ? (
    <StatusPill tone="neutral" label={t('status.reversed')} />
  ) : (
    <StatusPill tone="success" label={t('status.received')} />
  );
}

export default function PaymentsPage() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const toast = useToast();
  const narrow = useMediaQuery(theme.breakpoints.down('md'));
  const search = useListSearch();
  const language = i18n.resolvedLanguage ?? 'en';
  const method = search.value('method') as PaymentMethod | '';
  const status = search.value('status') as PaymentStatus | '';
  const from = search.value('from');
  const to = search.value('to');
  const recordOpen = search.flag('record');
  const [receipt, setReceipt] = useState<string | null>(null);
  useBreadcrumbs([{ label: t('nav.payments') }]);

  const list = usePayments({
    q: search.q || undefined,
    method: method || undefined,
    status: status || undefined,
    from: from || undefined,
    to: to || undefined,
    page: search.page,
    page_size: PAGE_SIZE,
  });
  const data = list.data;
  const filtered = Boolean(search.q || method || status || from || to);

  let content;
  if (list.isPending)
    content = (
      <Box sx={{ px: 3, pb: 3 }}>
        <LoadingState rows={5} />
      </Box>
    );
  else if (list.isError && !data) {
    content = hasCode(list.error, 'INVALID_FILTERS') ? (
      <EmptyState message={t('payments.badFilters')} />
    ) : (
      <ErrorState onRetry={() => void list.refetch()} requestId={requestIdOf(list.error)} />
    );
  } else if (data && data.total === 0) {
    content = (
      <EmptyState
        message={t(filtered ? 'payments.noMatches' : 'payments.empty')}
        action={
          filtered ? (
            <Button
              variant="outlined"
              onClick={() =>
                search.setValues({ q: null, method: null, status: null, from: null, to: null })
              }
            >
              {t('list.clearFilters')}
            </Button>
          ) : undefined
        }
      />
    );
  } else if (data && narrow) {
    content = (
      <Box component="ul" aria-label={t('nav.payments')} sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {data.items.map((payment) => (
          <Box
            component="li"
            key={payment.id}
            sx={{ borderTop: 1, borderColor: 'divider', px: 2, py: 1.75 }}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 1,
                alignItems: 'baseline',
              }}
            >
              <Money cents={payment.amount.amount} size="body" />
              <Status payment={payment} />
            </Box>
            <Link
              component={RouterLink}
              to={`/customers/${payment.customer_id}`}
              sx={{ fontWeight: 600 }}
            >
              {payment.customer_name}
            </Link>
            <Typography variant="body2" color="text.secondary">
              {formatDate(payment.effective_on, language)} ·{' '}
              {t(`payments.methods.${payment.method}`)}
            </Typography>
            <Button size="small" onClick={() => setReceipt(payment.id)} sx={{ mt: 0.5, px: 0 }}>
              {t('payments.viewReceipt')}
            </Button>
          </Box>
        ))}
      </Box>
    );
  } else if (data) {
    content = (
      <TableContainer>
        <Table aria-label={t('nav.payments')}>
          <TableHead>
            <TableRow>
              <TableCell scope="col">{t('payments.columns.date')}</TableCell>
              <TableCell scope="col">{t('payments.columns.customer')}</TableCell>
              <TableCell scope="col">{t('payments.columns.method')}</TableCell>
              <TableCell scope="col" align="right">
                {t('payments.columns.amount')}
              </TableCell>
              <TableCell scope="col" align="center">
                {t('customers.columns.status')}
              </TableCell>
              <TableCell scope="col" align="right">
                {t('payments.columns.receipt')}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.items.map((payment) => (
              <TableRow key={payment.id} hover>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {formatDate(payment.effective_on, language)}
                </TableCell>
                <TableCell>
                  <Link
                    component={RouterLink}
                    to={`/customers/${payment.customer_id}`}
                    sx={{ fontWeight: 600 }}
                  >
                    {payment.customer_name}
                  </Link>
                </TableCell>
                <TableCell>{t(`payments.methods.${payment.method}`)}</TableCell>
                <TableCell align="right">
                  <Money cents={payment.amount.amount} />
                </TableCell>
                <TableCell align="center">
                  <Status payment={payment} />
                </TableCell>
                <TableCell align="right">
                  <Button
                    onClick={() => setReceipt(payment.id)}
                    aria-label={t('payments.viewReceiptFor', { name: payment.customer_name })}
                  >
                    {t('payments.viewReceipt')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  }

  return (
    <>
      <PageHeader
        title={t('nav.payments')}
        subtitle={t('payments.subtitle')}
        primaryAction={{
          label: t('payments.record'),
          icon: <AddIcon />,
          onClick: () => search.setFlag('record', true),
        }}
      />
      <FilterBar>
        <SearchField
          label={t('payments.searchLabel')}
          value={search.text}
          onChange={search.setText}
          onClear={search.clear}
        />
        <TextField
          select
          label={t('payments.fields.method')}
          value={method}
          onChange={(event) => search.setValues({ method: event.target.value || null })}
          sx={{ flex: '1 1 180px', maxWidth: 240 }}
        >
          <MenuItem value="">{t('payments.anyMethod')}</MenuItem>
          {PAYMENT_METHODS.map((value) => (
            <MenuItem key={value} value={value}>
              {t(`payments.methods.${value}`)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label={t('customers.columns.status')}
          value={status}
          onChange={(event) => search.setValues({ status: event.target.value || null })}
          sx={{ flex: '1 1 160px', maxWidth: 200 }}
        >
          <MenuItem value="">{t('payments.anyStatus')}</MenuItem>
          <MenuItem value="received">{t('status.received')}</MenuItem>
          <MenuItem value="reversed">{t('status.reversed')}</MenuItem>
        </TextField>
        <TextField
          type="date"
          label={t('payments.from')}
          value={from}
          onChange={(event) => search.setValues({ from: event.target.value || null })}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ flex: '1 1 160px', maxWidth: 200 }}
        />
        <TextField
          type="date"
          label={t('payments.to')}
          value={to}
          onChange={(event) => search.setValues({ to: event.target.value || null })}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ flex: '1 1 160px', maxWidth: 200 }}
        />
      </FilterBar>
      <ListCard
        title={t('payments.listTitle')}
        countLabel={data ? t('payments.count', { count: data.total }) : undefined}
        refreshing={list.isFetching && !list.isPending}
        pager={
          data
            ? {
                page: search.page,
                pages: pageCount(data.total, data.page_size),
                onPage: search.setPage,
              }
            : undefined
        }
      >
        {content}
      </ListCard>
      {recordOpen && (
        <RecordPaymentDialog
          onClose={() => search.setFlag('record', false)}
          onRecorded={() => {
            search.setFlag('record', false);
            toast.success(t('payments.recorded'));
          }}
        />
      )}
      {receipt && <ReceiptDialog paymentId={receipt} onClose={() => setReceipt(null)} />}
    </>
  );
}
