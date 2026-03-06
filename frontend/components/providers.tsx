'use client';

import { useEffect } from 'react';
import { useDashboardStore } from '@/store/dashboardStore';

export function AppProviders({ children }: { children: React.ReactNode }) {
  const initialize = useDashboardStore((s) => s.initialize);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  return <>{children}</>;
}
