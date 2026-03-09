'use client';

import { Badge, Card } from '@/components/ui';
import { DataHealthBanner, EmptyState } from '@/components/dataState';
import { getTaskPriorityLabel, workforceLabels } from '@/lib/presentation';
import { useDashboardStore } from '@/store/dashboardStore';

export default function TasksPage() {
  const { tasks, agentNameById, taskSearch, setTaskSearch, loading, error, notice, connectionStatus, connectionMessage } = useDashboardStore((s) => ({
    tasks: s.tasks,
    agentNameById: s.agentNameById,
    taskSearch: s.taskSearch,
    setTaskSearch: s.setTaskSearch,
    loading: s.loading,
    error: s.error,
    notice: s.notice,
    connectionStatus: s.connectionStatus,
    connectionMessage: s.connectionMessage
  }));

  const filtered = tasks.filter((task) => task.title.toLowerCase().includes(taskSearch.toLowerCase()));

  const hasData = tasks.length > 0;

  return (
    <Card title="任務清單">
      <DataHealthBanner error={error} notice={notice} connectionStatus={connectionStatus} connectionMessage={connectionMessage} />

      <input
        value={taskSearch}
        onChange={(e) => setTaskSearch(e.target.value)}
        placeholder="搜尋任務"
        className="mb-3 rounded border border-slate-700 bg-slate-950 px-3 py-1 text-sm"
      />

      {loading && !hasData ? (
        <p className="text-sm text-slate-400">正在載入任務…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={hasData ? '目前沒有符合搜尋條件的任務' : '目前沒有任務資料'}
          detail={hasData ? '請嘗試其他搜尋關鍵字。' : '等待 API / 即時快照回傳任務資料。'}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => (
            <div key={task.id} className="rounded border border-slate-800 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-medium">{task.title}</p>
                <Badge value={task.status} />
              </div>
              <p className="text-xs text-slate-400">優先級：{getTaskPriorityLabel(task.priority)}</p>
              <p className="mt-1 text-xs text-slate-400">{workforceLabels.assignee}：{task.assigneeAgentId ? agentNameById[task.assigneeAgentId] ?? '未指派' : '未指派'}</p>
              <p className="mt-1 text-xs text-slate-400">更新時間：{new Date(task.updatedAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
