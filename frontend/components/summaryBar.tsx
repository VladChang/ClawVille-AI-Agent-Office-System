'use client';

import { getConnectionStatusLabel } from '@/lib/presentation';
import { useDashboardStore } from '@/store/dashboardStore';

export function SummaryBar() {
  const { agentCount, activeAgentCount, blockedTaskCount, eventCount, connectionStatus } = useDashboardStore((s) => ({
    agentCount: s.agents.length,
    activeAgentCount: s.activeAgentCount,
    blockedTaskCount: s.blockedTaskCount,
    eventCount: s.events.length,
    connectionStatus: s.connectionStatus
  }));

  return (
    <header className="grid grid-cols-2 gap-3 border-b border-slate-800 bg-slate-900/60 p-4 md:grid-cols-5">
      <Stat label="代理人總數" value={agentCount} />
      <Stat label="活躍代理人" value={activeAgentCount} />
      <Stat label="阻塞任務" value={blockedTaskCount} />
      <Stat label="事件數" value={eventCount} />
      <StatusStat status={connectionStatus} />
    </header>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}

function StatusStat({ status }: { status: 'idle' | 'connecting' | 'connected' | 'degraded' | 'disconnected' }) {
  const tone =
    status === 'connected'
      ? 'text-emerald-300'
      : status === 'connecting'
        ? 'text-cyan-300'
        : status === 'idle'
          ? 'text-slate-300'
          : 'text-amber-300';

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
      <p className="text-xs text-slate-400">即時連線</p>
      <p className={`text-lg font-semibold ${tone}`}>{getConnectionStatusLabel(status)}</p>
    </div>
  );
}
