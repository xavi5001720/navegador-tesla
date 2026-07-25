'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    if (lastTracked.current === pathname) return;
    lastTracked.current = pathname;

    try {
      fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: pathname,
          referrer: typeof document !== 'undefined' ? document.referrer : '',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
        })
      }).catch(() => {});
    } catch (e) {}
  }, [pathname]);

  return null;
}
