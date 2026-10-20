import ConstructionOutlinedIcon from '@mui/icons-material/ConstructionOutlined';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/PageHeader';

interface NotImplementedPageProps {
  titleKey: string;
}

// Honest placeholder for routes that exist in navigation but are not built yet.
export function NotImplementedPage({ titleKey }: NotImplementedPageProps) {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t(titleKey)} />
      <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
          <ConstructionOutlinedIcon color="action" sx={{ fontSize: 40 }} aria-hidden />
          <Typography component="h2" variant="h6" fontWeight={600}>
            {t('app.notImplemented.title')}
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 480 }}>
            {t('app.notImplemented.body')}
          </Typography>
        </Box>
      </Paper>
    </>
  );
}
