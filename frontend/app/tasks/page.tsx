'use client';

import { Badge, Card } from '@/components/ui';
import { useDashboardStore } from '@/store/dashboardStore';

export default function TasksPage() {
  const { tasks, agents, taskSearch, setTaskSearch, loading, error } = useDashboardStore((s) => ({
    tasks: s.tasks,
    agents: s.agents,
    taskSearch: s.taskSearch,
    setTaskSearch: s.setTaskSearch,
    loading: s.loading,
    error: s.error
  }));

  const filtered = tasks.filter((task) => task.title.toLowerCase().includes(taskSearch.toLowerCase()));

  return (
    <Card title="Tasks">
      {error && <p className="mb-3 rounded border border-rose-800 bg-rose-950/40 p-2 text-sm text-rose-200">{error}</p>}

      <input
        value={taskSearch}
        onChange={(e) => setTaskSearch(e.target.value)}
        placeholder="Search tasks"
        className="mb-3 rounded border border-slate-700 bg-slate-950 px-3 py-1 text-sm"
      />

      {loading ? (
        <p className="text-sm text-slate-400">Loading tasks…</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => (
            <div key={task.id} className="rounded border border-slate-800 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-medium">{task.title}</p>
                <Badge value={task.status} />
              </div>
              <p className="text-xs text-slate-400">Priority: {task.priority}</p>
              <p className="mt-1 text-xs text-slate-400">Agent: {agents.find((a) => a.id === task.assigneeAgentId)?.name ?? 'Unassigned'}</p>
              <p className="mt-1 text-xs text-slate-400">Updated: {new Date(task.updatedAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
