import { useEffect, useState } from 'react';

/**
 * Re-renders the calling component on an interval and returns the current time.
 * Mount it only while it is needed (e.g. inside a countdown component); the
 * interval is cleared on unmount.
 */
export function useNow(intervalMs = 500): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
