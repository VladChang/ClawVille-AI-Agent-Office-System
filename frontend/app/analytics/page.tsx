'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge, Card } from '@/components/ui';
import { DataHealthBanner, EmptyState } from '@/components/dataState';
import { getDashboardDerivedMetrics } from '@/lib/analytics';
import { getEventLevelWeight } from '@/lib/schema';
import { useDashboardStore } from '@/store/dashboardStore';
import type { EventLevel } from '@/types/models';

const playbackStepMs = 1200;

type TimeRangeFilter = '1h' | '6h' | '24h' | 'all';
type LevelFilter = 'all' | EventLevel;

const timeRangeOptions: Array<{ value: TimeRangeFilter; label: string }> = [
  { value: '1h', label: 'Last 1h' },
  { value: '6h', label: 'Last 6h' },
  { value: '24h', label: 'Last 24h' },
  { value: 'all', label: 'All time' }
];

const speedOptions = [0.5, 1, 1.5, 2, 3, 4];

export default function AnalyticsPage() {
  const { agents, tasks, events, loading, error, connectionStatus, connectionMessage } = useDashboardStore((s) => ({
    agents: s.agents,
    tasks: s.tasks,
    events: s.events,
    loading: s.loading,
    error: s.error,
    connectionStatus: s.connectionStatus,
    connectionMessage: s.connectionMessage
  }));

  const [timelineIndex, setTimelineIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>('24h');
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
    [events]
  );

  const filteredEvents = useMemo(() => {
    const now = Date.now();
    const rangeStart =
      timeRange === 'all'
        ? Number.NEGATIVE_INFINITY
        : now -
          {
            '1h': 60 * 60 * 1000,
            '6h': 6 * 60 * 60 * 1000,
            '24h': 24 * 60 * 60 * 1000,
            all: Number.MAX_SAFE_INTEGER
          }[timeRange];

    return sortedEvents.filter((event) => {
      const ts = new Date(event.timestamp).getTime();
      const withinRange = ts >= rangeStart;
      const levelMatch = levelFilter === 'all' ? true : event.level === levelFilter;
      return withinRange && levelMatch;
    });
  }, [sortedEvents, timeRange, levelFilter]);

  useEffect(() => {
    if (timelineIndex >= filteredEvents.length) {
      setTimelineIndex(Math.max(0, filteredEvents.length - 1));
    }
  }, [filteredEvents.length, timelineIndex]);

  useEffect(() => {
    if (!isPlaying || filteredEvents.length <= 1) return;

    const timer = setInterval(() => {
      setTimelineIndex((idx) => {
        if (idx >= filteredEvents.length - 1) {
          setIsPlaying(false);
          return idx;
        }
        return idx + 1;
      });
    }, Math.max(250, Math.round(playbackStepMs / playbackSpeed)));

    return () => clearInterval(timer);
  }, [isPlaying, filteredEvents.length, playbackSpeed]);

  const activeEvent = filteredEvents[timelineIndex];

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

  const collaborationHotspots = useMemo(() => {
    const mentionsByAgent = new Map<string, number>();
    const pairWeight = new Map<string, number>();

    const lowerAgentNames = agents.map((agent) => ({ id: agent.id, name: agent.name.toLowerCase() }));

    for (const event of filteredEvents) {
      const message = `${event.type} ${event.message}`.toLowerCase();
      const mentioned = lowerAgentNames.filter((agent) => message.includes(agent.name)).map((agent) => agent.id);

      for (const id of mentioned) {
        mentionsByAgent.set(id, (mentionsByAgent.get(id) ?? 0) + 1);
      }

      for (let i = 0; i < mentioned.length; i += 1) {
        for (let j = i + 1; j < mentioned.length; j += 1) {
          const key = [mentioned[i], mentioned[j]].sort().join('::');
          pairWeight.set(key, (pairWeight.get(key) ?? 0) + 1);
        }
      }
    }

    const taskPairWeight = new Map<string, number>();
    const activeByStatus = ['in_progress', 'blocked'] as const;

    for (const status of activeByStatus) {
      const bucket = tasks
        .filter((task) => task.status === status && task.assigneeAgentId)
        .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());

      for (let i = 1; i < bucket.length; i += 1) {
        const prev = bucket[i - 1].assigneeAgentId;
        const curr = bucket[i].assigneeAgentId;
        if (!prev || !curr || prev === curr) continue;
        const key = [prev, curr].sort().join('::');
        taskPairWeight.set(key, (taskPairWeight.get(key) ?? 0) + 1);
      }
    }

    const topPairs = [...pairWeight.entries(), ...taskPairWeight.entries()]
      .reduce((acc, [key, score]) => {
        acc.set(key, (acc.get(key) ?? 0) + score);
        return acc;
      }, new Map<string, number>())
      .entries();

    const pairList = [...topPairs]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([key, score]) => {
        const [leftId, rightId] = key.split('::');
        const left = agents.find((agent) => agent.id === leftId)?.name ?? leftId;
        const right = agents.find((agent) => agent.id === rightId)?.name ?? rightId;
        return { id: key, left, right, score };
      });

    const hotspots = agents
      .map((agent) => {
        const activeLoad = tasks.filter(
          (task) => task.assigneeAgentId === agent.id && (task.status === 'in_progress' || task.status === 'blocked')
        ).length;

        const incidentLoad = mentionsByAgent.get(agent.id) ?? 0;
        const pairLoad = pairList.filter((pair) => pair.id.includes(agent.id)).reduce((acc, pair) => acc + pair.score, 0);

        return {
          id: agent.id,
          name: agent.name,
          activeLoad,
          incidentLoad,
          pairLoad,
          total: activeLoad * 2 + incidentLoad + pairLoad
        };
      })
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);

    return { hotspots, pairList };
  }, [agents, tasks, filteredEvents]);

  const hotspotTrend = useMemo(() => {
    if (filteredEvents.length === 0) {
      return { buckets: [], maxScore: 0 };
    }

    const lowerAgentNames = agents.map((agent) => ({ id: agent.id, name: agent.name.toLowerCase() }));
    const firstTs = new Date(filteredEvents[0].timestamp).getTime();
    const lastTs = new Date(filteredEvents[filteredEvents.length - 1].timestamp).getTime();
    const spanMs = Math.max(1, lastTs - firstTs);
    const bucketSizeMs =
      timeRange === '1h'
        ? 5 * 60 * 1000
        : timeRange === '6h'
          ? 15 * 60 * 1000
          : timeRange === '24h'
            ? 60 * 60 * 1000
            : Math.max(30 * 60 * 1000, Math.ceil(spanMs / 12));

    const bucketMap = new Map<number, { start: number; end: number; scoreByAgent: Map<string, number>; total: number }>();

    for (const event of filteredEvents) {
      const ts = new Date(event.timestamp).getTime();
      const slot = Math.floor((ts - firstTs) / bucketSizeMs);
      const bucketStart = firstTs + slot * bucketSizeMs;
      const existing =
        bucketMap.get(slot) ??
        { start: bucketStart, end: bucketStart + bucketSizeMs, scoreByAgent: new Map<string, number>(), total: 0 };

      const text = `${event.type} ${event.message}`.toLowerCase();
      const weight = getEventLevelWeight(event.level);
      const mentioned = lowerAgentNames.filter((agent) => text.includes(agent.name));

      if (mentioned.length > 0) {
        for (const agent of mentioned) {
          existing.scoreByAgent.set(agent.id, (existing.scoreByAgent.get(agent.id) ?? 0) + weight);
        }
      } else {
        existing.total += weight;
      }

      existing.total += weight;
      bucketMap.set(slot, existing);
    }

    const buckets = [...bucketMap.values()]
      .sort((a, b) => a.start - b.start)
      .slice(-12)
      .map((bucket) => {
        const leader = [...bucket.scoreByAgent.entries()].sort((a, b) => b[1] - a[1])[0];
        const leaderName = leader ? agents.find((agent) => agent.id === leader[0])?.name ?? 'Unknown' : 'General';
        return {
          key: `${bucket.start}`,
          label: new Date(bucket.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          total: bucket.total,
          leaderName,
          leaderScore: leader?.[1] ?? 0
        };
      });

    return {
      buckets,
      maxScore: buckets.reduce((max, item) => Math.max(max, item.total), 0)
    };
  }, [agents, filteredEvents, timeRange]);

  const playbackSnapshot = useMemo(() => {
    if (!activeEvent || filteredEvents.length === 0) {
      return null;
    }

    const windowEvents = filteredEvents.slice(0, timelineIndex + 1);
    const first = windowEvents[0];
    const last = windowEvents[windowEvents.length - 1];
    const firstTs = new Date(first.timestamp).getTime();
    const lastTs = new Date(last.timestamp).getTime();
    const elapsedMinutes = Math.max(0, Math.round((lastTs - firstTs) / 60000));

    const levelCounts: Record<EventLevel, number> = { info: 0, warning: 0, error: 0 };
    const typeCounts = new Map<string, number>();
    const lowerAgentNames = agents.map((agent) => ({ id: agent.id, name: agent.name.toLowerCase() }));
    const mentionedAgents = new Set<string>();

    for (const event of windowEvents) {
      levelCounts[event.level] += 1;
      typeCounts.set(event.type, (typeCounts.get(event.type) ?? 0) + 1);

      const text = `${event.type} ${event.message}`.toLowerCase();
      lowerAgentNames.forEach((agent) => {
        if (text.includes(agent.name)) {
          mentionedAgents.add(agent.id);
        }
      });
    }

    const topType = [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0];

    return {
      totalEvents: windowEvents.length,
      elapsedMinutes,
      levelCounts,
      uniqueAgentsInvolved: mentionedAgents.size,
      topType: topType ? `${topType[0]} (${topType[1]})` : 'N/A',
      windowStart: new Date(first.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      windowEnd: new Date(last.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  }, [activeEvent, agents, filteredEvents, timelineIndex]);

  const hasData = events.length > 0 || tasks.length > 0 || agents.length > 0;

  return (
    <section className="space-y-4">
      <Card title="Derived Metrics">
        <DataHealthBanner error={error} connectionStatus={connectionStatus} connectionMessage={connectionMessage} />
        {loading && !hasData ? (
          <p className="text-sm text-slate-400">Calculating analytics…</p>
        ) : !hasData ? (
          <EmptyState title="No analytics data yet" detail="Waiting for tasks/events to compute derived metrics." />
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
        <Card title="Collaboration Hotspots">
          <p className="mb-3 text-xs text-slate-400">Signals blend active task overlap and incident-thread co-mentions.</p>
          {collaborationHotspots.hotspots.length === 0 ? (
            <p className="text-sm text-slate-400">No strong collaboration hotspots in the selected event scope.</p>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                {collaborationHotspots.hotspots.map((spot) => (
                  <div key={spot.id} className="rounded border border-slate-800 bg-slate-900/50 p-2 text-xs text-slate-300">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-100">{spot.name}</span>
                      <span className="text-cyan-300">Score {spot.total}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded bg-slate-800">
                      <div className="h-full bg-cyan-500" style={{ width: `${Math.min(100, spot.total * 10)}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Active load {spot.activeLoad} · Incident mentions {spot.incidentLoad} · Pair links {spot.pairLoad}
                    </p>
                  </div>
                ))}
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold text-slate-300">Top Collaboration Links</p>
                {collaborationHotspots.pairList.length === 0 ? (
                  <p className="text-xs text-slate-400">No repeated pair interactions detected yet.</p>
                ) : (
                  <div className="max-h-44 space-y-1 overflow-auto pr-1 text-xs">
                    {collaborationHotspots.pairList.map((pair) => (
                      <div key={pair.id} className="rounded border border-slate-800 bg-slate-900/50 px-2 py-1 text-slate-300">
                        {pair.left} ↔ {pair.right} <span className="text-cyan-300">({pair.score})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold text-slate-300">Hotspot Trend (time buckets)</p>
                {hotspotTrend.buckets.length === 0 ? (
                  <p className="text-xs text-slate-400">Not enough event data for a trend yet.</p>
                ) : (
                  <div className="space-y-1">
                    {hotspotTrend.buckets.map((bucket) => (
                      <div key={bucket.key} className="rounded border border-slate-800 bg-slate-900/50 px-2 py-1">
                        <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
                          <span>{bucket.label}</span>
                          <span>
                            Lead {bucket.leaderName} {bucket.leaderScore > 0 ? `(${bucket.leaderScore})` : ''}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded bg-slate-800">
                          <div
                            className="h-full bg-cyan-500/80"
                            style={{
                              width: `${hotspotTrend.maxScore > 0 ? Math.max(4, (bucket.total / hotspotTrend.maxScore) * 100) : 0}%`
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>

        <Card title="Incident Playback">
          <p className="mb-3 text-xs text-slate-400">Step through incident timeline with time, level, and speed controls.</p>
          {sortedEvents.length === 0 ? (
            <p className="text-sm text-slate-400">No events available.</p>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="space-y-1 text-xs text-slate-300">
                  <span className="text-slate-400">Time Range</span>
                  <select
                    value={timeRange}
                    onChange={(e) => {
                      setIsPlaying(false);
                      setTimelineIndex(0);
                      setTimeRange(e.target.value as TimeRangeFilter);
                    }}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                  >
                    {timeRangeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-xs text-slate-300">
                  <span className="text-slate-400">Level</span>
                  <select
                    value={levelFilter}
                    onChange={(e) => {
                      setIsPlaying(false);
                      setTimelineIndex(0);
                      setLevelFilter(e.target.value as LevelFilter);
                    }}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="all">All levels</option>
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="error">Error</option>
                  </select>
                </label>

                <label className="space-y-1 text-xs text-slate-300">
                  <span className="text-slate-400">Playback Speed</span>
                  <select
                    value={playbackSpeed}
                    onChange={(e) => {
                      setIsPlaying(false);
                      setPlaybackSpeed(Number(e.target.value));
                    }}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                  >
                    {speedOptions.map((speed) => (
                      <option key={speed} value={speed}>
                        {speed}x
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    setIsPlaying(false);
                    setTimelineIndex((idx) => Math.max(0, idx - 1));
                  }}
                  className="rounded border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200 hover:border-cyan-500"
                  disabled={filteredEvents.length === 0}
                >
                  ◀ Prev
                </button>
                <button
                  onClick={() => setIsPlaying((playing) => !playing)}
                  className="rounded border border-cyan-600 bg-cyan-500/20 px-3 py-1 text-xs text-cyan-200 hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={filteredEvents.length <= 1}
                >
                  {isPlaying ? 'Pause' : 'Play'}
                </button>
                <button
                  onClick={() => {
                    setIsPlaying(false);
                    setTimelineIndex((idx) => Math.min(filteredEvents.length - 1, idx + 1));
                  }}
                  className="rounded border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200 hover:border-cyan-500"
                  disabled={filteredEvents.length === 0}
                >
                  Next ▶
                </button>
                <button
                  onClick={() => {
                    setIsPlaying(false);
                    setTimelineIndex(0);
                  }}
                  className="rounded border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200 hover:border-cyan-500"
                  disabled={filteredEvents.length === 0}
                >
                  Reset
                </button>
                <span className="text-xs text-slate-400">{filteredEvents.length} events in scope</span>
              </div>

              <div className="h-2 overflow-hidden rounded bg-slate-800">
                <div
                  className="h-full bg-cyan-500 transition-all"
                  style={{ width: `${filteredEvents.length > 1 ? (timelineIndex / (filteredEvents.length - 1)) * 100 : filteredEvents.length === 1 ? 100 : 0}%` }}
                />
              </div>

              {playbackSnapshot && (
                <div className="rounded border border-slate-800 bg-slate-900/50 p-2">
                  <p className="mb-2 text-xs font-semibold text-slate-300">Range Snapshot</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="rounded border border-slate-800 bg-slate-950/40 p-2 text-xs text-slate-300">
                      <p className="text-slate-400">Window</p>
                      <p className="mt-1 font-medium text-cyan-200">
                        {playbackSnapshot.windowStart} → {playbackSnapshot.windowEnd}
                      </p>
                      <p className="text-[11px] text-slate-500">{playbackSnapshot.elapsedMinutes} min elapsed</p>
                    </div>
                    <div className="rounded border border-slate-800 bg-slate-950/40 p-2 text-xs text-slate-300">
                      <p className="text-slate-400">Events / Agents</p>
                      <p className="mt-1 font-medium text-cyan-200">
                        {playbackSnapshot.totalEvents} / {playbackSnapshot.uniqueAgentsInvolved}
                      </p>
                      <p className="text-[11px] text-slate-500">events in played range / unique agents mentioned</p>
                    </div>
                    <div className="rounded border border-slate-800 bg-slate-950/40 p-2 text-xs text-slate-300">
                      <p className="text-slate-400">Top Event Type</p>
                      <p className="mt-1 font-medium text-cyan-200">{playbackSnapshot.topType}</p>
                      <p className="text-[11px] text-slate-500">
                        I {playbackSnapshot.levelCounts.info} · W {playbackSnapshot.levelCounts.warning} · E {playbackSnapshot.levelCounts.error}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeEvent ? (
                <article className="rounded border border-slate-800 bg-slate-900/50 p-3 text-sm">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Badge value={activeEvent.level} />
                    <span className="text-xs text-slate-400">
                      {timelineIndex + 1}/{filteredEvents.length}
                    </span>
                  </div>
                  <p className="text-slate-200">{activeEvent.message}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(activeEvent.timestamp).toLocaleString()} · {activeEvent.type}
                  </p>
                </article>
              ) : (
                <p className="text-sm text-slate-400">No incidents match current filters.</p>
              )}
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}
