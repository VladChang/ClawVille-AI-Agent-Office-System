'use client';

import { useMemo } from 'react';
import { Card, Badge } from '@/components/ui';
import { useDashboardStore } from '@/store/dashboardStore';
import type { Agent, AgentStatus } from '@/types/models';

const roomOrder = [
  'Planning Room',
  'Research Library',
  'Memory Archive',
  'Tool Workshop',
  'Review Room',
  'Collaboration Hub',
  'Break Area',
  'Incident Desk'
] as const;

type Room = (typeof roomOrder)[number];

const moodByStatus: Record<AgentStatus, string> = {
  busy: '🤔',
  idle: '😌',
  offline: '😴'
};

const roomLayout: Record<Room, { x: number; y: number; w: number; h: number }> = {
  'Planning Room': { x: 3, y: 4, w: 27, h: 20 },
  'Research Library': { x: 35, y: 4, w: 27, h: 20 },
  'Memory Archive': { x: 67, y: 4, w: 30, h: 20 },
  'Tool Workshop': { x: 3, y: 30, w: 30, h: 20 },
  'Review Room': { x: 38, y: 30, w: 24, h: 20 },
  'Collaboration Hub': { x: 67, y: 30, w: 30, h: 20 },
  'Break Area': { x: 3, y: 56, w: 44, h: 20 },
  'Incident Desk': { x: 52, y: 56, w: 45, h: 20 }
};

function roomForAgent(agent: Agent): Room {
  const role = agent.role.toLowerCase();

  if (agent.status === 'offline') return 'Incident Desk';
  if (agent.status === 'idle') return 'Break Area';
  if (role.includes('plan') || role.includes('coord')) return 'Planning Room';
  if (role.includes('research') || role.includes('browser') || role.includes('analyst')) return 'Research Library';
  if (role.includes('memory') || role.includes('knowledge')) return 'Memory Archive';
  if (role.includes('tool') || role.includes('builder') || role.includes('execute')) return 'Tool Workshop';
  if (role.includes('review') || role.includes('qa') || role.includes('critic')) return 'Review Room';
  return 'Collaboration Hub';
}

function thoughtSummary(agent: Agent, taskTitle?: string): string {
  if (agent.status === 'offline') return 'Handling incident recovery checks.';
  if (agent.status === 'idle') return 'Idle until a new task arrives.';
  if (taskTitle) return `Working on: ${taskTitle}`;
  return 'Syncing with team updates.';
}

export default function OfficePage() {
  const { agents, tasks, loading, error, selectAgent, selectedAgentId } = useDashboardStore((s) => ({
    agents: s.agents,
    tasks: s.tasks,
    loading: s.loading,
    error: s.error,
    selectAgent: s.selectAgent,
    selectedAgentId: s.selectedAgentId
  }));

  const grouped = useMemo(() => {
    const map: Record<Room, Agent[]> = {
      'Planning Room': [],
      'Research Library': [],
      'Memory Archive': [],
      'Tool Workshop': [],
      'Review Room': [],
      'Collaboration Hub': [],
      'Break Area': [],
      'Incident Desk': []
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
      const owner = agents.find((a) => a.id === task.assigneeAgentId)?.name ?? 'Unassigned';
      return { id: task.id, text: `${owner} · ${task.title}` };
    });
  }, [tasks, agents]);

  const mapAgents = useMemo(() => {
    return roomOrder.flatMap((room) => {
      const slotAgents = grouped[room];
      return slotAgents.map((agent, index) => {
        const box = roomLayout[room];
        const col = index % 3;
        const row = Math.floor(index / 3);
        const x = box.x + 3 + col * 8.5;
        const y = box.y + 7 + row * 7;
        return { agent, room, x, y };
      });
    });
  }, [grouped]);

  return (
    <section className="space-y-4">
      <Card title="Office View">
        <p className="mb-3 text-sm text-slate-300">Live visual map of the same agent state shown in list pages. Click any avatar to open agent detail.</p>
        <div className="flex flex-wrap gap-2">
          {occupancy.map((item) => (
            <span key={item.room} className="rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1 text-xs text-slate-300">
              {item.room}: <span className="font-semibold text-cyan-300">{item.count}</span>
            </span>
          ))}
        </div>
      </Card>

      {loading && <p className="text-sm text-slate-300">Loading office state...</p>}
      {error && <p className="rounded border border-rose-500/30 bg-rose-500/10 p-2 text-sm text-rose-200">{error}</p>}

      <Card title="Office Map">
        <div className="relative h-[560px] w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
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

          {mapAgents.map(({ agent, room, x, y }) => {
            const currentTask = tasks.find((t) => t.assigneeAgentId === agent.id && t.status !== 'done');
            const selected = selectedAgentId === agent.id;

            return (
              <button
                key={agent.id}
                onClick={() => selectAgent(agent.id)}
                className={`absolute w-28 -translate-x-1/2 rounded-md border bg-slate-900/90 p-2 text-left shadow transition-all duration-700 ${
                  selected ? 'border-cyan-400 ring-1 ring-cyan-500/50' : 'border-slate-700 hover:border-cyan-600'
                }`}
                style={{ left: `${x}%`, top: `${y}%` }}
                title={`${agent.name} · ${room}`}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className={`text-sm ${agent.status === 'busy' ? 'animate-agent-pulse' : ''}`}>{moodByStatus[agent.status]}</span>
                  <Badge value={agent.status} />
                </div>
                <p className="truncate text-xs font-medium text-slate-100">{agent.name}</p>
                <p className="truncate text-[10px] text-slate-400">{currentTask?.title ?? 'No active task'}</p>
              </button>
            );
          })}
        </div>
      </Card>

      <Card title="Collaboration Signals">
        {collaborationSignals.length === 0 ? (
          <p className="text-sm text-slate-400">No active collaborations right now.</p>
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
              <p className="text-sm text-slate-400">No agents in this room.</p>
            ) : (
              <ul className="space-y-2">
                {grouped[room].map((agent) => {
                  const currentTask = tasks.find((t) => t.assigneeAgentId === agent.id && t.status !== 'done');
                  const selected = selectedAgentId === agent.id;

                  return (
                    <li key={agent.id}>
                      <button
                        onClick={() => selectAgent(agent.id)}
                        className={`w-full rounded-lg border bg-slate-900/70 p-3 text-left transition ${
                          selected ? 'border-cyan-500 ring-1 ring-cyan-500/50' : 'border-slate-800 hover:border-cyan-600'
                        }`}
                        title={`${agent.name} (${agent.status})`}
                      >
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
                            <span className={agent.status === 'busy' ? 'animate-agent-pulse' : ''}>{moodByStatus[agent.status]}</span>
                            <span>{agent.name}</span>
                            {selected && <span className="text-[10px] uppercase tracking-wide text-cyan-300">selected</span>}
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
