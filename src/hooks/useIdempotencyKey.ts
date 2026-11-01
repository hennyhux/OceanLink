import { useCallback, useRef } from 'react';

// One key per intended money operation. Keep it while the result is unknown so a retry
// cannot create a second record; drop it once the server gives a definite answer.
export function useIdempotencyKey() {
  const key = useRef<string | null>(null);
  const current = useCallback(() => {
    key.current ??= crypto.randomUUID();
    return key.current;
  }, []);
  const clear = useCallback(() => {
    key.current = null;
  }, []);
  return { current, clear };
}
