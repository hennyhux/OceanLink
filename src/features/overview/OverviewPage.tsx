import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';

import { PageHeader } from '@/components/PageHeader';
import { useAuth } from '@/features/auth/useAuth';

export function OverviewPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <>
      <PageHeader
        title={t('overview.title')}
        description={user ? t('overview.welcome', { name: user.name }) : undefined}
      />
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 5 }, textAlign: 'center' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <InboxOutlinedIcon color="action" sx={{ fontSize: 48 }} aria-hidden />
          <Typography component="h2" variant="h6" fontWeight={600}>
            {t('overview.emptyTitle')}
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 520 }}>
            {t('overview.emptyBody')}
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 520 }}>
            {t('overview.nextStep')}
          </Typography>
          <Button component={RouterLink} to="/customers" variant="contained" size="large">
            {t('overview.goToCustomers')}
          </Button>
        </Box>
      </Paper>
    </>
  );
}
