import ConstructionOutlinedIcon from '@mui/icons-material/ConstructionOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import SearchOffOutlinedIcon from '@mui/icons-material/SearchOffOutlined';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';

import { useBreadcrumbs } from './breadcrumbs';
import { IconTile } from './IconTile';

function MessagePage({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  useBreadcrumbs([{ label: title }]);
  return (
    <Paper variant="outlined" sx={{ p: { xs: 3, sm: 5 }, maxWidth: 720 }}>
      <Stack spacing={2} alignItems="flex-start">
        <IconTile size={56}>{icon}</IconTile>
        <Typography variant="h1">{title}</Typography>
        <Typography sx={{ maxWidth: '60ch' }}>{body}</Typography>
        {action}
      </Stack>
    </Paper>
  );
}

// Honest placeholder for screens whose backend endpoints do not exist yet.
export function PlaceholderPage({
  titleKey,
  purposeKey,
}: {
  titleKey: string;
  purposeKey: string;
}) {
  const { t } = useTranslation();
  return (
    <MessagePage
      icon={<ConstructionOutlinedIcon />}
      title={t(titleKey)}
      body={`${t(purposeKey)} ${t('placeholder.notYet')}`}
    />
  );
}

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <MessagePage
      icon={<SearchOffOutlinedIcon />}
      title={t('errors.notFoundTitle')}
      body={t('errors.notFoundBody')}
      action={
        <Button component={RouterLink} to="/" variant="contained">
          {t('errors.goOverview')}
        </Button>
      }
    />
  );
}

export function ForbiddenPage() {
  const { t } = useTranslation();
  return (
    <MessagePage
      icon={<LockOutlinedIcon />}
      title={t('errors.forbiddenTitle')}
      body={t('errors.forbiddenBody')}
    />
  );
}
