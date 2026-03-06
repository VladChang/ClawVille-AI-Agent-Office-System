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
  const { agents, tasks, loading, error, selectAgent } = useDashboardStore((s) => ({
    agents: s.agents,
    tasks: s.tasks,
    loading: s.loading,
    error: s.error,
    selectAgent: s.selectAgent
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

  return (
    <section className="space-y-4">
      <Card title="Office View">
        <p className="text-sm text-slate-300">Live visual map of the same agent state shown in list pages. Click any avatar to open agent detail.</p>
      </Card>

      {loading && <p className="text-sm text-slate-300">Loading office state...</p>}
      {error && <p className="rounded border border-rose-500/30 bg-rose-500/10 p-2 text-sm text-rose-200">{error}</p>}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {roomOrder.map((room) => (
          <Card key={room} title={room}>
            {grouped[room].length === 0 ? (
              <p className="text-sm text-slate-400">No agents in this room.</p>
            ) : (
              <ul className="space-y-2">
                {grouped[room].map((agent) => {
                  const currentTask = tasks.find((t) => t.assigneeAgentId === agent.id && t.status !== 'done');
                  return (
                    <li key={agent.id}>
                      <button
                        onClick={() => selectAgent(agent.id)}
                        className="w-full rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-left transition hover:border-cyan-600"
                        title={`${agent.name} (${agent.status})`}
                      >
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
                            <span>{moodByStatus[agent.status]}</span>
                            <span>{agent.name}</span>
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
