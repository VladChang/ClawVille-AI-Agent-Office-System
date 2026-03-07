'use client';

import { Badge, Card } from '@/components/ui';
import { DataHealthBanner, EmptyState } from '@/components/dataState';
import { useDashboardStore } from '@/store/dashboardStore';

export default function EventsPage() {
  const { events, eventLevelFilter, setEventLevelFilter, loading, error, connectionStatus, connectionMessage } = useDashboardStore((s) => ({
    events: s.events,
    eventLevelFilter: s.eventLevelFilter,
    setEventLevelFilter: s.setEventLevelFilter,
    loading: s.loading,
    error: s.error,
    connectionStatus: s.connectionStatus,
    connectionMessage: s.connectionMessage
  }));

  const filtered = events.filter((event) => eventLevelFilter === 'all' || event.level === eventLevelFilter);

  const hasData = events.length > 0;

  return (
    <Card title="Event Timeline">
      <DataHealthBanner error={error} connectionStatus={connectionStatus} connectionMessage={connectionMessage} />

      <select
        value={eventLevelFilter}
        onChange={(e) => setEventLevelFilter(e.target.value as typeof eventLevelFilter)}
        className="mb-3 rounded border border-slate-700 bg-slate-950 px-3 py-1 text-sm"
      >
        <option value="all">All levels</option>
        <option value="info">Info</option>
        <option value="warning">Warning</option>
        <option value="error">Error</option>
      </select>

      {loading && !hasData ? (
        <p className="text-sm text-slate-400">Loading events…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={hasData ? 'No events match current level filter' : 'No events available'}
          detail={hasData ? 'Try switching to "All levels".' : 'Waiting for realtime timeline updates.'}
        />
      ) : (
        <div className="max-h-[60vh] space-y-2 overflow-auto pr-1">
          {filtered.map((event) => (
            <article key={event.id} className="rounded border border-slate-800 p-3 text-sm">
              <div className="mb-1 flex items-center justify-between gap-2">
                <Badge value={event.level} />
                <span className="text-xs text-slate-400">{new Date(event.timestamp).toLocaleString()}</span>
              </div>
              <p className="text-slate-200">{event.message}</p>
              <p className="mt-1 text-xs text-slate-500">{event.type}</p>
            </article>
          ))}
        </div>
      )}
    </Card>
  );
}
