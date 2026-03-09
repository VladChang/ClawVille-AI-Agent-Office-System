'use client';

import { Badge, Card } from '@/components/ui';
import { DataHealthBanner, EmptyState } from '@/components/dataState';
import { getAgentLabel } from '@/lib/presentation';
import { useDashboardStore } from '@/store/dashboardStore';

export default function AgentsPage() {
  const {
    agents,
    currentTaskByAgentId,
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
    currentTaskByAgentId: s.currentTaskByAgentId,
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
    const matchesSearch = `${agent.name} ${agent.displayName ?? ''} ${agent.role}`.toLowerCase().includes(agentSearch.toLowerCase());
    const matchesStatus = agentStatusFilter === 'all' || agent.status === agentStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const hasData = agents.length > 0;

  return (
    <Card title="代理人列表">
      <DataHealthBanner error={error} connectionStatus={connectionStatus} connectionMessage={connectionMessage} />

      <div className="mb-3 flex flex-wrap gap-2">
        <input
          value={agentSearch}
          onChange={(e) => setAgentSearch(e.target.value)}
          placeholder="搜尋名稱、別名或角色"
          className="rounded border border-slate-700 bg-slate-950 px-3 py-1 text-sm"
        />
        <select
          value={agentStatusFilter}
          onChange={(e) => setAgentStatusFilter(e.target.value as typeof agentStatusFilter)}
          className="rounded border border-slate-700 bg-slate-950 px-3 py-1 text-sm"
        >
          <option value="all">全部狀態</option>
          <option value="idle">待命</option>
          <option value="busy">忙碌</option>
          <option value="offline">離線</option>
        </select>
      </div>

      {loading && !hasData ? (
        <p className="text-sm text-slate-400">正在載入 Agents…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={hasData ? '目前沒有符合篩選條件的 Agent' : '目前沒有 Agent 資料'}
          detail={hasData ? '請試著清除搜尋或狀態篩選。' : '等待 API / 即時快照回傳 Agent 資料。'}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((agent) => {
            const task = currentTaskByAgentId[agent.id];
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
                    {getAgentLabel(agent)} {selected && <span className="ml-1 text-xs text-cyan-300">（已選取）</span>}
                  </p>
                  <Badge value={agent.status} />
                </div>
                <p className="text-sm text-slate-300">{agent.role}</p>
                <p className="text-xs text-slate-400">任務：{task?.title ?? '暫無'}</p>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}
