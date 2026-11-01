import { useQuery } from '@tanstack/react-query';

import { http } from '@/lib/api/http';

export interface Lot {
  id: string;
  name: string;
  time_zone: string;
  currency: 'USD';
}

export function useLot() {
  return useQuery({
    queryKey: ['lot', 'current'],
    queryFn: ({ signal }) => http.get<Lot>('/lots/current', { signal }),
    staleTime: 5 * 60_000,
  });
}
