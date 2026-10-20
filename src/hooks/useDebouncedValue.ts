import { useEffect, useRef, useState } from 'react';

// Delays a fast-changing value (like search text) so we do not hit the API on every keystroke.
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer.current);
  }, [value, delayMs]);

  return debounced;
}
