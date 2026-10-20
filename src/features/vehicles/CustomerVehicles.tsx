import AddIcon from '@mui/icons-material/Add';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';

import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';

import { vehicleTitle } from './display';
import { useVehicleList } from './queries';
import { formatMoney } from '@/lib/money';

// The "Vehicles" block on a customer's page: what they park here, and a way to add more.
export function CustomerVehicles({ customerId }: { customerId: string }) {
  const { t, i18n } = useTranslation();
  const list = useVehicleList({ customer_id: customerId, page_size: 100 });
  const unitLabel = (unit: string) => t('vehicles.unitLabel', { unit });

  // Coming back from the vehicle screens lands on this customer again.
  const returnTo = encodeURIComponent(`/customers/${customerId}`);
  const addLink = `/vehicles/new?customer_id=${encodeURIComponent(customerId)}&returnTo=${returnTo}`;

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          mb: 1,
        }}
      >
        <Typography component="h2" variant="h6" fontWeight={600}>
          {t('customers.sections.vehicles')}
        </Typography>
        <Button component={RouterLink} to={addLink} startIcon={<AddIcon />} variant="outlined">
          {t('vehicles.add')}
        </Button>
      </Box>

      {list.isPending && <LoadingState label={t('app.loading')} />}

      {list.isError && (
        <ErrorState
          title={t('common.loadFailedTitle')}
          body={t('common.loadFailedBody')}
          actionLabel={t('app.retry')}
          onAction={() => void list.refetch()}
        />
      )}

      {list.data && list.data.items.length === 0 && (
        <Typography color="text.secondary">{t('vehicles.onCustomer.empty')}</Typography>
      )}

      {list.data && list.data.items.length > 0 && (
        <Stack component="ul" spacing={1} sx={{ listStyle: 'none', p: 0, m: 0 }}>
          {list.data.items.map((vehicle) => (
            <Box
              component="li"
              key={vehicle.id}
              sx={{ borderTop: 1, borderColor: 'divider', pt: 1 }}
            >
              <Link
                component={RouterLink}
                to={`/vehicles/${vehicle.id}/edit?returnTo=${returnTo}`}
                fontWeight={600}
                underline="hover"
              >
                {vehicleTitle(vehicle, unitLabel)}
              </Link>
              <Typography variant="body2" color="text.secondary">
                {[
                  t(`vehicles.type.${vehicle.vehicle_type}`),
                  vehicle.usdot_number
                    ? t('vehicles.identifiers.usdot', { value: vehicle.usdot_number })
                    : null,
                  vehicle.plate_number
                    ? t('vehicles.identifiers.plate', {
                        plate: vehicle.plate_number,
                        state: vehicle.plate_jurisdiction ?? '',
                      })
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Typography>
              <Typography>
                {t('parking.rate')}:{' '}
                {vehicle.parking
                  ? formatMoney(
                      vehicle.parking.monthly_rate.amount,
                      i18n.resolvedLanguage ?? 'zh-CN',
                    )
                  : t('parking.notConfigured')}
              </Typography>
            </Box>
          ))}
        </Stack>
      )}
    </Paper>
  );
}
