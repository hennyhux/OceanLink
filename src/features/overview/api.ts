import { useQuery } from '@tanstack/react-query';

import { http } from '@/lib/api/http';
import { keys } from '@/lib/queryKeys';

import type { OverviewMetrics } from './types';

export function useOverviewMetrics() {
  return useQuery({
    queryKey: [...keys.overview, 'summary'],
    queryFn: ({ signal }) => http.get<OverviewMetrics>('/reports/summary', { signal }),
  });
}
