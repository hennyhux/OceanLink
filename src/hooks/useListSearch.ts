import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useDebouncedValue } from './useDebouncedValue';

// Search text, page, and filters live in the URL so Back and refresh keep them.
export function useListSearch() {
  const [params, setParams] = useSearchParams();
  const urlQ = params.get('q') ?? '';
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1);
  const [text, setText] = useState(urlQ);
  const debounced = useDebouncedValue(text, 300);

  const update = useCallback(
    (changes: Record<string, string | null>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(changes)) {
            if (value === null || value === '') next.delete(key);
            else next.set(key, value);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  // Typed text goes to the URL after a short pause and always restarts at page 1.
  useEffect(() => {
    if (debounced.trim() !== urlQ.trim()) update({ q: debounced.trim() || null, page: null });
    // Only the debounced text should trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  // A change from outside (Back button, a link) replaces the box text.
  useEffect(() => {
    setText((current) => (current.trim() === urlQ.trim() ? current : urlQ));
  }, [urlQ]);

  return {
    q: urlQ,
    text,
    setText,
    clear: () => {
      setText('');
      update({ q: null, page: null });
    },
    // Pushes the typed text to the URL now, without waiting for the pause.
    commit: () => update({ q: text.trim() || null, page: null }),
    page,
    setPage: (next: number) => update({ page: next > 1 ? String(next) : null }),
    flag: (name: string) => params.get(name) === '1',
    setFlag: (name: string, on: boolean) => update({ [name]: on ? '1' : null, page: null }),
    value: (name: string) => params.get(name) ?? '',
    setValues: (changes: Record<string, string | null>) => update({ ...changes, page: null }),
    params,
  };
}
