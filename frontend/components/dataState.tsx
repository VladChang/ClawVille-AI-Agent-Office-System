import type { ReactNode } from 'react';
import type { DashboardConnectionStatus } from '@/store/dashboardStore';

export function DataHealthBanner({
  error,
  connectionStatus,
  connectionMessage
}: {
  error: string | null;
  connectionStatus: DashboardConnectionStatus;
  connectionMessage: string | null;
}) {
  return (
    <div className="mb-3 space-y-2">
      {error && <Notice tone="error">{error}</Notice>}
      {connectionStatus === 'disconnected' && connectionMessage && <Notice tone="warn">{connectionMessage}</Notice>}
      {connectionStatus === 'degraded' && connectionMessage && <Notice tone="warn">{connectionMessage}</Notice>}
      {connectionStatus === 'connecting' && connectionMessage && <Notice tone="info">{connectionMessage}</Notice>}
    </div>
  );
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/30 p-4 text-sm">
      <p className="font-medium text-slate-200">{title}</p>
      <p className="mt-1 text-slate-400">{detail}</p>
    </div>
  );
}

function Notice({ tone, children }: { tone: 'info' | 'warn' | 'error'; children: ReactNode }) {
  const cls =
    tone === 'error'
      ? 'border-rose-800 bg-rose-950/40 text-rose-200'
      : tone === 'warn'
        ? 'border-amber-800 bg-amber-950/30 text-amber-100'
        : 'border-cyan-800 bg-cyan-950/20 text-cyan-100';

  return <p className={`rounded border p-2 text-sm ${cls}`}>{children}</p>;
}
