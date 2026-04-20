'use client';

import { Suspense } from 'react';
import { DevModeProvider } from '@/contexts/DevModeContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<>{children}</>}>
      <DevModeProvider>
        {children}
      </DevModeProvider>
    </Suspense>
  );
}
