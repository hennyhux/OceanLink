import AddIcon from '@mui/icons-material/Add';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Money } from '@/components/Money';
import { balanceLabelKey, balanceTone } from '@/lib/display';
import { SectionCard } from '@/components/SectionCard';
import { ErrorState, LoadingState } from '@/components/States';
import { useLedger } from '@/features/billing/api';
import { requestIdOf } from '@/lib/api/errors';
import { formatDate, formatDateTime } from '@/lib/dates';

interface Props {
  customerId: string;
  onRecordPayment: () => void;
  onAddCharge: () => void;
  onReviewCharges: () => void;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 2,
        flexWrap: 'wrap',
        py: 0.75,
      }}
    >
      <Typography component="dt" color="text.secondary">
        {label}
      </Typography>
      <Box component="dd" sx={{ m: 0, textAlign: 'right' }}>
        {children}
      </Box>
    </Box>
  );
}

export function CustomerAccountCard({
  customerId,
  onRecordPayment,
  onAddCharge,
  onReviewCharges,
}: Props) {
  const { t, i18n } = useTranslation();
  const ledger = useLedger(customerId);
  const [details, setDetails] = useState(false);
  const detailsId = useId();
  const language = i18n.resolvedLanguage ?? 'en';
  const data = ledger.data;

  return (
    <SectionCard title={t('account.title')} icon={<AccountBalanceWalletOutlinedIcon />}>
      {ledger.isPending && <LoadingState rows={3} />}
      {ledger.isError && !data && (
        <ErrorState
          title={t('account.unavailableTitle')}
          body={t('account.unavailableBody')}
          onRetry={() => void ledger.refetch()}
          requestId={requestIdOf(ledger.error)}
        />
      )}
      {data && (
        <>
          <Box component="dl" sx={{ m: 0 }}>
            <Typography component="dt" sx={{ fontWeight: 600, color: 'text.secondary' }}>
              {t(balanceLabelKey(data.net_balance.amount))}
            </Typography>
            <Money
              component="dd"
              cents={Math.abs(data.net_balance.amount)}
              tone={balanceTone(data.net_balance.amount)}
              size="hero"
            />
            {data.overdue.amount > 0 && (
              <Typography sx={{ color: 'error.main', fontWeight: 600, mt: 0.5 }}>
                {t('balance.overdue')}: <Money cents={data.overdue.amount} tone="owed" />
              </Typography>
            )}
          </Box>

          {/* Buttons sit side by side when there is room and stack instead of wrapping words. */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 2.5 }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<AddIcon />}
              onClick={onRecordPayment}
              sx={{ flex: '1 1 220px', whiteSpace: 'nowrap' }}
            >
              {t('payments.record')}
            </Button>
            <Button
              variant="outlined"
              size="large"
              startIcon={<AddIcon />}
              onClick={onAddCharge}
              sx={{ flex: '1 1 220px', whiteSpace: 'nowrap' }}
            >
              {t('charges.add')}
            </Button>
          </Box>

          <Divider sx={{ my: 2.5 }} />
          <Box component="dl" sx={{ m: 0 }}>
            <Row label={t('account.lastPayment')}>
              {data.last_payment ? (
                <>
                  <Money cents={data.last_payment.amount.amount} />
                  <Typography variant="body2" color="text.secondary">
                    {formatDate(data.last_payment.effective_on, language)} ·{' '}
                    {t(`payments.methods.${data.last_payment.method}`, {
                      defaultValue: t('payments.methods.other'),
                    })}
                  </Typography>
                </>
              ) : (
                <Typography>{t('account.noPayment')}</Typography>
              )}
            </Row>
            <Row label={t('account.monthlyParking')}>
              <Money cents={data.monthly_parking.amount} />{' '}
              <Typography component="span" variant="body2" color="text.secondary">
                {t('account.perMonth')}
              </Typography>
            </Row>
            <Row label={t('account.notBilled')}>
              <Money cents={data.unbilled_parking.amount} />
            </Row>
          </Box>
          {(data.unbilled_parking.amount > 0 || data.monthly_parking.amount > 0) && (
            <Box
              sx={{
                mt: 1.5,
                p: 2,
                borderRadius: 2,
                bgcolor: data.unbilled_parking.amount > 0 ? 'warning.light' : 'background.default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 1.5,
              }}
            >
              <Typography
                sx={{
                  color: data.unbilled_parking.amount > 0 ? 'warning.main' : 'text.secondary',
                  fontWeight: 600,
                }}
              >
                {data.unbilled_parking.amount > 0
                  ? t('account.chargesWaiting')
                  : t('account.nothingToBill')}
              </Typography>
              <Button
                variant={data.unbilled_parking.amount > 0 ? 'contained' : 'outlined'}
                startIcon={<ReceiptLongOutlinedIcon />}
                onClick={onReviewCharges}
              >
                {t('billing.review')}
              </Button>
            </Box>
          )}

          <Button
            onClick={() => setDetails((open) => !open)}
            aria-expanded={details}
            aria-controls={detailsId}
            startIcon={
              <ExpandMoreIcon sx={{ transform: details ? 'rotate(180deg)' : undefined }} />
            }
            sx={{ mt: 1.5 }}
          >
            {t('account.details')}
          </Button>
          <Collapse in={details}>
            <Box id={detailsId} component="dl" sx={{ m: 0, pt: 1 }}>
              <Row label={t('account.outstanding')}>
                <Money
                  cents={data.outstanding.amount}
                  tone={data.outstanding.amount > 0 ? 'owed' : 'neutral'}
                />
              </Row>
              <Row label={t('balance.overdue')}>
                <Money
                  cents={data.overdue.amount}
                  tone={data.overdue.amount > 0 ? 'owed' : 'neutral'}
                />
              </Row>
              <Row label={t('balance.credit')}>
                <Money
                  cents={data.unapplied_credit.amount}
                  tone={data.unapplied_credit.amount > 0 ? 'credit' : 'neutral'}
                />
              </Row>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {t('account.asOf', { time: formatDateTime(data.as_of, language) })}
              </Typography>
            </Box>
          </Collapse>
        </>
      )}
    </SectionCard>
  );
}
