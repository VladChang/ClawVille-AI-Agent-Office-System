'use client';

import { Badge, Card } from '@/components/ui';
import { DataHealthBanner, EmptyState } from '@/components/dataState';
import { getEventTypeLabel } from '@/lib/presentation';
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
    <Card title="事件時間軸">
      <DataHealthBanner error={error} connectionStatus={connectionStatus} connectionMessage={connectionMessage} />

      <select
        value={eventLevelFilter}
        onChange={(e) => setEventLevelFilter(e.target.value as typeof eventLevelFilter)}
        className="mb-3 rounded border border-slate-700 bg-slate-950 px-3 py-1 text-sm"
      >
        <option value="all">全部等級</option>
        <option value="info">資訊</option>
        <option value="warning">警告</option>
        <option value="error">錯誤</option>
      </select>

      {loading && !hasData ? (
        <p className="text-sm text-slate-400">正在載入事件…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={hasData ? '目前沒有符合等級篩選的事件' : '目前沒有事件資料'}
          detail={hasData ? '請嘗試切換成「全部等級」。' : '等待即時時間軸更新。'}
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
              <p className="mt-1 text-xs text-slate-500">{getEventTypeLabel(event.type)}</p>
            </article>
          ))}
        </div>
      )}
    </Card>
  );
}
