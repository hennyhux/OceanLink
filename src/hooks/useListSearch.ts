import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useDebouncedValue } from './useDebouncedValue';

// Search text, "show inactive" and page for a list screen. They live in the URL so they survive
// navigation and refresh. The text box keeps its own state: router updates run in a transition,
// which would drop keystrokes and break Chinese IME input if the input were bound to the URL.
export function useListSearch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQ = searchParams.get('q') ?? '';
  const includeInactive = searchParams.get('inactive') === '1';
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1);

  const [searchText, setSearchText] = useState(urlQ);
  const debouncedText = useDebouncedValue(searchText, 300);

  // The last search text this hook put in the URL. It tells our own writes apart from changes
  // made elsewhere, such as clicking the sidebar link, which should reset the text box.
  const writtenQ = useRef(urlQ.trim());
  // The last debounced value we acted on. Only a new value may write to the URL, otherwise an
  // old one would be written back right after the search was cleared.
  const handledText = useRef(debouncedText);

  useEffect(() => {
    if (debouncedText === handledText.current) return;
    handledText.current = debouncedText;
    const trimmed = debouncedText.trim();
    if (trimmed === urlQ.trim()) return;
    writtenQ.current = trimmed;
    const next = new URLSearchParams(searchParams);
    if (trimmed) next.set('q', trimmed);
    else next.delete('q');
    next.delete('page');
    setSearchParams(next, { replace: true });
  }, [debouncedText, urlQ, searchParams, setSearchParams]);

  useEffect(() => {
    if (urlQ.trim() === writtenQ.current) return;
    writtenQ.current = urlQ.trim();
    setSearchText(urlQ);
  }, [urlQ]);

  const updateParams = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
    }
    setSearchParams(next, { replace: true });
  };

  const clearSearch = () => {
    writtenQ.current = '';
    setSearchText('');
    updateParams({ q: null, page: null });
  };

  return {
    urlQ,
    includeInactive,
    page,
    searchText,
    setSearchText,
    clearSearch,
    updateParams,
  };
}
