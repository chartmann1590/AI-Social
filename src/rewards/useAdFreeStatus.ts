import { useEffect, useMemo, useState } from 'react';
import { useAdRewardsStore } from '../store';

export function useAdFreeStatus() {
  const adFreeUntil = useAdRewardsStore((state) => state.adFreeUntil);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());

    if (adFreeUntil <= Date.now()) {
      return;
    }

    const interval = setInterval(() => setNow(Date.now()), 30000);

    return () => clearInterval(interval);
  }, [adFreeUntil]);

  return useMemo(() => {
    const remainingMs = Math.max(0, adFreeUntil - now);

    return {
      adFreeUntil,
      isAdFreeActive: remainingMs > 0,
      remainingMs,
    };
  }, [adFreeUntil, now]);
}
