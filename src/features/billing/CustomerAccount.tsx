import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Collapse from '@mui/material/Collapse';
import Stack from '@mui/material/Stack';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '@/lib/money';
import { useCustomerLedger } from './api';
import { BillingReviewDialog } from './BillingReviewDialog';
import { ManualDebitDialog } from './ManualDebitDialog';
import type { ManualDebitInvoice } from './manualDebitModel';

export function CustomerAccount({
  customerId,
  customerName,
  onRecordPayment,
}: {
  customerId: string;
  customerName: string;
  onRecordPayment: () => void;
}) {
  const { t, i18n } = useTranslation();
  const query = useCustomerLedger(customerId);
  const data = query.data;
  const [details, setDetails] = useState(false);
  const [review, setReview] = useState(false);
  const [billed, setBilled] = useState(false);
  const [manualDebitOpen, setManualDebitOpen] = useState(false);
  const [manualDebitIssued, setManualDebitIssued] = useState<ManualDebitInvoice | null>(null);
  const money = (amount: number) => formatMoney(amount, i18n.resolvedLanguage ?? 'zh-CN');
  return (
    <Box component="section">
      <Typography component="h2" variant="h6" fontWeight={600} mb={2}>
        {t('account.title')}
      </Typography>
      {query.isPending && <Typography role="status">{t('app.loading')}</Typography>}
      {query.isError && (
        <Alert
          severity="error"
          action={<Button onClick={() => void query.refetch()}>{t('app.retry')}</Button>}
        >
          {t('account.unavailable')}
        </Alert>
      )}
      {data && (
        <>
          <Box component="dl" sx={{ m: 0 }}>
            <Typography component="dt" color="text.secondary" sx={{ fontSize: 16 }}>
              {t(data.net_balance.amount < 0 ? 'account.creditBalance' : 'account.owes')}
            </Typography>
            <Typography
              component="dd"
              sx={{
                m: 0,
                fontSize: { xs: '2rem', sm: '2.25rem' },
                lineHeight: 1.2,
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                color: data.net_balance.amount > 0 ? 'error.main' : 'text.primary',
              }}
            >
              {money(Math.abs(data.net_balance.amount))}
            </Typography>
            {data.overdue.amount > 0 && (
              <Typography color="error.main" sx={{ fontSize: 16, mt: 0.25 }}>
                {t('account.overdueShort')}: {money(data.overdue.amount)}
              </Typography>
            )}
            <Button
              fullWidth
              variant="contained"
              startIcon={<AddIcon />}
              onClick={onRecordPayment}
              sx={{ mt: 1.5, minHeight: 48 }}
            >
              {t('payments.record')}
            </Button>
          </Box>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setManualDebitOpen(true)}
            sx={{ mt: 1, minHeight: 48 }}
          >
            {t('billing.manualAction')}
          </Button>
          <Box
            component="dl"
            sx={{
              display: 'grid',
              gap: { xs: 1.5, sm: 2 },
              m: 0,
              mt: 2,
              pt: 2,
              borderTop: 1,
              borderColor: 'divider',
            }}
          >
            <Box>
              <Typography component="dt" color="text.secondary" sx={{ fontSize: 16 }}>
                {t('account.lastPayment')}
              </Typography>
              <Box component="dd" sx={{ m: 0 }}>
                {data.last_payment ? (
                  <Stack direction="row" flexWrap="wrap" alignItems="baseline" gap={1}>
                    <Typography
                      sx={{ fontSize: 16, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
                    >
                      {money(data.last_payment.amount.amount)}
                    </Typography>
                    <Typography color="text.secondary" sx={{ fontSize: 16 }}>
                      {new Intl.DateTimeFormat(i18n.resolvedLanguage, {
                        dateStyle: 'medium',
                        timeZone: 'UTC',
                      }).format(new Date(`${data.last_payment.effective_on}T12:00:00Z`))}{' '}
                      ·{' '}
                      {t(`account.methods.${data.last_payment.method}`, {
                        defaultValue: t('account.methods.other'),
                      })}
                    </Typography>
                  </Stack>
                ) : (
                  <Typography sx={{ fontSize: 16 }}>{t('account.noPayment')}</Typography>
                )}
              </Box>
            </Box>
          </Box>
          {billed && (
            <Alert severity="success" role="status" onClose={() => setBilled(false)}>
              {t('billing.issued')}
            </Alert>
          )}
          {manualDebitIssued && (
            <Alert severity="success" role="status" onClose={() => setManualDebitIssued(null)}>
              {t('billing.manualIssued', {
                number: manualDebitIssued.invoice_number,
                amount: money(manualDebitIssued.total.amount),
              })}
            </Alert>
          )}
          {data.monthly_parking && (
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              justifyContent="space-between"
              alignItems={{ sm: 'center' }}
              gap={2}
              sx={{ borderTop: 1, borderBottom: 1, borderColor: 'divider', py: 1.5 }}
            >
              <Box>
                <Typography>
                  {t('billing.monthly')}: <strong>{money(data.monthly_parking.amount)}</strong>
                </Typography>
                {Boolean(data.unbilled_parking?.amount) && (
                  <Typography color="warning.main">
                    {t('billing.unbilled')}: {money(data.unbilled_parking!.amount)}
                  </Typography>
                )}
              </Box>
              <Button
                variant={data.unbilled_parking?.amount ? 'contained' : 'outlined'}
                startIcon={<ReceiptLongOutlinedIcon />}
                onClick={() => setReview(true)}
                sx={{ minHeight: 48 }}
              >
                {t('billing.review')}
              </Button>
            </Stack>
          )}
          <Button
            startIcon={
              <ExpandMoreIcon sx={{ transform: details ? 'rotate(180deg)' : undefined }} />
            }
            onClick={() => setDetails(!details)}
            aria-expanded={details}
            aria-controls={`account-breakdown-${customerId}`}
            sx={{ mt: 1, minHeight: 48 }}
          >
            {t('account.breakdown')}
          </Button>
          <Collapse in={details}>
            <Box id={`account-breakdown-${customerId}`} sx={{ pt: 1 }}>
              {(
                [
                  ['account.outstanding', data.outstanding.amount],
                  ['account.credit', data.unapplied_credit.amount],
                  ['account.overdue', data.overdue.amount],
                ] as const
              ).map(([key, amount]) => (
                <Stack key={key} direction="row" justifyContent="space-between" gap={2}>
                  <Typography>{t(key)}</Typography>
                  <Typography
                    sx={{
                      fontVariantNumeric: 'tabular-nums',
                      color:
                        key === 'account.overdue' && amount > 0 ? 'error.main' : 'text.primary',
                    }}
                  >
                    {money(amount)}
                  </Typography>
                </Stack>
              ))}
              <Typography variant="body2" color="text.secondary" mt={1}>
                {t('account.asOf')}:{' '}
                {new Intl.DateTimeFormat(i18n.resolvedLanguage, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(data.as_of))}
              </Typography>
            </Box>
          </Collapse>
        </>
      )}
      {review && (
        <BillingReviewDialog
          customerId={customerId}
          onClose={() => setReview(false)}
          onIssued={() => setBilled(true)}
        />
      )}
      {manualDebitOpen && (
        <ManualDebitDialog
          customer={{ id: customerId, display_name: customerName }}
          onClose={() => setManualDebitOpen(false)}
          onIssued={(invoice) => {
            setManualDebitOpen(false);
            setManualDebitIssued(invoice);
          }}
        />
      )}
    </Box>
  );
}
