'use client';

import { Card, Badge } from '@/components/ui';
import { DataHealthBanner, EmptyState } from '@/components/dataState';
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

  const hasData = agents.length > 0 || tasks.length > 0 || events.length > 0;

  if (loading && !hasData) {
    return <p className="text-sm text-slate-400">Loading dashboard…</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="System Snapshot">
        <DataHealthBanner error={error} connectionStatus={connectionStatus} connectionMessage={connectionMessage} />
        {!hasData ? (
          <EmptyState
            title="No dashboard data yet"
            detail="Waiting for initial snapshot. If backend is offline, local fallback data will appear when available."
          />
        ) : (
          <ul className="space-y-2 text-sm">
            <li>
              Total agents: <b>{agents.length}</b>
            </li>
            <li>
              Total tasks: <b>{tasks.length}</b>
            </li>
            <li>
              Open tasks: <b>{tasks.filter((t) => t.status !== 'done').length}</b>
            </li>
            <li>
              Active incidents: <b>{events.filter((e) => isErrorLevel(e.level)).length}</b>
            </li>
            <li>
              Busiest agent:{' '}
              <b>
                {derived.busiestAgent
                  ? `${derived.busiestAgent.name} (${derived.busiestAgent.activeTaskCount} active tasks)`
                  : 'N/A'}
              </b>
            </li>
            <li>
              Avg wait time (todo/blocked): <b>{derived.averageWaitTime.valueMinutes} min</b>
            </li>
            <li>
              Error rate: <b>{derived.errorRate.percentage}%</b>
            </li>
          </ul>
        )}
      </Card>

      <Card title="Recent Events">
        {events.length === 0 ? (
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
