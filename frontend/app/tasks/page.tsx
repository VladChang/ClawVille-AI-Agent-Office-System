'use client';

import { Badge, Card } from '@/components/ui';
import { DataHealthBanner, EmptyState } from '@/components/dataState';
import { useDashboardStore } from '@/store/dashboardStore';

export default function TasksPage() {
  const { tasks, agentNameById, taskSearch, setTaskSearch, loading, error, connectionStatus, connectionMessage } = useDashboardStore((s) => ({
    tasks: s.tasks,
    agentNameById: s.agentNameById,
    taskSearch: s.taskSearch,
    setTaskSearch: s.setTaskSearch,
    loading: s.loading,
    error: s.error,
    connectionStatus: s.connectionStatus,
    connectionMessage: s.connectionMessage
  }));

  const filtered = tasks.filter((task) => task.title.toLowerCase().includes(taskSearch.toLowerCase()));

  const hasData = tasks.length > 0;

  return (
    <Card title="Tasks">
      <DataHealthBanner error={error} connectionStatus={connectionStatus} connectionMessage={connectionMessage} />

      <input
        value={taskSearch}
        onChange={(e) => setTaskSearch(e.target.value)}
        placeholder="Search tasks"
        className="mb-3 rounded border border-slate-700 bg-slate-950 px-3 py-1 text-sm"
      />

      {loading && !hasData ? (
        <p className="text-sm text-slate-400">Loading tasks…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={hasData ? 'No tasks match current search' : 'No tasks available'}
          detail={hasData ? 'Try a different search keyword.' : 'Waiting for tasks from API/realtime snapshot.'}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => (
            <div key={task.id} className="rounded border border-slate-800 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-medium">{task.title}</p>
                <Badge value={task.status} />
              </div>
              <p className="text-xs text-slate-400">Priority: {task.priority}</p>
              <p className="mt-1 text-xs text-slate-400">Agent: {task.assigneeAgentId ? agentNameById[task.assigneeAgentId] ?? 'Unassigned' : 'Unassigned'}</p>
              <p className="mt-1 text-xs text-slate-400">Updated: {new Date(task.updatedAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
