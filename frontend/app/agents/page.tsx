'use client';

import { Badge, Card } from '@/components/ui';
import { useDashboardStore } from '@/store/dashboardStore';

export default function AgentsPage() {
  const { agents, tasks, agentSearch, agentStatusFilter, setAgentSearch, setAgentStatusFilter, selectAgent, loading, error } = useDashboardStore(
    (s) => ({
      agents: s.agents,
      tasks: s.tasks,
      agentSearch: s.agentSearch,
      agentStatusFilter: s.agentStatusFilter,
      setAgentSearch: s.setAgentSearch,
      setAgentStatusFilter: s.setAgentStatusFilter,
      selectAgent: s.selectAgent,
      loading: s.loading,
      error: s.error
    })
  );

  const filtered = agents.filter((agent) => {
    const matchesSearch = `${agent.name} ${agent.role}`.toLowerCase().includes(agentSearch.toLowerCase());
    const matchesStatus = agentStatusFilter === 'all' || agent.status === agentStatusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <Card title="Agents">
      {error && <p className="mb-3 rounded border border-rose-800 bg-rose-950/40 p-2 text-sm text-rose-200">{error}</p>}

      <div className="mb-3 flex flex-wrap gap-2">
        <input
          value={agentSearch}
          onChange={(e) => setAgentSearch(e.target.value)}
          placeholder="Search name or role"
          className="rounded border border-slate-700 bg-slate-950 px-3 py-1 text-sm"
        />
        <select
          value={agentStatusFilter}
          onChange={(e) => setAgentStatusFilter(e.target.value as typeof agentStatusFilter)}
          className="rounded border border-slate-700 bg-slate-950 px-3 py-1 text-sm"
        >
          <option value="all">All status</option>
          <option value="idle">Idle</option>
          <option value="busy">Busy</option>
          <option value="offline">Offline</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading agents…</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((agent) => {
            const task = tasks.find((t) => t.assigneeAgentId === agent.id && t.status !== 'done');
            return (
              <button
                key={agent.id}
                onClick={() => selectAgent(agent.id)}
                className="w-full rounded border border-slate-800 p-3 text-left transition hover:border-cyan-500/50"
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-medium">{agent.name}</p>
                  <Badge value={agent.status} />
                </div>
                <p className="text-sm text-slate-300">{agent.role}</p>
                <p className="text-xs text-slate-400">Task: {task?.title ?? 'None'}</p>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}
