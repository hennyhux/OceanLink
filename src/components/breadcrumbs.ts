import { createContext, useContext, useEffect } from 'react';

export interface Crumb {
  label: string;
  to?: string;
}

export const BreadcrumbContext = createContext<(crumbs: Crumb[]) => void>(() => undefined);

// Pages describe where they are; the top bar shows it.
export function useBreadcrumbs(crumbs: Crumb[]): void {
  const set = useContext(BreadcrumbContext);
  const signature = JSON.stringify(crumbs);
  useEffect(() => {
    set(JSON.parse(signature) as Crumb[]);
  }, [set, signature]);
}
