'use client';

import {
  getConnectionStatusLabel,
  getRuntimeSourceDetail,
  getRuntimeSourceLabel,
  getRuntimeSourceTone,
  getRuntimeVerificationLabel,
  workforceLabels
} from '@/lib/presentation';
import { useDashboardStore } from '@/store/dashboardStore';

export function SummaryBar() {
  const { agentCount, activeAgentCount, blockedTaskCount, eventCount, connectionStatus, runtimeStatus } = useDashboardStore((s) => ({
    agentCount: s.agents.length,
    activeAgentCount: s.activeAgentCount,
    blockedTaskCount: s.blockedTaskCount,
    eventCount: s.events.length,
    connectionStatus: s.connectionStatus,
    runtimeStatus: s.runtimeStatus
  }));

  return (
    <header className="grid grid-cols-2 gap-3 border-b border-slate-800 bg-slate-900/60 p-4 md:grid-cols-6">
      <Stat label={workforceLabels.total} value={agentCount} />
      <Stat label={workforceLabels.active} value={activeAgentCount} />
      <Stat label="阻塞任務" value={blockedTaskCount} />
      <Stat label="事件數" value={eventCount} />
      <StatusStat status={connectionStatus} />
      <SourceStat
        label={getRuntimeSourceLabel(runtimeStatus)}
        verification={getRuntimeVerificationLabel(runtimeStatus)}
        detail={getRuntimeSourceDetail(runtimeStatus)}
        tone={getRuntimeSourceTone(runtimeStatus)}
      />
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

function SourceStat({
  label,
  verification,
  detail,
  tone
}: {
  label: string;
  verification: string;
  detail: string | null;
  tone: 'neutral' | 'verified' | 'caution' | 'danger';
}) {
  const toneClass =
    tone === 'verified'
      ? 'text-emerald-300'
      : tone === 'danger'
        ? 'text-rose-300'
        : tone === 'caution'
          ? 'text-amber-300'
          : 'text-slate-300';

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
      <p className="text-xs text-slate-400">資料來源</p>
      <p className={`text-sm font-semibold ${toneClass}`}>{label}</p>
      <p className="mt-1 text-[11px] text-slate-400">{verification}</p>
      {detail && <p className="mt-1 text-[11px] text-slate-500">{detail}</p>}
    </div>
  );
}
