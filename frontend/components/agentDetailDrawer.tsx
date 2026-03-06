'use client';

import { useMemo } from 'react';
import { useDashboardStore } from '@/store/dashboardStore';

export function AgentDetailDrawer() {
  const { selectedAgentId, agents, tasks, selectAgent, pauseSelectedAgent, resumeSelectedAgent, retrySelectedAgentTask, controlLoading } =
    useDashboardStore((s) => ({
      selectedAgentId: s.selectedAgentId,
      agents: s.agents,
      tasks: s.tasks,
      selectAgent: s.selectAgent,
      pauseSelectedAgent: s.pauseSelectedAgent,
      resumeSelectedAgent: s.resumeSelectedAgent,
      retrySelectedAgentTask: s.retrySelectedAgentTask,
      controlLoading: s.controlLoading
    }));

  const selected = useMemo(() => agents.find((a) => a.id === selectedAgentId), [agents, selectedAgentId]);
  const currentTask = tasks.find((t) => t.assigneeAgentId === selected?.id && t.status !== 'done');

  return (
    <aside
      className={`fixed right-0 top-0 z-20 h-full w-80 border-l border-slate-800 bg-slate-900 p-4 shadow-xl transition-transform ${
        selected ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {selected && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{selected.name}</h2>
            <button className="rounded bg-slate-800 px-2 py-1 text-xs" onClick={() => selectAgent(null)}>
              Close
            </button>
          </div>
          <div className="space-y-3 text-sm text-slate-200">
            <p>
              <span className="text-slate-400">Role:</span> {selected.role}
            </p>
            <p>
              <span className="text-slate-400">Status:</span> {selected.status}
            </p>
            <p>
              <span className="text-slate-400">Last update:</span> {new Date(selected.updatedAt).toLocaleString()}
            </p>
            <p>
              <span className="text-slate-400">Current task:</span> {currentTask?.title ?? 'None'}
            </p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              className="rounded bg-cyan-600 px-3 py-1 text-sm font-medium hover:bg-cyan-500 disabled:opacity-50"
              onClick={() => void pauseSelectedAgent()}
              disabled={controlLoading}
            >
              Pause
            </button>
            <button
              className="rounded bg-emerald-600 px-3 py-1 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
              onClick={() => void resumeSelectedAgent()}
              disabled={controlLoading}
            >
              Resume
            </button>
            <button
              className="rounded bg-amber-600 px-3 py-1 text-sm font-medium hover:bg-amber-500 disabled:opacity-50"
              onClick={() => void retrySelectedAgentTask()}
              disabled={controlLoading}
            >
              Retry Task
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
