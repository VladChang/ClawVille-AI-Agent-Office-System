'use client';

import { Badge, Card } from '@/components/ui';
import { DataHealthBanner, EmptyState } from '@/components/dataState';
import { useDashboardStore } from '@/store/dashboardStore';

export default function AgentsPage() {
  const {
    agents,
    tasks,
    agentSearch,
    agentStatusFilter,
    setAgentSearch,
    setAgentStatusFilter,
    selectAgent,
    selectedAgentId,
    loading,
    error,
    connectionStatus,
    connectionMessage
  } = useDashboardStore((s) => ({
    agents: s.agents,
    tasks: s.tasks,
    agentSearch: s.agentSearch,
    agentStatusFilter: s.agentStatusFilter,
    setAgentSearch: s.setAgentSearch,
    setAgentStatusFilter: s.setAgentStatusFilter,
    selectAgent: s.selectAgent,
    selectedAgentId: s.selectedAgentId,
    loading: s.loading,
    error: s.error,
    connectionStatus: s.connectionStatus,
    connectionMessage: s.connectionMessage
  }));

  const filtered = agents.filter((agent) => {
    const matchesSearch = `${agent.name} ${agent.role}`.toLowerCase().includes(agentSearch.toLowerCase());
    const matchesStatus = agentStatusFilter === 'all' || agent.status === agentStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const hasData = agents.length > 0;

  return (
    <Card title="Agents">
      <DataHealthBanner error={error} connectionStatus={connectionStatus} connectionMessage={connectionMessage} />

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

      {loading && !hasData ? (
        <p className="text-sm text-slate-400">Loading agents…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={hasData ? 'No agents match current filters' : 'No agents available'}
          detail={hasData ? 'Try clearing search or status filters.' : 'Waiting for agent data from API/realtime snapshot.'}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((agent) => {
            const task = tasks.find((t) => t.assigneeAgentId === agent.id && t.status !== 'done');
            const selected = selectedAgentId === agent.id;
            return (
              <button
                key={agent.id}
                onClick={() => selectAgent(agent.id)}
                className={`w-full rounded border p-3 text-left transition ${
                  selected ? 'border-cyan-500 ring-1 ring-cyan-500/40' : 'border-slate-800 hover:border-cyan-500/50'
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-medium">
                    {agent.name} {selected && <span className="ml-1 text-xs text-cyan-300">(selected)</span>}
                  </p>
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
