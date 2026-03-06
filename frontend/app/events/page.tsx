'use client';

import { Badge, Card } from '@/components/ui';
import { useDashboardStore } from '@/store/dashboardStore';

export default function EventsPage() {
  const { events, eventLevelFilter, setEventLevelFilter, loading, error } = useDashboardStore((s) => ({
    events: s.events,
    eventLevelFilter: s.eventLevelFilter,
    setEventLevelFilter: s.setEventLevelFilter,
    loading: s.loading,
    error: s.error
  }));

  const filtered = events.filter((event) => eventLevelFilter === 'all' || event.level === eventLevelFilter);

  return (
    <Card title="Event Timeline">
      {error && <p className="mb-3 rounded border border-rose-800 bg-rose-950/40 p-2 text-sm text-rose-200">{error}</p>}

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

      {loading ? (
        <p className="text-sm text-slate-400">Loading events…</p>
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
