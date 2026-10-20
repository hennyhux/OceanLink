import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Collapse from '@mui/material/Collapse';
import Stack from '@mui/material/Stack';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '@/lib/money';
import { useVehicleList } from '@/features/vehicles/queries';
import { useCustomerLedger } from './api';
import { BillingReviewDialog } from './BillingReviewDialog';

export function CustomerAccount({ customerId }: { customerId: string }) {
  const { t, i18n } = useTranslation();
  const query = useCustomerLedger(customerId);
  const vehicles = useVehicleList({ customer_id: customerId, page_size: 100 });
  const data = query.data;
  const truckCount = vehicles.data?.items.filter(
    (vehicle) => vehicle.vehicle_type === 'truck' || vehicle.vehicle_type === 'combination',
  ).length;
  const [details, setDetails] = useState(false);
  const [review, setReview] = useState(false);
  const [billed, setBilled] = useState(false);
  const money = (amount: number) => formatMoney(amount, i18n.resolvedLanguage ?? 'zh-CN');
  return (
    <Box component="section" sx={{ py: 2 }}>
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
          <Box
            component="dl"
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr' },
              gap: 3,
              m: 0,
              pb: 2,
            }}
          >
            <Box>
              <Typography component="dt" color="text.secondary">
                {t(data.net_balance.amount < 0 ? 'account.creditBalance' : 'account.owes')}
              </Typography>
              <Typography
                component="dd"
                sx={{ m: 0, fontSize: '2rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
              >
                {money(Math.abs(data.net_balance.amount))}
              </Typography>
              {data.overdue.amount > 0 && (
                <Typography color="error.main">
                  {t('account.overdueShort')}: {money(data.overdue.amount)}
                </Typography>
              )}
            </Box>
            <Box>
              <Typography component="dt" color="text.secondary">
                {t('account.lastPayment')}
              </Typography>
              <Box component="dd" sx={{ m: 0 }}>
                {data.last_payment ? (
                  <>
                    <Typography
                      sx={{
                        fontSize: '1.5rem',
                        fontWeight: 600,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {money(data.last_payment.amount.amount)}
                    </Typography>
                    <Typography color="text.secondary">
                      {new Intl.DateTimeFormat(i18n.resolvedLanguage, {
                        dateStyle: 'medium',
                        timeZone: 'UTC',
                      }).format(new Date(`${data.last_payment.effective_on}T12:00:00Z`))}{' '}
                      ·{' '}
                      {t(`account.methods.${data.last_payment.method}`, {
                        defaultValue: t('account.methods.other'),
                      })}
                    </Typography>
                  </>
                ) : (
                  <Typography>{t('account.noPayment')}</Typography>
                )}
              </Box>
            </Box>
            {truckCount !== undefined && (
              <Box>
                <Typography component="dt" color="text.secondary">
                  {t('account.trucks')}
                </Typography>
                <Typography
                  component="dd"
                  sx={{ m: 0, fontSize: '1.5rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
                >
                  {truckCount}
                </Typography>
              </Box>
            )}
          </Box>
          {billed && (
            <Alert severity="success" role="status" onClose={() => setBilled(false)}>
              {t('billing.issued')}
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
            sx={{ mt: 1 }}
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
                  <Typography sx={{ fontVariantNumeric: 'tabular-nums' }}>
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
    </Box>
  );
}
