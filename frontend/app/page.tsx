'use client';

import { Card, Badge } from '@/components/ui';
import { DataHealthBanner, EmptyState, SkeletonLines } from '@/components/dataState';
import { getDashboardDerivedMetrics } from '@/lib/analytics';
import { isErrorLevel } from '@/lib/schema';
import { useDashboardStore } from '@/store/dashboardStore';

export default function OverviewPage() {
  const { agents, tasks, events, loading, error, connectionStatus, connectionMessage } = useDashboardStore((s) => ({
    agents: s.agents,
    tasks: s.tasks,
    events: s.events,
    loading: s.loading,
    error: s.error,
    connectionStatus: s.connectionStatus,
    connectionMessage: s.connectionMessage
  }));

  const derived = getDashboardDerivedMetrics(agents, tasks, events);

  const cardTone = {
    errorRate: derived.errorRate.percentage >= 20 ? 'danger' : derived.errorRate.percentage >= 8 ? 'warn' : 'good',
    waitTime: derived.averageWaitTime.valueMinutes >= 45 ? 'warn' : 'neutral'
  } as const;

  const toneClass = {
    danger: 'border-rose-800/80 bg-rose-950/20 text-rose-200',
    warn: 'border-amber-700/70 bg-amber-950/15 text-amber-100',
    good: 'border-emerald-700/60 bg-emerald-950/10 text-emerald-100',
    neutral: 'border-slate-800 bg-slate-900/50 text-slate-200'
  } as const;

  const hasData = agents.length > 0 || tasks.length > 0 || events.length > 0;


  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="System Snapshot">
        <DataHealthBanner error={error} connectionStatus={connectionStatus} connectionMessage={connectionMessage} />
        {loading && !hasData ? (
          <SkeletonLines rows={7} />
        ) : !hasData ? (
          <EmptyState
            title="No dashboard data yet"
            detail="Waiting for initial snapshot. If backend is offline, local fallback data will appear when available."
          />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <div className={`rounded border p-2 text-sm ${toneClass.neutral}`}>
              <p className="text-xs text-slate-400">Total agents</p>
              <p className="font-semibold">{agents.length}</p>
            </div>
            <div className={`rounded border p-2 text-sm ${toneClass.neutral}`}>
              <p className="text-xs text-slate-400">Open tasks</p>
              <p className="font-semibold">{tasks.filter((t) => t.status !== 'done').length}</p>
            </div>
            <div className={`rounded border p-2 text-sm ${toneClass[cardTone.waitTime]}`}>
              <p className="text-xs">Avg wait time</p>
              <p className="font-semibold">{derived.averageWaitTime.valueMinutes} min</p>
            </div>
            <div className={`rounded border p-2 text-sm ${toneClass[cardTone.errorRate]}`}>
              <p className="text-xs">Error rate</p>
              <p className="font-semibold">{derived.errorRate.percentage}%</p>
            </div>
            <div className={`rounded border p-2 text-sm ${toneClass.neutral} sm:col-span-2`}>
              <p className="text-xs text-slate-400">Busiest agent</p>
              <p className="font-semibold">
                {derived.busiestAgent
                  ? `${derived.busiestAgent.name} (${derived.busiestAgent.activeTaskCount} active tasks)`
                  : 'N/A'}
              </p>
            </div>
          </div>
        )}
      </Card>

      <Card title="Recent Events">
        {loading && events.length === 0 ? (
          <SkeletonLines rows={4} />
        ) : events.length === 0 ? (
          <EmptyState title="No events yet" detail="Realtime timeline is empty right now." />
        ) : (
          <div className="space-y-2">
            {events.slice(0, 4).map((event) => (
              <div key={event.id} className="rounded border border-slate-800 p-3 text-sm">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <Badge value={event.level} />
                  <span className="text-xs text-slate-400">{new Date(event.timestamp).toLocaleTimeString()}</span>
                </div>
                <p>{event.message}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
