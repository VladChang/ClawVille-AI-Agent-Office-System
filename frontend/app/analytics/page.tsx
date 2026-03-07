'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge, Card } from '@/components/ui';
import { getDashboardDerivedMetrics } from '@/lib/analytics';
import { useDashboardStore } from '@/store/dashboardStore';

const playbackStepMs = 1200;

export default function AnalyticsPage() {
  const { agents, tasks, events, loading, error } = useDashboardStore((s) => ({
    agents: s.agents,
    tasks: s.tasks,
    events: s.events,
    loading: s.loading,
    error: s.error
  }));

  const [timelineIndex, setTimelineIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
    [events]
  );

  useEffect(() => {
    if (timelineIndex >= sortedEvents.length) {
      setTimelineIndex(Math.max(0, sortedEvents.length - 1));
    }
  }, [sortedEvents.length, timelineIndex]);

  useEffect(() => {
    if (!isPlaying || sortedEvents.length <= 1) return;

    const timer = setInterval(() => {
      setTimelineIndex((idx) => {
        if (idx >= sortedEvents.length - 1) {
          setIsPlaying(false);
          return idx;
        }
        return idx + 1;
      });
    }, playbackStepMs);

    return () => clearInterval(timer);
  }, [isPlaying, sortedEvents.length]);

  const activeEvent = sortedEvents[timelineIndex];

  const metrics = useMemo(() => {
    const doneTasks = tasks.filter((task) => task.status === 'done').length;
    const completionRate = tasks.length ? Math.round((doneTasks / tasks.length) * 100) : 0;

    const busyAgents = agents.filter((agent) => agent.status === 'busy').length;
    const utilization = agents.length ? Math.round((busyAgents / agents.length) * 100) : 0;

    const derived = getDashboardDerivedMetrics(agents, tasks, events);

    const mtbeMinutes =
      sortedEvents.length > 1
        ? Math.round(
            sortedEvents.slice(1).reduce((acc, event, index) => {
              const prev = new Date(sortedEvents[index].timestamp).getTime();
              const curr = new Date(event.timestamp).getTime();
              return acc + Math.max(0, curr - prev);
            }, 0) /
              (sortedEvents.length - 1) /
              60000
          )
        : 0;

    return [
      { label: 'Task Completion', value: `${completionRate}%`, sub: `${doneTasks}/${tasks.length} done` },
      { label: 'Agent Utilization', value: `${utilization}%`, sub: `${busyAgents}/${agents.length} busy` },
      {
        label: 'Busiest Agent',
        value: derived.busiestAgent?.name ?? 'N/A',
        sub: derived.busiestAgent ? `${derived.busiestAgent.activeTaskCount} active tasks` : 'No active tasks'
      },
      {
        label: 'Avg Wait Time',
        value: `${derived.averageWaitTime.valueMinutes}m`,
        sub: `${derived.averageWaitTime.taskCount} todo/blocked tasks`
      },
      {
        label: 'Error Rate',
        value: `${derived.errorRate.percentage}%`,
        sub: `${derived.errorRate.errorCount}/${derived.errorRate.totalCount} events`
      },
      { label: 'Mean Event Gap', value: `${mtbeMinutes}m`, sub: 'Average minutes between events' }
    ];
  }, [agents, tasks, events, sortedEvents]);

  const taskNodeMap = useMemo(() => {
    const map = new Map<string, string[]>();

    for (const task of tasks) {
      map.set(task.id, []);
    }

    const statusBuckets = ['todo', 'in_progress', 'blocked', 'done'] as const;
    for (const status of statusBuckets) {
      const inStatus = tasks
        .filter((task) => task.status === status)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      for (let i = 1; i < inStatus.length; i += 1) {
        map.get(inStatus[i - 1].id)?.push(inStatus[i].id);
      }
    }

    for (const agent of agents) {
      const assigned = tasks
        .filter((task) => task.assigneeAgentId === agent.id)
        .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());

      for (let i = 1; i < assigned.length; i += 1) {
        map.get(assigned[i - 1].id)?.push(assigned[i].id);
      }
    }

    return map;
  }, [tasks, agents]);

  const edgeList = useMemo(() => {
    const edges: Array<{ from: string; to: string }> = [];
    for (const [from, toList] of taskNodeMap) {
      for (const to of toList) {
        edges.push({ from, to });
      }
    }
    return edges.slice(0, 32);
  }, [taskNodeMap]);

  return (
    <section className="space-y-4">
      <Card title="Derived Metrics">
        {error && <p className="mb-3 rounded border border-rose-800 bg-rose-950/40 p-2 text-sm text-rose-200">{error}</p>}
        {loading ? (
          <p className="text-sm text-slate-400">Calculating analytics…</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <div key={metric.label} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">{metric.label}</p>
                <p className="mt-1 text-2xl font-semibold text-cyan-300">{metric.value}</p>
                <p className="mt-1 text-xs text-slate-400">{metric.sub}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Task Dependency Graph (Lightweight)">
          <p className="mb-3 text-xs text-slate-400">Simple node and edge view inferred from task status flow and shared assignees.</p>
          {tasks.length === 0 ? (
            <p className="text-sm text-slate-400">No task data available yet.</p>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-300">Nodes</p>
                <div className="max-h-48 space-y-1 overflow-auto pr-1 text-xs">
                  {tasks.map((task) => (
                    <div key={task.id} className="rounded border border-slate-800 bg-slate-900/50 px-2 py-1 text-slate-300">
                      <span className="font-medium text-slate-200">{task.id}</span> · {task.title}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-300">Edges ({edgeList.length})</p>
                {edgeList.length === 0 ? (
                  <p className="text-xs text-slate-400">No inferred relationships yet.</p>
                ) : (
                  <div className="max-h-48 space-y-1 overflow-auto pr-1 text-xs">
                    {edgeList.map((edge, index) => (
                      <div key={`${edge.from}-${edge.to}-${index}`} className="rounded border border-slate-800 bg-slate-900/50 px-2 py-1 text-slate-300">
                        {edge.from} → {edge.to}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>

        <Card title="Incident Playback">
          <p className="mb-3 text-xs text-slate-400">Step through the incident timeline to inspect state changes over time.</p>
          {sortedEvents.length === 0 ? (
            <p className="text-sm text-slate-400">No events available.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setIsPlaying(false);
                    setTimelineIndex((idx) => Math.max(0, idx - 1));
                  }}
                  className="rounded border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200 hover:border-cyan-500"
                >
                  ◀ Prev
                </button>
                <button
                  onClick={() => setIsPlaying((playing) => !playing)}
                  className="rounded border border-cyan-600 bg-cyan-500/20 px-3 py-1 text-xs text-cyan-200 hover:bg-cyan-500/30"
                >
                  {isPlaying ? 'Pause' : 'Play'}
                </button>
                <button
                  onClick={() => {
                    setIsPlaying(false);
                    setTimelineIndex((idx) => Math.min(sortedEvents.length - 1, idx + 1));
                  }}
                  className="rounded border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200 hover:border-cyan-500"
                >
                  Next ▶
                </button>
                <button
                  onClick={() => {
                    setIsPlaying(false);
                    setTimelineIndex(0);
                  }}
                  className="rounded border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200 hover:border-cyan-500"
                >
                  Reset
                </button>
              </div>

              <div className="h-2 overflow-hidden rounded bg-slate-800">
                <div
                  className="h-full bg-cyan-500 transition-all"
                  style={{ width: `${sortedEvents.length > 1 ? (timelineIndex / (sortedEvents.length - 1)) * 100 : 100}%` }}
                />
              </div>

              {activeEvent ? (
                <article className="rounded border border-slate-800 bg-slate-900/50 p-3 text-sm">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Badge value={activeEvent.level} />
                    <span className="text-xs text-slate-400">
                      {timelineIndex + 1}/{sortedEvents.length}
                    </span>
                  </div>
                  <p className="text-slate-200">{activeEvent.message}</p>
                  <p className="mt-1 text-xs text-slate-500">{new Date(activeEvent.timestamp).toLocaleString()} · {activeEvent.type}</p>
                </article>
              ) : null}
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}
