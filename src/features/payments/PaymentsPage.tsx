import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import CloseIcon from '@mui/icons-material/Close';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useSearchParams } from 'react-router';
import type { Customer } from '@/features/customers/types';
import { billingApi } from '@/features/billing/api';
import { formatMoney } from '@/lib/money';
import { MobilePrimaryAction } from '@/components/MobilePrimaryAction';
import { usePayments } from './api';
import { PAYMENT_METHODS, type Payment, type PaymentMethod, type PaymentStatus } from './model';
import { PaymentDetailsDialog } from './PaymentDetailsDialog';
import { RecordPaymentDialog } from './RecordPaymentDialog';

export function PaymentsPage({
  customer,
  showRecordAction = true,
}: {
  customer?: Customer;
  showRecordAction?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [from, setFrom] = useState(params.get('from') ?? '');
  const [to, setTo] = useState(params.get('to') ?? '');
  const [method, setMethod] = useState(params.get('method') ?? '');
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [recordOpen, setRecordOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saved, setSaved] = useState<Payment | null>(null);
  const [filterError, setFilterError] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(() =>
    ['q', 'from', 'to', 'method', 'status'].some((key) => Boolean(params.get(key))),
  );
  useEffect(() => {
    if (params.get('record') !== '1') return;
    setRecordOpen(true);
    const next = new URLSearchParams(params);
    next.delete('record');
    setParams(next, { replace: true });
  }, [params, setParams]);
  const desktop = useMediaQuery(useTheme().breakpoints.up('lg'));
  const filterCount = ['from', 'to', 'method', 'status'].filter((key) =>
    Boolean(params.get(key)),
  ).length;
  const hasFilters = Boolean(params.get('q')) || filterCount > 0;
  const activeFilterLabels = [
    params.get('q')
      ? `${t(customer ? 'payments.referenceSearch' : 'payments.searchShort')}: ${params.get('q')}`
      : null,
    params.get('from') ? `${t('payments.from')}: ${params.get('from')}` : null,
    params.get('to') ? `${t('payments.to')}: ${params.get('to')}` : null,
    params.get('method') ? t(`account.methods.${params.get('method')}`) : null,
    params.get('status')
      ? params.get('status') === 'issued'
        ? t('billing.manualStatusIssued')
        : t(`payments.status.${params.get('status')}`)
      : null,
  ].filter((label): label is string => Boolean(label));
  const clearFilters = () => {
    setSearch('');
    setFrom('');
    setTo('');
    setMethod('');
    setStatus('');
    setFilterError(false);
    setParams(new URLSearchParams(), { replace: true });
  };
  const dateLabel = (value: string) =>
    new Intl.DateTimeFormat(i18n.resolvedLanguage, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${value}T12:00:00Z`));
  const amountLabel = (payment: Payment) =>
    formatMoney(payment.amount.amount, i18n.resolvedLanguage ?? 'zh-CN');
  const receiptButton = (payment: Payment) => (
    <Button
      startIcon={<ReceiptLongOutlinedIcon />}
      onClick={() => setSelectedId(payment.id)}
      sx={{ whiteSpace: 'nowrap', minHeight: customer ? 48 : undefined }}
    >
      {t('payments.viewReceipt')}
    </Button>
  );
  const statusChip = (payment: Payment) => (
    <Chip
      size="small"
      label={t(`payments.status.${payment.status}`)}
      color={payment.status === 'received' ? 'success' : 'default'}
      variant="outlined"
    />
  );
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);
  const manualPage = Math.max(1, Number.parseInt(params.get('manual_page') ?? '1', 10) || 1);
  const query = usePayments({
    customer_id: customer?.id,
    q: params.get('q') || undefined,
    from: params.get('from') || undefined,
    to: params.get('to') || undefined,
    method: (params.get('method') || undefined) as PaymentMethod | undefined,
    status: (params.get('status') === 'issued' ? undefined : params.get('status') || undefined) as
      PaymentStatus | undefined,
    page,
    page_size: 20,
  });
  const customerId = customer?.id;
  const manualDebitQuery = useQuery({
    queryKey: [
      'manual-invoices',
      customerId,
      params.get('q'),
      params.get('from'),
      params.get('to'),
      manualPage,
    ],
    queryFn: ({ signal }) => {
      if (!customerId) throw new Error('Customer is required to load manual invoices.');
      return billingApi.manualDebits(
        customerId,
        {
          q: params.get('q') || undefined,
          from: params.get('from') || undefined,
          to: params.get('to') || undefined,
          page: manualPage,
          page_size: 20,
        },
        signal,
      );
    },
    enabled:
      Boolean(customerId) &&
      !params.get('method') &&
      (!params.get('status') || params.get('status') === 'issued'),
  });
  const showPayments = !customer || params.get('status') !== 'issued';
  const showManualDebits = Boolean(
    customer &&
    !params.get('method') &&
    (!params.get('status') || params.get('status') === 'issued'),
  );
  const paymentItems = showPayments ? (query.data?.items ?? []) : [];
  const manualDebitItems = showManualDebits ? (manualDebitQuery.data?.items ?? []) : [];
  const totalResults =
    (showPayments ? (query.data?.total ?? 0) : 0) +
    (showManualDebits ? (manualDebitQuery.data?.total ?? 0) : 0);
  const historyPending = query.isPending || (showManualDebits && manualDebitQuery.isPending);
  const paginate = (next: number, key = 'page') => {
    const values = new URLSearchParams(params);
    values.set(key, String(next));
    setParams(values);
  };
  return (
    <Box
      component="section"
      sx={{ py: customer ? 0 : 2, pb: !customer && !desktop ? 10 : undefined }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        flexWrap="wrap"
        gap={1}
        mb={2}
      >
        <Typography
          component={customer ? 'h2' : 'h1'}
          variant={customer ? 'h6' : 'h5'}
          fontWeight={customer ? 600 : undefined}
          sx={{ minWidth: 0 }}
        >
          {t(customer ? 'payments.customerHistory' : 'payments.title')}
        </Typography>
        {showRecordAction && (
          <Button
            variant={customer ? 'outlined' : 'contained'}
            size={customer ? 'small' : 'medium'}
            startIcon={<AddIcon />}
            aria-label={customer ? t('payments.record') : undefined}
            sx={{
              flexShrink: 0,
              whiteSpace: 'nowrap',
              minHeight: 48,
              display: customer || desktop ? 'inline-flex' : 'none',
            }}
            onClick={() => {
              setRecordOpen(true);
              setSaved(null);
            }}
          >
            {t(customer ? 'payments.recordShort' : 'payments.record')}
          </Button>
        )}
      </Stack>
      {saved && (
        <Alert
          severity="success"
          role="status"
          sx={{ mb: 2 }}
          onClose={() => setSaved(null)}
          closeText={t('payments.close')}
          action={
            <Button color="inherit" onClick={() => setSelectedId(saved.id)}>
              {t('payments.viewReceipt')}
            </Button>
          }
        >
          {t('payments.savedShort')}
        </Alert>
      )}
      {customer && (
        <Button
          type="button"
          variant="outlined"
          startIcon={<FilterListIcon />}
          aria-expanded={filtersOpen}
          aria-controls="customer-payment-search-controls"
          onClick={() => setFiltersOpen((open) => !open)}
          sx={{ mb: activeFilterLabels.length ? 1 : 2, minHeight: 48 }}
        >
          {t('payments.searchAndFilters')}
          {activeFilterLabels.length ? ` (${activeFilterLabels.length})` : ''}
        </Button>
      )}
      <Collapse in={!customer || filtersOpen} unmountOnExit={Boolean(customer)}>
        <Box
          id={customer ? 'customer-payment-search-controls' : undefined}
          component="form"
          onSubmit={(event) => {
            event.preventDefault();
            if (from && to && from > to) {
              setFilterError(true);
              return;
            }
            setFilterError(false);
            const next = new URLSearchParams();
            for (const [key, value] of Object.entries({
              q: search.trim(),
              from,
              to,
              method,
              status,
            }))
              if (value) next.set(key, value);
            setParams(next, { replace: true });
            if (customer) setFiltersOpen(false);
          }}
          sx={{ mb: 2 }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0, 1fr) auto', sm: 'minmax(0, 1fr) auto auto' },
              gap: 1.5,
              alignItems: 'start',
            }}
          >
            <TextField
              label={t(customer ? 'payments.referenceSearch' : 'payments.searchShort')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              sx={{ minWidth: 0, gridColumn: { xs: '1 / -1', sm: 'auto' } }}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <Button
              type="submit"
              variant="outlined"
              startIcon={<SearchIcon />}
              sx={{ minHeight: customer ? 48 : { xs: 44, sm: 56 } }}
            >
              {t('common.search')}
            </Button>
            {!customer && (
              <Button
                type="button"
                startIcon={<FilterListIcon />}
                aria-expanded={filtersOpen}
                aria-controls="payment-filters"
                onClick={() => setFiltersOpen(!filtersOpen)}
                sx={{ minHeight: { xs: 44, sm: 56 } }}
              >
                {t('payments.filters')}
                {filterCount > 0 ? ` (${filterCount})` : ''}
              </Button>
            )}
          </Box>
          <Collapse in={filtersOpen}>
            <Box
              id="payment-filters"
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, minmax(0, 1fr))',
                  lg: 'repeat(4, minmax(0, 1fr))',
                },
                gap: 2,
                pt: 2,
              }}
            >
              <TextField
                label={t('payments.from')}
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label={t('payments.to')}
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                select
                label={t('payments.method')}
                value={method}
                onChange={(event) => setMethod(event.target.value)}
                fullWidth
                slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}
              >
                <MenuItem value="">{t('payments.allMethods')}</MenuItem>
                {PAYMENT_METHODS.map((item) => (
                  <MenuItem key={item} value={item}>
                    {t(`account.methods.${item}`)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={t('payments.statusLabel')}
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                fullWidth
                slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}
              >
                <MenuItem value="">{t('payments.allStatuses')}</MenuItem>
                <MenuItem value="received">{t('payments.status.received')}</MenuItem>
                <MenuItem value="reversed">{t('payments.status.reversed')}</MenuItem>
                {customer && <MenuItem value="issued">{t('billing.manualStatusIssued')}</MenuItem>}
              </TextField>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 1 }}>
              <Button
                type="submit"
                variant="contained"
                startIcon={<FilterListIcon />}
                sx={{ minHeight: customer ? 48 : undefined }}
              >
                {t('payments.applyFilters')}
              </Button>
            </Box>
          </Collapse>
          {hasFilters && !customer && (
            <Button type="button" startIcon={<CloseIcon />} onClick={clearFilters} sx={{ mt: 1 }}>
              {t('payments.clearFilters')}
            </Button>
          )}
          {filterError && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {t('payments.invalidRange')}
            </Alert>
          )}
        </Box>
      </Collapse>
      {customer && activeFilterLabels.length > 0 && (
        <Stack
          direction="row"
          flexWrap="wrap"
          alignItems="center"
          gap={1}
          sx={{ mb: 2 }}
          role="group"
          aria-label={t('payments.activeFilters')}
        >
          {activeFilterLabels.map((label) => (
            <Chip
              key={label}
              size="small"
              label={label}
              sx={{
                maxWidth: '100%',
                height: 'auto',
                '& .MuiChip-label': { whiteSpace: 'normal', overflowWrap: 'anywhere' },
              }}
            />
          ))}
          <Button type="button" onClick={clearFilters} sx={{ minHeight: 48 }}>
            {t('payments.clearFilters')}
          </Button>
        </Stack>
      )}
      {historyPending && <Typography role="status">{t('app.loading')}</Typography>}
      {query.isError && (
        <Alert
          severity="error"
          action={<Button onClick={() => void query.refetch()}>{t('app.retry')}</Button>}
        >
          {t('common.loadFailedBody')}
        </Alert>
      )}
      {showManualDebits && manualDebitQuery.isError && (
        <Alert
          severity="error"
          action={<Button onClick={() => void manualDebitQuery.refetch()}>{t('app.retry')}</Button>}
        >
          {t('common.loadFailedBody')}
        </Alert>
      )}
      {query.data && (!showManualDebits || manualDebitQuery.isSuccess) && totalResults === 0 && (
        <Typography>{t(customer ? 'payments.noTransactions' : 'payments.empty')}</Typography>
      )}
      {query.data && (
        <>
          <Typography role="status" color="text.secondary" sx={{ mb: 1, fontSize: '0.9375rem' }}>
            {t('common.resultsCount', { count: totalResults })}
          </Typography>
          {showPayments && paymentItems.length > 0 && desktop ? (
            <TableContainer sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
              <Table aria-label={t(customer ? 'payments.customerHistory' : 'payments.title')}>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('payments.dateColumn')}</TableCell>
                    {!customer && <TableCell>{t('vehicles.fields.customer')}</TableCell>}
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {t('payments.amountColumn')}
                    </TableCell>
                    <TableCell>{t('payments.method')}</TableCell>
                    <TableCell>{t('payments.statusLabel')}</TableCell>
                    <TableCell align="right">{t('payments.receiptColumn')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paymentItems.map((payment) => (
                    <TableRow key={payment.id} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {dateLabel(payment.effective_on)}
                      </TableCell>
                      {!customer && (
                        <TableCell sx={{ overflowWrap: 'anywhere' }}>
                          <Link
                            component={RouterLink}
                            to={`/customers/${encodeURIComponent(payment.customer_id)}`}
                            underline="hover"
                            fontWeight={600}
                          >
                            {payment.customer_name}
                          </Link>
                        </TableCell>
                      )}
                      <TableCell
                        align="right"
                        sx={{
                          fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {amountLabel(payment)}
                      </TableCell>
                      <TableCell>{t(`account.methods.${payment.method}`)}</TableCell>
                      <TableCell>{statusChip(payment)}</TableCell>
                      <TableCell align="right">{receiptButton(payment)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : showPayments && paymentItems.length > 0 ? (
            <Box
              component="ul"
              sx={{ listStyle: 'none', p: 0, m: 0, borderTop: 1, borderColor: 'divider' }}
            >
              {paymentItems.map((payment) => (
                <Box
                  component="li"
                  key={payment.id}
                  sx={{ borderBottom: 1, borderColor: 'divider', py: 2, overflowWrap: 'anywhere' }}
                >
                  <Stack direction="row" flexWrap="wrap" justifyContent="space-between" gap={1}>
                    {!customer ? (
                      <Link
                        component={RouterLink}
                        to={`/customers/${encodeURIComponent(payment.customer_id)}`}
                        underline="hover"
                        fontWeight={600}
                        sx={{ flex: 1, minWidth: 0 }}
                      >
                        {payment.customer_name}
                      </Link>
                    ) : (
                      <Typography fontWeight={600}>{dateLabel(payment.effective_on)}</Typography>
                    )}
                    <Typography
                      sx={{
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {amountLabel(payment)}
                    </Typography>
                  </Stack>
                  <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                    {!customer ? `${dateLabel(payment.effective_on)} · ` : ''}
                    {t(`account.methods.${payment.method}`)}
                  </Typography>
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    mt={0.5}
                  >
                    {statusChip(payment)}
                    {receiptButton(payment)}
                  </Stack>
                </Box>
              ))}
            </Box>
          ) : null}
          {showManualDebits && manualDebitQuery.data && manualDebitQuery.data.total > 0 && (
            <Box component="section" aria-labelledby="manual-adjustments-title" sx={{ mt: 3 }}>
              <Typography
                id="manual-adjustments-title"
                component="h3"
                variant="subtitle1"
                fontWeight={700}
                sx={{ mb: 1 }}
              >
                {t('billing.manualHistoryTitle')}
              </Typography>
              <Box
                component="ul"
                sx={{ listStyle: 'none', p: 0, m: 0, borderTop: 1, borderColor: 'divider' }}
              >
                {manualDebitItems.map((invoice) => (
                  <Box
                    component="li"
                    key={invoice.id}
                    sx={{ py: 1.5, borderBottom: 1, borderColor: 'divider' }}
                  >
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="baseline"
                      gap={2}
                    >
                      <Typography fontWeight={600} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                        {invoice.description}
                      </Typography>
                      <Typography
                        sx={{
                          whiteSpace: 'nowrap',
                          fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {formatMoney(invoice.total.amount, i18n.resolvedLanguage ?? 'zh-CN')}
                      </Typography>
                    </Stack>
                    <Stack
                      direction="row"
                      flexWrap="wrap"
                      alignItems="center"
                      gap={1}
                      sx={{ mt: 0.5 }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        {invoice.invoice_number} · {dateLabel(invoice.issued_on ?? invoice.due_on)}{' '}
                        · {t('billing.manualDueDate')}: {dateLabel(invoice.due_on)}
                      </Typography>
                      <Chip
                        size="small"
                        label={t('billing.manualStatusIssued')}
                        color="info"
                        variant="outlined"
                      />
                    </Stack>
                  </Box>
                ))}
              </Box>
              {manualDebitQuery.data.total > manualDebitQuery.data.page_size && (
                <Stack direction="row" flexWrap="wrap" alignItems="center" gap={1} mt={2}>
                  <Button
                    disabled={manualPage === 1 || manualDebitQuery.isFetching}
                    onClick={() => paginate(manualPage - 1, 'manual_page')}
                    sx={{ minHeight: 48 }}
                  >
                    {t('common.previousPage')}
                  </Button>
                  <Typography>
                    {t('common.page', {
                      page: manualPage,
                      total: Math.ceil(
                        manualDebitQuery.data.total / manualDebitQuery.data.page_size,
                      ),
                    })}
                  </Typography>
                  <Button
                    disabled={
                      manualPage * manualDebitQuery.data.page_size >= manualDebitQuery.data.total ||
                      manualDebitQuery.isFetching
                    }
                    onClick={() => paginate(manualPage + 1, 'manual_page')}
                    sx={{ minHeight: 48 }}
                  >
                    {t('common.nextPage')}
                  </Button>
                </Stack>
              )}
            </Box>
          )}
          {showPayments && query.data.total > 20 && (
            <Stack direction="row" flexWrap="wrap" alignItems="center" gap={1} mt={2}>
              <Button disabled={page === 1 || query.isFetching} onClick={() => paginate(page - 1)}>
                {t('common.previousPage')}
              </Button>
              <Typography>
                {t('common.page', { page, total: Math.ceil(query.data.total / 20) })}
              </Typography>
              <Button
                disabled={page * 20 >= query.data.total || query.isFetching}
                onClick={() => paginate(page + 1)}
              >
                {t('common.nextPage')}
              </Button>
            </Stack>
          )}
        </>
      )}
      {recordOpen && (
        <RecordPaymentDialog
          customer={customer}
          onClose={() => setRecordOpen(false)}
          onSaved={(payment) => {
            setSaved(payment);
            setRecordOpen(false);
          }}
        />
      )}
      {selectedId && <PaymentDetailsDialog id={selectedId} onClose={() => setSelectedId(null)} />}
      {!customer && !desktop && (
        <MobilePrimaryAction
          label={t('payments.record')}
          onClick={() => {
            setRecordOpen(true);
            setSaved(null);
          }}
          hideAt="lg"
        />
      )}
    </Box>
  );
}
