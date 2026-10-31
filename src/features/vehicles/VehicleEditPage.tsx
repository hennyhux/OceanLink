import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router';

import { ActiveStatusChip } from '@/components/ActiveStatusChip';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ErrorState } from '@/components/ErrorState';
import type { FlashState } from '@/components/FlashMessage';
import { LoadingState } from '@/components/LoadingState';
import { useCustomer } from '@/features/customers/queries';
import { isApiError, isNetworkError, isNotFound, isStaleVersion } from '@/lib/api/errors';
import { safeReturnTo } from '@/lib/navigation';

import { vehicleTitle } from './display';
import { diffWrite, formToWrite, vehicleToForm } from './formModel';
import { useSetVehicleActive, useUpdateVehicle, useVehicle } from './queries';
import { VehicleForm } from './VehicleForm';
import { VehicleParkingSection } from './VehicleParkingSection';

export function VehicleEditPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get('returnTo'), '/vehicles');

  const vehicleQuery = useVehicle(id);
  const customerQuery = useCustomer(vehicleQuery.data?.customer_id);
  const update = useUpdateVehicle(id);
  const setActive = useSetVehicleActive(id);

  // Only an explicit reload resets the form, so a background refetch never wipes typed edits.
  const [reloadCount, setReloadCount] = useState(0);

  // Fetch the latest record and restart the form from it. If the fetch fails the form is kept,
  // so typed edits are not lost for nothing.
  const reloadVehicle = async () => {
    const result = await vehicleQuery.refetch();
    if (!result.isError) setReloadCount((n) => n + 1);
  };
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionDone, setActionDone] = useState<string | null>(null);
  const [parkingDirty, setParkingDirty] = useState(false);

  // The owner's USDOT number is used for a gentle "this is different" hint, so wait for it,
  // but do not block editing if that lookup fails.
  if (vehicleQuery.isPending || (vehicleQuery.data && customerQuery.isPending)) {
    return <LoadingState label={t('app.loading')} />;
  }

  const vehicle = vehicleQuery.data;

  // A failed reload keeps the form; only a first load can end in this screen.
  if (!vehicle) {
    const notFound = isNotFound(vehicleQuery.error);
    return (
      <ErrorState
        title={notFound ? t('vehicles.notFoundTitle') : t('common.loadFailedTitle')}
        body={notFound ? t('vehicles.notFoundBody') : t('common.loadFailedBody')}
        actionLabel={notFound ? t('vehicles.backToList') : t('app.retry')}
        onAction={() =>
          notFound ? void navigate('/vehicles', { replace: true }) : void vehicleQuery.refetch()
        }
      />
    );
  }
  const unitLabel = (unit: string) => t('vehicles.unitLabel', { unit });

  const changeActive = async (isActive: boolean) => {
    setActionError(null);
    setActionDone(null);
    try {
      await setActive.mutateAsync({ version: vehicle.version, isActive });
      setConfirmOpen(false);
      setActionDone(isActive ? t('vehicles.reactivated') : t('vehicles.deactivated'));
    } catch (error) {
      setConfirmOpen(false);
      if (isStaleVersion(error)) {
        setActionError(t('common.staleRefreshed'));
        // The form must restart from the new version too, or a later save would send old values.
        void reloadVehicle();
      } else if (isNetworkError(error)) {
        setActionError(t('common.saveFailed'));
      } else if (isApiError(error) && error.code === 'PARKING_STILL_ACTIVE') {
        setActionError(t('parking.endBeforeArchive'));
      } else if (
        isApiError(error) &&
        (error.code === 'PLATE_ALREADY_IN_USE' || error.code === 'UNIT_NUMBER_ALREADY_IN_USE')
      ) {
        setActionError(t('vehicles.errors.duplicateReactivate'));
      } else {
        const requestId = isApiError(error) ? error.requestId : undefined;
        setActionError(
          requestId
            ? `${t('common.saveFailedUnexpected')} ${t('common.problemNumber', { id: requestId })}`
            : t('common.saveFailedUnexpected'),
        );
      }
    }
  };

  return (
    <>
      <Link
        component={RouterLink}
        to={returnTo}
        underline="hover"
        sx={{ display: 'inline-flex', alignItems: 'center', minHeight: 48, mb: 1, fontSize: 16 }}
      >
        ← {t('common.back')}
      </Link>
      <Box
        component="header"
        sx={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          columnGap: { xs: 1, sm: 2 },
          rowGap: 0.5,
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Typography
          component="h1"
          variant="h4"
          fontWeight={600}
          sx={{
            gridColumn: 1,
            minWidth: 0,
            maxWidth: '100%',
            fontSize: { xs: '1.5rem', sm: '2rem' },
            lineHeight: 1.2,
            overflowWrap: 'anywhere',
          }}
        >
          {vehicleTitle(vehicle, unitLabel)}
        </Typography>
        <Typography
          color="text.secondary"
          sx={{ gridColumn: '1 / -1', fontSize: 16, overflowWrap: 'anywhere' }}
        >
          {t(`vehicles.type.${vehicle.vehicle_type}`)}
          {vehicle.usdot_number ? ` · USDOT ${vehicle.usdot_number}` : ''}
        </Typography>
        <Box sx={{ gridColumn: 2, gridRow: 1 }}>
          <ActiveStatusChip isActive={vehicle.is_active} />
        </Box>
      </Box>

      {!vehicle.is_active && (
        <Alert severity="warning" role="status" sx={{ mb: 2 }}>
          {t('vehicles.inactiveBanner')}
        </Alert>
      )}
      {vehicleQuery.isRefetchError && (
        <Alert severity="warning" role="status" sx={{ mb: 2 }}>
          {t('common.reloadFailed')}
        </Alert>
      )}
      {actionDone && (
        <Alert severity="success" role="status" sx={{ mb: 2 }} onClose={() => setActionDone(null)}>
          {actionDone}
        </Alert>
      )}
      {actionError && (
        <Alert severity="error" role="alert" sx={{ mb: 2 }} onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      <Stack spacing={2}>
        <VehicleParkingSection vehicle={vehicle} onDirtyChange={setParkingDirty} />
        <VehicleForm
          additionalDirty={parkingDirty}
          key={reloadCount}
          defaultValues={vehicleToForm(vehicle)}
          initialCustomer={customerQuery.data ?? null}
          lockedOwner={{ id: vehicle.customer_id, name: vehicle.customer_name }}
          submitLabel={t('common.save')}
          onCancel={() => void navigate(returnTo)}
          onReload={() => void reloadVehicle()}
          onSubmit={async (values) => {
            const changes = diffWrite(formToWrite(vehicleToForm(vehicle)), formToWrite(values));
            const changed = Object.keys(changes).length > 0;
            if (changed) {
              await update.mutateAsync({ version: vehicle.version, body: changes });
            }
            const state: FlashState = {
              flash: {
                messageKey: changed ? 'vehicles.saved' : 'vehicles.noChanges',
                severity: changed ? 'success' : 'info',
              },
            };
            void navigate(returnTo, { replace: true, state });
          }}
        />

        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
          {vehicle.is_active ? (
            <Button
              color="error"
              variant="outlined"
              onClick={() => setConfirmOpen(true)}
              disabled={setActive.isPending}
            >
              {t('vehicles.deactivate.action')}
            </Button>
          ) : (
            <Button
              variant="outlined"
              onClick={() => void changeActive(true)}
              disabled={setActive.isPending}
            >
              {t('vehicles.reactivate.action')}
            </Button>
          )}
        </Paper>
      </Stack>

      <ConfirmDialog
        open={confirmOpen}
        title={t('vehicles.deactivate.title', { name: vehicleTitle(vehicle, unitLabel) })}
        body={t('vehicles.deactivate.body')}
        confirmLabel={t('vehicles.deactivate.confirm')}
        busy={setActive.isPending}
        onConfirm={() => void changeActive(false)}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  );
}
