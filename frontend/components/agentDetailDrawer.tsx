'use client';

import { useEffect, useMemo, useState } from 'react';
import { getAgentLabel, getAgentStatusLabel } from '@/lib/presentation';
import { useDashboardStore } from '@/store/dashboardStore';

export function AgentDetailDrawer() {
  const {
    selectedAgentId,
    agents,
    currentTaskByAgentId,
    selectAgent,
    pauseSelectedAgent,
    resumeSelectedAgent,
    retrySelectedAgentTask,
    updateSelectedAgentDisplayName,
    controlLoading
  } =
    useDashboardStore((s) => ({
      selectedAgentId: s.selectedAgentId,
      agents: s.agents,
      currentTaskByAgentId: s.currentTaskByAgentId,
      selectAgent: s.selectAgent,
      pauseSelectedAgent: s.pauseSelectedAgent,
      resumeSelectedAgent: s.resumeSelectedAgent,
      retrySelectedAgentTask: s.retrySelectedAgentTask,
      updateSelectedAgentDisplayName: s.updateSelectedAgentDisplayName,
      controlLoading: s.controlLoading
    }));

  const selected = useMemo(() => agents.find((a) => a.id === selectedAgentId), [agents, selectedAgentId]);
  const currentTask = selected ? currentTaskByAgentId[selected.id] : undefined;
  const [displayNameDraft, setDisplayNameDraft] = useState('');

  useEffect(() => {
    setDisplayNameDraft(selected?.displayName ?? '');
  }, [selected?.id, selected?.displayName]);

  return (
    <aside
      className={`fixed right-0 top-0 z-20 h-full w-80 border-l border-slate-800 bg-slate-900 p-4 shadow-xl transition-transform ${
        selected ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {selected && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{getAgentLabel(selected)}</h2>
            <button className="rounded bg-slate-800 px-2 py-1 text-xs" onClick={() => selectAgent(null)}>
              關閉
            </button>
          </div>
          <div className="space-y-3 text-sm text-slate-200">
            <p>
              <span className="text-slate-400">原始名稱：</span> {selected.name}
            </p>
            <p>
              <span className="text-slate-400">角色：</span> {selected.role}
            </p>
            <p>
              <span className="text-slate-400">狀態：</span> {getAgentStatusLabel(selected.status)}
            </p>
            <p>
              <span className="text-slate-400">最後更新：</span> {new Date(selected.updatedAt).toLocaleString()}
            </p>
            <p>
              <span className="text-slate-400">目前任務：</span> {currentTask?.title ?? '暫無'}
            </p>
            <div className="space-y-2 rounded border border-slate-800 bg-slate-950/40 p-3">
              <label className="block text-xs text-slate-400" htmlFor="agent-display-name">
                顯示別名
              </label>
              <input
                id="agent-display-name"
                value={displayNameDraft}
                onChange={(event) => setDisplayNameDraft(event.target.value)}
                placeholder="輸入繁中顯示名稱"
                className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
              <div className="flex gap-2">
                <button
                  className="rounded bg-cyan-700 px-3 py-1 text-xs font-medium hover:bg-cyan-600 disabled:opacity-50"
                  onClick={() => void updateSelectedAgentDisplayName(displayNameDraft)}
                  disabled={controlLoading}
                >
                  儲存別名
                </button>
                <button
                  className="rounded bg-slate-800 px-3 py-1 text-xs font-medium hover:bg-slate-700 disabled:opacity-50"
                  onClick={() => {
                    setDisplayNameDraft('');
                    void updateSelectedAgentDisplayName(null);
                  }}
                  disabled={controlLoading}
                >
                  清除別名
                </button>
              </div>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              className="rounded bg-cyan-600 px-3 py-1 text-sm font-medium hover:bg-cyan-500 disabled:opacity-50"
              onClick={() => void pauseSelectedAgent()}
              disabled={controlLoading}
            >
              暫停
            </button>
            <button
              className="rounded bg-emerald-600 px-3 py-1 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
              onClick={() => void resumeSelectedAgent()}
              disabled={controlLoading}
            >
              恢復
            </button>
            <button
              className="rounded bg-amber-600 px-3 py-1 text-sm font-medium hover:bg-amber-500 disabled:opacity-50"
              onClick={() => void retrySelectedAgentTask()}
              disabled={controlLoading}
            >
              重試任務
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
