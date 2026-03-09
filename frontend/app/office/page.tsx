'use client';

import { useMemo } from 'react';
import { Card, Badge } from '@/components/ui';
import { DataHealthBanner, EmptyState } from '@/components/dataState';
import { getAgentLabel } from '@/lib/presentation';
import { useDashboardStore } from '@/store/dashboardStore';
import type { Agent, AgentStatus } from '@/types/models';

const roomOrder = [
  '規劃室',
  '研究圖書館',
  '記憶檔案庫',
  '工具工坊',
  '審查室',
  '協作中樞',
  '休息區',
  '事件處理台'
] as const;

type Room = (typeof roomOrder)[number];

const moodByStatus: Record<AgentStatus, string> = {
  busy: '🤔',
  idle: '😌',
  offline: '😴'
};

const roomLayout: Record<Room, { x: number; y: number; w: number; h: number }> = {
  '規劃室': { x: 3, y: 4, w: 27, h: 20 },
  '研究圖書館': { x: 35, y: 4, w: 27, h: 20 },
  '記憶檔案庫': { x: 67, y: 4, w: 30, h: 20 },
  '工具工坊': { x: 3, y: 30, w: 30, h: 20 },
  '審查室': { x: 38, y: 30, w: 24, h: 20 },
  '協作中樞': { x: 67, y: 30, w: 30, h: 20 },
  '休息區': { x: 3, y: 56, w: 44, h: 20 },
  '事件處理台': { x: 52, y: 56, w: 45, h: 20 }
};

function roomForAgent(agent: Agent): Room {
  const role = agent.role.toLowerCase();

  if (agent.status === 'offline') return '事件處理台';
  if (agent.status === 'idle') return '休息區';
  if (role.includes('plan') || role.includes('coord')) return '規劃室';
  if (role.includes('research') || role.includes('browser') || role.includes('analyst')) return '研究圖書館';
  if (role.includes('memory') || role.includes('knowledge')) return '記憶檔案庫';
  if (role.includes('tool') || role.includes('builder') || role.includes('execute')) return '工具工坊';
  if (role.includes('review') || role.includes('qa') || role.includes('critic')) return '審查室';
  return '協作中樞';
}

function thoughtSummary(agent: Agent, taskTitle?: string): string {
  if (agent.status === 'offline') return '正在處理事件復原檢查。';
  if (agent.status === 'idle') return '等待下一個任務派發。';
  if (taskTitle) return `目前工作：${taskTitle}`;
  return '正在同步團隊更新。';
}

export default function OfficePage() {
  const { agents, tasks, currentTaskByAgentId, loading, error, notice, connectionStatus, connectionMessage, selectAgent, selectedAgentId } = useDashboardStore((s) => ({
    agents: s.agents,
    tasks: s.tasks,
    currentTaskByAgentId: s.currentTaskByAgentId,
    loading: s.loading,
    error: s.error,
    notice: s.notice,
    connectionStatus: s.connectionStatus,
    connectionMessage: s.connectionMessage,
    selectAgent: s.selectAgent,
    selectedAgentId: s.selectedAgentId
  }));

  const grouped = useMemo(() => {
    const map: Record<Room, Agent[]> = {
      '規劃室': [],
      '研究圖書館': [],
      '記憶檔案庫': [],
      '工具工坊': [],
      '審查室': [],
      '協作中樞': [],
      '休息區': [],
      '事件處理台': []
    };

    for (const agent of agents) {
      map[roomForAgent(agent)].push(agent);
    }

    return map;
  }, [agents]);

  const occupancy = useMemo(() => roomOrder.map((room) => ({ room, count: grouped[room].length })), [grouped]);

  const collaborationSignals = useMemo(() => {
    const active = tasks.filter((t) => t.status === 'in_progress' || t.status === 'blocked');
    return active.slice(0, 5).map((task) => {
      const owner = agents.find((a) => a.id === task.assigneeAgentId);
      return { id: task.id, text: `${owner ? getAgentLabel(owner) : '未指派'} · ${task.title}` };
    });
  }, [tasks, agents]);

  const mapAgents = useMemo(() => {
    return roomOrder.flatMap((room) => {
      const slotAgents = grouped[room];
      const box = roomLayout[room];
      const cols = Math.max(2, Math.floor(box.w / 9));
      const usableWidth = Math.max(10, box.w - 8);
      const usableHeight = Math.max(8, box.h - 9);

      return slotAgents.map((agent, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = box.x + 4 + (col / Math.max(1, cols - 1)) * usableWidth;
        const y = box.y + 8 + (row % 3) * (usableHeight / 2.4);
        return { agent, room, x, y };
      });
    });
  }, [grouped]);

  const collaborationEdges = useMemo(() => {
    const hub = roomLayout['協作中樞'];
    const hubX = hub.x + hub.w / 2;
    const hubY = hub.y + hub.h / 2;

    const activeTaskOwners = new Set(
      tasks.filter((t) => t.status === 'in_progress' || t.status === 'blocked').map((t) => t.assigneeAgentId).filter(Boolean)
    );

    return mapAgents
      .filter((item) => activeTaskOwners.has(item.agent.id) && item.agent.status !== 'offline')
      .slice(0, 8)
      .map((item) => ({ fromX: item.x, fromY: item.y, toX: hubX, toY: hubY, id: item.agent.id }));
  }, [tasks, mapAgents]);

  return (
    <section className="space-y-4">
      <Card title="辦公室視圖">
        <p className="mb-3 text-sm text-slate-300">這裡會用視覺化方式呈現與列表頁相同的代理人狀態。點擊任何頭像可打開代理人詳細面板。</p>
        <div className="flex flex-wrap gap-2">
          {occupancy.map((item) => (
            <span key={item.room} className="rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1 text-xs text-slate-300">
              {item.room}: <span className="font-semibold text-cyan-300">{item.count}</span>
            </span>
          ))}
        </div>
      </Card>

      {loading && agents.length === 0 && <p className="text-sm text-slate-300">正在載入辦公室狀態…</p>}
      <DataHealthBanner error={error} notice={notice} connectionStatus={connectionStatus} connectionMessage={connectionMessage} />

      <Card title="辦公室地圖">
        <div className="mb-2 text-xs text-slate-400">提示：點擊任何頭像，會同步高亮代理人列表並打開控制抽屜。</div>
        {agents.length === 0 ? (
          <EmptyState
            title="目前尚無代理人資料"
            detail="請保持後端運行，等待第一份即時快照或本機備援資料。"
          />
        ) : (
        <div className="relative h-[430px] w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950 md:h-[560px]">
          {roomOrder.map((room) => {
            const box = roomLayout[room];
            return (
              <div
                key={room}
                className="absolute rounded-lg border border-slate-700 bg-slate-900/35 p-2"
                style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%` }}
              >
                <p className="text-xs font-medium text-slate-300">{room}</p>
              </div>
            );
          })}

          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {collaborationEdges.map((edge) => (
              <line
                key={edge.id}
                x1={edge.fromX}
                y1={edge.fromY}
                x2={edge.toX}
                y2={edge.toY}
                stroke="rgb(34 211 238 / 0.45)"
                strokeWidth="0.45"
                strokeDasharray="1.5 1"
                className="animate-collab-flow"
              />
            ))}
          </svg>

          {mapAgents.map(({ agent, room, x, y }) => {
            const currentTask = currentTaskByAgentId[agent.id];
            const selected = selectedAgentId === agent.id;

            return (
              <button
                key={agent.id}
                onClick={() => selectAgent(agent.id)}
                className={`absolute w-28 -translate-x-1/2 rounded-md border bg-slate-900/90 p-2 text-left shadow transition-all duration-700 ${
                  selected ? 'border-cyan-400 ring-1 ring-cyan-500/50' : 'border-slate-700 hover:border-cyan-600'
                }`}
                style={{ left: `${x}%`, top: `${y}%` }}
                title={`${getAgentLabel(agent)} · ${room}`}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className={`text-sm ${agent.status === 'busy' ? 'animate-agent-pulse' : ''}`}>{moodByStatus[agent.status]}</span>
                  <Badge value={agent.status} />
                </div>
                <p className="truncate text-xs font-medium text-slate-100">{getAgentLabel(agent)}</p>
                <p className="truncate text-[10px] text-slate-400">{currentTask?.title ?? '目前沒有進行中的任務'}</p>
              </button>
            );
          })}
        </div>
        )}
      </Card>

      <Card title="協作訊號">
        {collaborationSignals.length === 0 ? (
          <p className="text-sm text-slate-400">目前沒有明顯的協作活動。</p>
        ) : (
          <ul className="space-y-2">
            {collaborationSignals.map((signal) => (
              <li key={signal.id} className="rounded-md border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-slate-200">
                {signal.text}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {roomOrder.map((room) => (
          <Card key={room} title={room}>
            {grouped[room].length === 0 ? (
              <p className="text-sm text-slate-400">這個房間目前沒有代理人。</p>
            ) : (
              <ul className="space-y-2">
                {grouped[room].map((agent) => {
                  const currentTask = currentTaskByAgentId[agent.id];
                  const selected = selectedAgentId === agent.id;

                  return (
                    <li key={agent.id}>
                      <button
                        onClick={() => selectAgent(agent.id)}
                        className={`w-full rounded-lg border bg-slate-900/70 p-3 text-left transition ${
                          selected ? 'border-cyan-500 ring-1 ring-cyan-500/50' : 'border-slate-800 hover:border-cyan-600'
                        }`}
                        title={`${getAgentLabel(agent)} (${agent.status})`}
                      >
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
                            <span className={agent.status === 'busy' ? 'animate-agent-pulse' : ''}>{moodByStatus[agent.status]}</span>
                            <span>{getAgentLabel(agent)}</span>
                            {selected && <span className="text-[10px] tracking-wide text-cyan-300">已選取</span>}
                          </div>
                          <Badge value={agent.status} />
                        </div>
                        <p className="text-xs text-slate-300">{thoughtSummary(agent, currentTask?.title)}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        ))}
      </div>
    </section>
  );
}
