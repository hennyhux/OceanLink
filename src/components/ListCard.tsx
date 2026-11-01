import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface PagerProps {
  page: number;
  pages: number;
  onPage: (page: number) => void;
}

export function Pager({ page, pages, onPage }: PagerProps) {
  const { t } = useTranslation();
  if (pages <= 1) return null;
  return (
    <Box
      component="nav"
      aria-label={t('list.pagination')}
      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
    >
      <IconButton
        aria-label={t('list.previousPage')}
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        <ChevronLeftIcon />
      </IconButton>
      <Typography sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {t('list.pageOf', { page, pages })}
      </Typography>
      <IconButton
        aria-label={t('list.nextPage')}
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
      >
        <ChevronRightIcon />
      </IconButton>
    </Box>
  );
}

interface ListCardProps {
  title: string;
  countLabel?: string;
  pager?: PagerProps;
  refreshing?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}

// Card that holds a table or card list, with its count and paging at the top.
export function ListCard({
  title,
  countLabel,
  pager,
  refreshing,
  actions,
  children,
}: ListCardProps) {
  const headingId = useId();
  return (
    <Paper
      component="section"
      variant="outlined"
      aria-labelledby={headingId}
      sx={{ overflow: 'hidden' }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1.5,
          px: { xs: 2, sm: 3 },
          py: 1.5,
          minHeight: 64,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}>
          <Typography id={headingId} component="h2" variant="h3">
            {title}
          </Typography>
          {countLabel && (
            <Typography role="status" color="text.secondary">
              {countLabel}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          {actions}
          {pager && <Pager {...pager} />}
        </Box>
      </Box>
      <Box sx={{ height: 4 }}>{refreshing && <LinearProgress aria-hidden />}</Box>
      {children}
      {pager && pager.pages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: { xs: 2, sm: 3 }, py: 1 }}>
          <Pager {...pager} />
        </Box>
      )}
    </Paper>
  );
}
