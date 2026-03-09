'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge, Card } from '@/components/ui';
import { DataHealthBanner, EmptyState, SkeletonLines } from '@/components/dataState';
import { getDashboardDerivedMetrics } from '@/lib/analytics';
import { getAgentLabel, getEventTypeLabel } from '@/lib/presentation';
import { getEventLevelWeight } from '@/lib/schema';
import { useDashboardStore } from '@/store/dashboardStore';
import type { EventLevel } from '@/types/models';

const playbackStepMs = 1200;

type TimeRangeFilter = '1h' | '6h' | '24h' | 'all';
type LevelFilter = 'all' | EventLevel;

type MetricTone = 'neutral' | 'good' | 'warn' | 'danger';

interface MetricCard {
  label: string;
  value: string;
  sub: string;
  tone: MetricTone;
  priority: number;
}

const timeRangeOptions: Array<{ value: TimeRangeFilter; label: string }> = [
  { value: '1h', label: '最近 1 小時' },
  { value: '6h', label: '最近 6 小時' },
  { value: '24h', label: '最近 24 小時' },
  { value: 'all', label: '全部時間' }
];

const speedOptions = [0.5, 1, 1.5, 2, 3, 4];

function getRangeDurationMs(timeRange: TimeRangeFilter): number | null {
  if (timeRange === 'all') return null;
  return (
    {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000
    }[timeRange] ?? null
  );
}

function metricDeltaLabel(current: number, previous: number, suffix = ''): string {
  if (current === previous) return `持平（${current}${suffix}）`;
  const diff = Math.abs(current - previous);
  const direction = current > previous ? '上升' : '下降';
  return `${direction} ${diff}${suffix}，相較前一個觀測窗`;
}

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
    const durationMs = getRangeDurationMs(timeRange);
    const rangeStart = durationMs === null ? Number.NEGATIVE_INFINITY : now - durationMs;

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

  const windowCompare = useMemo(() => {
    const durationMs = getRangeDurationMs(timeRange);
    if (durationMs === null) {
      return { previousEvents: [] as typeof filteredEvents, previousTasks: [] as typeof tasks };
    }

    const now = Date.now();
    const currentStart = now - durationMs;
    const previousStart = currentStart - durationMs;

    const previousEvents = sortedEvents.filter((event) => {
      const ts = new Date(event.timestamp).getTime();
      return ts >= previousStart && ts < currentStart && (levelFilter === 'all' || event.level === levelFilter);
    });

    const previousTasks = tasks.filter((task) => {
      const ts = new Date(task.updatedAt).getTime();
      return ts >= previousStart && ts < currentStart;
    });

    return { previousEvents, previousTasks };
  }, [timeRange, sortedEvents, levelFilter, tasks]);

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

    const metricCards: MetricCard[] = [
      {
        label: '錯誤率',
        value: `${derived.errorRate.percentage}%`,
        sub: metricDeltaLabel(
          derived.errorRate.errorCount,
          windowCompare.previousEvents.filter((event) => event.level === 'error').length
        ),
        tone: derived.errorRate.percentage >= 20 ? 'danger' : derived.errorRate.percentage >= 8 ? 'warn' : 'good',
        priority: 1
      },
      {
        label: '平均等待時間',
        value: `${derived.averageWaitTime.valueMinutes} 分`,
        sub: `${derived.averageWaitTime.taskCount} 個待處理 / 阻塞任務`,
        tone: derived.averageWaitTime.valueMinutes >= 45 ? 'warn' : 'neutral',
        priority: 2
      },
      {
        label: '任務完成率',
        value: `${completionRate}%`,
        sub: metricDeltaLabel(
          completionRate,
          windowCompare.previousTasks.length
            ? Math.round((windowCompare.previousTasks.filter((task) => task.status === 'done').length / windowCompare.previousTasks.length) * 100)
            : completionRate,
          '%'
        ),
        tone: completionRate >= 80 ? 'good' : completionRate >= 50 ? 'neutral' : 'warn',
        priority: 3
      },
      {
        label: 'Agent 利用率',
        value: `${utilization}%`,
        sub: metricDeltaLabel(
          utilization,
          agents.length
            ? Math.round(
                (new Set(
                  windowCompare.previousTasks
                    .filter((task) => task.status === 'in_progress' || task.status === 'blocked')
                    .map((task) => task.assigneeAgentId)
                    .filter((id): id is string => Boolean(id))
                ).size /
                  agents.length) *
                  100
              )
            : 0,
          '%'
        ),
        tone: utilization >= 85 ? 'warn' : utilization >= 40 ? 'good' : 'neutral',
        priority: 4
      },
      {
        label: '最忙碌 Agent',
        value: derived.busiestAgent?.name ?? '暫無',
        sub: derived.busiestAgent ? `${derived.busiestAgent.activeTaskCount} 個進行中任務` : '目前沒有進行中任務',
        tone: 'neutral',
        priority: 5
      },
      {
        label: '平均事件間隔',
        value: `${mtbeMinutes} 分`,
        sub: '事件之間的平均分鐘數',
        tone: 'neutral',
        priority: 6
      }
    ];

    return metricCards.sort((a, b) => a.priority - b.priority);

  }, [agents, tasks, events, sortedEvents, windowCompare]);

  const collaborationHotspots = useMemo(() => {
    const mentionsByAgent = new Map<string, number>();
    const pairWeight = new Map<string, number>();

    const lowerAgentNames = agents.map((agent) => ({
      id: agent.id,
      names: [agent.name, agent.displayName ?? ''].map((name) => name.toLowerCase()).filter((name) => name.length > 0)
    }));

    for (const event of filteredEvents) {
      const message = `${event.type} ${event.message}`.toLowerCase();
      const mentioned = lowerAgentNames.filter((agent) => agent.names.some((name) => message.includes(name))).map((agent) => agent.id);

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
        const leftAgent = agents.find((agent) => agent.id === leftId);
        const rightAgent = agents.find((agent) => agent.id === rightId);
        const left = leftAgent ? getAgentLabel(leftAgent) : leftId;
        const right = rightAgent ? getAgentLabel(rightAgent) : rightId;
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
          name: getAgentLabel(agent),
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

    const lowerAgentNames = agents.map((agent) => ({
      id: agent.id,
      names: [agent.name, agent.displayName ?? ''].map((name) => name.toLowerCase()).filter((name) => name.length > 0)
    }));
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
      const mentioned = lowerAgentNames.filter((agent) => agent.names.some((name) => text.includes(name)));

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
        const leaderAgent = leader ? agents.find((agent) => agent.id === leader[0]) : undefined;
        const leaderName = leaderAgent ? getAgentLabel(leaderAgent) : leader ? leader[0] : '整體';
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
    const lowerAgentNames = agents.map((agent) => ({
      id: agent.id,
      names: [agent.name, agent.displayName ?? ''].map((name) => name.toLowerCase()).filter((name) => name.length > 0)
    }));
    const mentionedAgents = new Set<string>();

    for (const event of windowEvents) {
      levelCounts[event.level] += 1;
      typeCounts.set(event.type, (typeCounts.get(event.type) ?? 0) + 1);

      const text = `${event.type} ${event.message}`.toLowerCase();
      lowerAgentNames.forEach((agent) => {
        if (agent.names.some((name) => text.includes(name))) {
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
      topType: topType ? `${getEventTypeLabel(topType[0])} (${topType[1]})` : '暫無',
      windowStart: new Date(first.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      windowEnd: new Date(last.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  }, [activeEvent, agents, filteredEvents, timelineIndex]);

  const hasData = events.length > 0 || tasks.length > 0 || agents.length > 0;

  return (
    <section className="space-y-4">
      <Card title="衍生指標">
        <DataHealthBanner error={error} connectionStatus={connectionStatus} connectionMessage={connectionMessage} />
        {loading && !hasData ? (
          <SkeletonLines rows={6} />
        ) : !hasData ? (
          <EmptyState title="目前尚無分析資料" detail="等待任務 / 事件資料以計算衍生指標。" />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => {
              const toneClass =
                metric.tone === 'danger'
                  ? 'border-rose-800/80 bg-rose-950/20'
                  : metric.tone === 'warn'
                    ? 'border-amber-700/70 bg-amber-950/10'
                    : metric.tone === 'good'
                      ? 'border-emerald-700/60 bg-emerald-950/10'
                      : 'border-slate-800 bg-slate-900/60';
              const valueClass =
                metric.tone === 'danger'
                  ? 'text-rose-300'
                  : metric.tone === 'warn'
                    ? 'text-amber-300'
                    : metric.tone === 'good'
                      ? 'text-emerald-300'
                      : 'text-cyan-300';

              return (
                <div key={metric.label} className={`rounded-lg border p-3 ${toneClass}`}>
                  <p className="text-xs uppercase tracking-wide text-slate-400">{metric.label}</p>
                  <p className={`mt-1 text-2xl font-semibold ${valueClass}`}>{metric.value}</p>
                  <p className="mt-1 text-xs text-slate-400">{metric.sub}</p>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="協作熱點">
          <p className="mb-3 text-xs text-slate-400">這裡綜合了任務重疊與事件訊息中的共同提及訊號。</p>
          {collaborationHotspots.hotspots.length === 0 ? (
            <p className="text-sm text-slate-400">在目前的事件範圍內，尚未偵測到明顯協作熱點。</p>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                {collaborationHotspots.hotspots.map((spot) => (
                  <div key={spot.id} className="rounded border border-slate-800 bg-slate-900/50 p-2 text-xs text-slate-300">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-100">{spot.name}</span>
                      <span className="text-cyan-300">分數 {spot.total}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded bg-slate-800">
                      <div className="h-full bg-cyan-500" style={{ width: `${Math.min(100, spot.total * 10)}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">
                      活躍負載 {spot.activeLoad} · 事件提及 {spot.incidentLoad} · 配對連結 {spot.pairLoad}
                    </p>
                  </div>
                ))}
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold text-slate-300">主要協作連結</p>
                {collaborationHotspots.pairList.length === 0 ? (
                  <p className="text-xs text-slate-400">目前尚未偵測到重複的雙人協作互動。</p>
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
                <p className="mb-2 text-xs font-semibold text-slate-300">熱點趨勢（時間分桶）</p>
                {hotspotTrend.buckets.length === 0 ? (
                  <p className="text-xs text-slate-400">目前事件資料不足，還看不出趨勢。</p>
                ) : (
                  <div className="space-y-1">
                    {hotspotTrend.buckets.map((bucket) => (
                      <div key={bucket.key} className="rounded border border-slate-800 bg-slate-900/50 px-2 py-1">
                        <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
                          <span>{bucket.label}</span>
                          <span>
                            主導者 {bucket.leaderName} {bucket.leaderScore > 0 ? `(${bucket.leaderScore})` : ''}
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

        <Card title="事件回放">
          <p className="mb-3 text-xs text-slate-400">用時間、等級與速度控制逐步重播事件時間軸。</p>
          {sortedEvents.length === 0 ? (
            <p className="text-sm text-slate-400">目前沒有事件資料。</p>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="space-y-1 text-xs text-slate-300">
                  <span className="text-slate-400">時間範圍</span>
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
                  <span className="text-slate-400">等級</span>
                  <select
                    value={levelFilter}
                    onChange={(e) => {
                      setIsPlaying(false);
                      setTimelineIndex(0);
                      setLevelFilter(e.target.value as LevelFilter);
                    }}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="all">全部等級</option>
                    <option value="info">資訊</option>
                    <option value="warning">警告</option>
                    <option value="error">錯誤</option>
                  </select>
                </label>

                <label className="space-y-1 text-xs text-slate-300">
                  <span className="text-slate-400">播放速度</span>
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
                  ◀ 上一筆
                </button>
                <button
                  onClick={() => setIsPlaying((playing) => !playing)}
                  className="rounded border border-cyan-600 bg-cyan-500/20 px-3 py-1 text-xs text-cyan-200 hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={filteredEvents.length <= 1}
                >
                  {isPlaying ? '暫停' : '播放'}
                </button>
                <button
                  onClick={() => {
                    setIsPlaying(false);
                    setTimelineIndex((idx) => Math.min(filteredEvents.length - 1, idx + 1));
                  }}
                  className="rounded border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200 hover:border-cyan-500"
                  disabled={filteredEvents.length === 0}
                >
                  下一筆 ▶
                </button>
                <button
                  onClick={() => {
                    setIsPlaying(false);
                    setTimelineIndex(0);
                  }}
                  className="rounded border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200 hover:border-cyan-500"
                  disabled={filteredEvents.length === 0}
                >
                  重設
                </button>
                <button
                  onClick={() => {
                    const idx = filteredEvents.findIndex((event) => event.level === 'warning' || event.level === 'error');
                    if (idx >= 0) {
                      setIsPlaying(false);
                      setTimelineIndex(idx);
                    }
                  }}
                  className="rounded border border-amber-700 bg-amber-500/10 px-3 py-1 text-xs text-amber-200 hover:bg-amber-500/20"
                  disabled={!filteredEvents.some((event) => event.level === 'warning' || event.level === 'error')}
                >
                  跳到第一則警示
                </button>
                <button
                  onClick={() => {
                    const idx = [...filteredEvents]
                      .map((event, index) => ({ event, index }))
                      .reverse()
                      .find((entry) => entry.event.level === 'error')?.index;
                    if (typeof idx === 'number') {
                      setIsPlaying(false);
                      setTimelineIndex(idx);
                    }
                  }}
                  className="rounded border border-rose-700 bg-rose-500/10 px-3 py-1 text-xs text-rose-200 hover:bg-rose-500/20"
                  disabled={!filteredEvents.some((event) => event.level === 'error')}
                >
                  跳到最後一則錯誤
                </button>
                <span className="text-xs text-slate-400">目前範圍內共有 {filteredEvents.length} 筆事件</span>
              </div>

              <div className="h-2 overflow-hidden rounded bg-slate-800">
                <div
                  className="h-full bg-cyan-500 transition-all"
                  style={{ width: `${filteredEvents.length > 1 ? (timelineIndex / (filteredEvents.length - 1)) * 100 : filteredEvents.length === 1 ? 100 : 0}%` }}
                />
              </div>

              {playbackSnapshot && (
                <div className="rounded border border-slate-800 bg-slate-900/50 p-2">
                  <p className="mb-2 text-xs font-semibold text-slate-300">範圍快照</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="rounded border border-slate-800 bg-slate-950/40 p-2 text-xs text-slate-300">
                      <p className="text-slate-400">時間窗</p>
                      <p className="mt-1 font-medium text-cyan-200">
                        {playbackSnapshot.windowStart} → {playbackSnapshot.windowEnd}
                      </p>
                      <p className="text-[11px] text-slate-500">已經過 {playbackSnapshot.elapsedMinutes} 分鐘</p>
                    </div>
                    <div className="rounded border border-slate-800 bg-slate-950/40 p-2 text-xs text-slate-300">
                      <p className="text-slate-400">事件 / Agents</p>
                      <p className="mt-1 font-medium text-cyan-200">
                        {playbackSnapshot.totalEvents} / {playbackSnapshot.uniqueAgentsInvolved}
                      </p>
                      <p className="text-[11px] text-slate-500">已播放範圍內的事件數 / 被提及的唯一 Agents</p>
                    </div>
                    <div className="rounded border border-slate-800 bg-slate-950/40 p-2 text-xs text-slate-300">
                      <p className="text-slate-400">主要事件類型</p>
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
                    {new Date(activeEvent.timestamp).toLocaleString()} · {getEventTypeLabel(activeEvent.type)}
                  </p>
                </article>
              ) : (
                <p className="text-sm text-slate-400">目前沒有符合篩選條件的事件。</p>
              )}
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}
