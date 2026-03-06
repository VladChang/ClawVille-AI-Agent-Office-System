'use client';

import { useDashboardStore } from '@/store/dashboardStore';

export function SummaryBar() {
  const { agents, tasks, events } = useDashboardStore((s) => ({
    agents: s.agents,
    tasks: s.tasks,
    events: s.events
  }));

  const activeAgents = agents.filter((a) => a.status !== 'offline').length;
  const blockedTasks = tasks.filter((t) => t.status === 'blocked').length;

  return (
    <header className="grid grid-cols-2 gap-3 border-b border-slate-800 bg-slate-900/60 p-4 md:grid-cols-4">
      <Stat label="Agents" value={agents.length} />
      <Stat label="Active Agents" value={activeAgents} />
      <Stat label="Blocked Tasks" value={blockedTasks} />
      <Stat label="Events" value={events.length} />
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
