import Box from '@mui/material/Box';
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
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ListCard } from '@/components/ListCard';
import { Money } from '@/components/Money';
import { SearchField } from '@/components/FilterBar';
import { StatusPill } from '@/components/StatusPill';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useInvoices } from '@/features/billing/api';
import { usePayments } from '@/features/payments/api';
import { ReceiptDialog } from '@/features/payments/ReceiptDialog';
import { requestIdOf } from '@/lib/api/errors';
import { formatDate } from '@/lib/dates';

type Kind = 'all' | 'payments' | 'charges';

interface Entry {
  id: string;
  date: string;
  kind: 'payment' | 'charge';
  title: string;
  detail: string;
  cents: number;
  reversed: boolean;
}

// Received and reversed payments plus issued charges, newest first. Drafts never show.
export function CustomerTransactionsTab({ customerId }: { customerId: string }) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? 'en';
  const payments = usePayments({ customer_id: customerId, page_size: 100 });
  const invoices = useInvoices({ customer_id: customerId, page_size: 100 });
  const [text, setText] = useState('');
  const [kind, setKind] = useState<Kind>('all');
  const [openPayment, setOpenPayment] = useState<string | null>(null);

  const loading = payments.isPending || invoices.isPending;
  const failed = (payments.isError && !payments.data) || (invoices.isError && !invoices.data);

  const entries: Entry[] = [
    ...(payments.data?.items ?? []).map((payment) => ({
      id: payment.id,
      date: payment.effective_on,
      kind: 'payment' as const,
      title: t('transactions.payment', { method: t(`payments.methods.${payment.method}`) }),
      detail: payment.reference ?? '',
      cents: payment.amount.amount,
      reversed: payment.status === 'reversed',
    })),
    ...(invoices.data?.items ?? []).map((invoice) => ({
      id: invoice.id,
      date: invoice.issued_on ?? invoice.due_on,
      kind: 'charge' as const,
      title: t(`transactions.source.${invoice.source_type}`),
      detail: [invoice.invoice_number, invoice.description].filter(Boolean).join(' · '),
      cents: invoice.total.amount,
      reversed: false,
    })),
  ]
    .filter((entry) => kind === 'all' || (kind === 'payments') === (entry.kind === 'payment'))
    .filter((entry) => {
      const needle = text.trim().toLowerCase();
      return !needle || `${entry.title} ${entry.detail}`.toLowerCase().includes(needle);
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));

  let content;
  if (loading)
    content = (
      <Box sx={{ px: 3, pb: 3 }}>
        <LoadingState rows={3} />
      </Box>
    );
  else if (failed) {
    content = (
      <ErrorState
        onRetry={() => {
          void payments.refetch();
          void invoices.refetch();
        }}
        requestId={requestIdOf(payments.error ?? invoices.error)}
      />
    );
  } else if (entries.length === 0) {
    content = <EmptyState message={t('transactions.empty')} />;
  } else {
    content = (
      <TableContainer>
        <Table aria-label={t('transactions.title')}>
          <TableHead>
            <TableRow>
              <TableCell scope="col">{t('transactions.date')}</TableCell>
              <TableCell scope="col">{t('transactions.what')}</TableCell>
              <TableCell scope="col" align="right">
                {t('transactions.amount')}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={`${entry.kind}-${entry.id}`}>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {formatDate(entry.date, language)}
                </TableCell>
                <TableCell>
                  {entry.kind === 'payment' ? (
                    <Link
                      component="button"
                      type="button"
                      onClick={() => setOpenPayment(entry.id)}
                      sx={{ fontWeight: 600, fontSize: '1rem', textAlign: 'left' }}
                    >
                      {entry.title}
                    </Link>
                  ) : (
                    <Typography sx={{ fontWeight: 600 }}>{entry.title}</Typography>
                  )}
                  {entry.detail && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ overflowWrap: 'anywhere' }}
                    >
                      {entry.detail}
                    </Typography>
                  )}
                  {entry.reversed && (
                    <Box sx={{ mt: 0.5 }}>
                      <StatusPill tone="neutral" label={t('status.reversed')} />
                    </Box>
                  )}
                </TableCell>
                <TableCell align="right">
                  {entry.kind === 'payment' ? (
                    <Box
                      component="span"
                      sx={{ textDecoration: entry.reversed ? 'line-through' : undefined }}
                    >
                      <Typography
                        component="span"
                        variant="body2"
                        color="text.secondary"
                        sx={{ mr: 0.75 }}
                      >
                        {t('transactions.received')}
                      </Typography>
                      <Money cents={entry.cents} tone={entry.reversed ? 'neutral' : 'credit'} />
                    </Box>
                  ) : (
                    <Box component="span">
                      <Typography
                        component="span"
                        variant="body2"
                        color="text.secondary"
                        sx={{ mr: 0.75 }}
                      >
                        {t('transactions.charged')}
                      </Typography>
                      <Money cents={entry.cents} />
                    </Box>
                  )}
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
      <ListCard title={t('transactions.title')}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, px: { xs: 2, sm: 3 }, pb: 2 }}>
          <SearchField
            label={t('transactions.search')}
            value={text}
            onChange={setText}
            onClear={() => setText('')}
          />
          <TextField
            select
            label={t('transactions.show')}
            value={kind}
            onChange={(event) => setKind(event.target.value as Kind)}
            sx={{ flex: '0 1 220px' }}
          >
            <MenuItem value="all">{t('transactions.all')}</MenuItem>
            <MenuItem value="payments">{t('transactions.paymentsOnly')}</MenuItem>
            <MenuItem value="charges">{t('transactions.chargesOnly')}</MenuItem>
          </TextField>
        </Box>
        {content}
      </ListCard>
      {openPayment && (
        <ReceiptDialog paymentId={openPayment} onClose={() => setOpenPayment(null)} />
      )}
    </>
  );
}
