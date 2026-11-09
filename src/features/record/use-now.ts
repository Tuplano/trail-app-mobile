import { useEffect, useState } from 'react';

/**
 * The current time, updated every second while `ticking` is true. Used for
 * clocks on screen; stops (and stops re-rendering) when not needed.
 */
export function useNow(ticking: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!ticking) return;
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, 1000);
    // Update at once too, so a clock that just started doesn't show a stale time.
    const first = setTimeout(tick, 0);
    return () => {
      clearInterval(timer);
      clearTimeout(first);
    };
  }, [ticking]);

  return now;
}
