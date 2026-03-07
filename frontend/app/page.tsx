'use client';

import { Card, Badge } from '@/components/ui';
import { getDashboardDerivedMetrics } from '@/lib/analytics';
import { useDashboardStore } from '@/store/dashboardStore';

export default function OverviewPage() {
  const { agents, tasks, events, loading, error } = useDashboardStore((s) => ({
    agents: s.agents,
    tasks: s.tasks,
    events: s.events,
    loading: s.loading,
    error: s.error
  }));

  const derived = getDashboardDerivedMetrics(agents, tasks, events);

  if (loading) {
    return <p className="text-sm text-slate-400">Loading dashboard…</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="System Snapshot">
        {error && <p className="mb-3 rounded border border-rose-800 bg-rose-950/40 p-2 text-sm text-rose-200">{error}</p>}
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
            Active incidents: <b>{events.filter((e) => e.level === 'error').length}</b>
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
      </Card>

      <Card title="Recent Events">
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
      </Card>
    </div>
  );
}
