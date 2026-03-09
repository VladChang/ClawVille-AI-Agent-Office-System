'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Card } from '@/components/ui';
import { DataHealthBanner, EmptyState } from '@/components/dataState';
import { getAgentLabel, getAgentStatusLabel, getEventLevelLabel, workforceLabels } from '@/lib/presentation';
import { defaultOfficeMap, getOfficeZoneCenter } from '@/lib/officeMap';
import { createOfficeSimulation, getOfficeSceneZones, type OfficeActorState } from '@/lib/officeSimulation';
import { useDashboardStore } from '@/store/dashboardStore';

const stateMeta: Record<OfficeActorState, { label: string; icon: string; tone: string }> = {
  working: { label: '工作中', icon: '💼', tone: 'border-cyan-500/60 bg-cyan-500/10 text-cyan-100' },
  resting: { label: '休息中', icon: '☕', tone: 'border-emerald-500/60 bg-emerald-500/10 text-emerald-100' },
  meeting: { label: '開會中', icon: '🤝', tone: 'border-violet-500/60 bg-violet-500/10 text-violet-100' },
  wandering: { label: '巡走中', icon: '🚶', tone: 'border-amber-500/60 bg-amber-500/10 text-amber-100' },
  incident: { label: '事件中', icon: '🚨', tone: 'border-rose-500/70 bg-rose-500/10 text-rose-100' }
};

const officeMap = defaultOfficeMap;
const sceneZones = getOfficeSceneZones(officeMap);

function toPercentX(x: number): string {
  return `${(x / officeMap.width) * 100}%`;
}

function toPercentY(y: number): string {
  return `${(y / officeMap.height) * 100}%`;
}

function buildTokenBackground(accent: string): string {
  return `radial-gradient(circle at 28% 24%, rgba(255,255,255,0.95) 0%, ${accent} 42%, rgba(15,23,42,0.96) 100%)`;
}

export default function OfficePage() {
  const {
    agents,
    tasks,
    events,
    loading,
    error,
    notice,
    connectionStatus,
    connectionMessage,
    selectAgent,
    selectedAgentId
  } = useDashboardStore((s) => ({
    agents: s.agents,
    tasks: s.tasks,
    events: s.events,
    loading: s.loading,
    error: s.error,
    notice: s.notice,
    connectionStatus: s.connectionStatus,
    connectionMessage: s.connectionMessage,
    selectAgent: s.selectAgent,
    selectedAgentId: s.selectedAgentId
  }));

  const simulationRef = useRef<ReturnType<typeof createOfficeSimulation>>();
  if (!simulationRef.current) {
    simulationRef.current = createOfficeSimulation(officeMap);
  }
  const latestWorldRef = useRef({ agents, tasks, events });
  const [hoveredActorId, setHoveredActorId] = useState<string | null>(null);
  const [scene, setScene] = useState(() => simulationRef.current!.tick(0));

  useEffect(() => {
    latestWorldRef.current = { agents, tasks, events };
    simulationRef.current!.updateWorld(latestWorldRef.current, performance.now());
  }, [agents, tasks, events]);

  useEffect(() => {
    let frameId = 0;
    let lastPaint = 0;

    const tick = (now: number) => {
      simulationRef.current!.updateWorld(latestWorldRef.current, now);
      if (now - lastPaint >= 32) {
        setScene(simulationRef.current!.tick(now));
        lastPaint = now;
      }
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const hoveredActor = scene.actors.find((actor) => actor.agentId === hoveredActorId) ?? null;

  const activitySignals = useMemo(() => {
    const eventSignals = events
      .filter((event) => event.level !== 'info')
      .slice(0, 3)
      .map((event) => ({
        id: `event-${event.id}`,
        tone: event.level === 'error' ? 'error' : 'warning',
        text: `${getEventLevelLabel(event.level)} · ${event.message}`
      }));

    const taskSignals = tasks
      .filter((task) => task.status === 'blocked' || task.status === 'in_progress')
      .slice(0, 3)
      .map((task) => {
        const owner = agents.find((agent) => agent.id === task.assigneeAgentId);
        return {
          id: `task-${task.id}`,
          tone: task.status === 'blocked' ? 'warning' : 'info',
          text: `${task.status === 'blocked' ? '阻塞' : '進行中'} · ${owner ? getAgentLabel(owner) : '未指派'} · ${task.title}`
        };
      });

    return [...eventSignals, ...taskSignals].slice(0, 6);
  }, [agents, events, tasks]);

  const zoneOccupancy = useMemo(() => {
    const counts = new Map<string, number>();
    for (const actor of scene.actors) {
      counts.set(actor.zoneLabel, (counts.get(actor.zoneLabel) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 6);
  }, [scene.actors]);

  return (
    <section className="space-y-4">
      <Card title="辦公室視圖">
        <p className="mb-3 text-sm text-slate-300">{workforceLabels.officeStatus}</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(scene.stateCounts).map(([state, count]) => (
            <span
              key={state}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${stateMeta[state as OfficeActorState].tone}`}
            >
              {stateMeta[state as OfficeActorState].icon} {stateMeta[state as OfficeActorState].label} · {count}
            </span>
          ))}
          {zoneOccupancy.map((zoneItem) => (
            <span key={zoneItem.label} className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs text-slate-300">
              {zoneItem.label} · {zoneItem.count}
            </span>
          ))}
        </div>
      </Card>

      {loading && agents.length === 0 && <p className="text-sm text-slate-300">正在載入辦公室狀態…</p>}
      <DataHealthBanner error={error} notice={notice} connectionStatus={connectionStatus} connectionMessage={connectionMessage} />

      <Card title="辦公室地圖">
        <div className="mb-2 text-xs text-slate-400">{workforceLabels.officeHint}</div>
        {agents.length === 0 ? (
          <EmptyState
            title={workforceLabels.officeEmpty}
            detail="請保持後端運行，等待第一份即時快照或本機備援資料。"
          />
        ) : (
          <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70 shadow-2xl">
            <div className="relative aspect-[5/3] w-full">
              <img
                src={officeMap.backgroundImage}
                alt="ClawVille 辦公室背景圖"
                className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.08),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.08),transparent_30%)]" />

              {sceneZones.map((zoneItem) => {
                const center = getOfficeZoneCenter(zoneItem.id, officeMap);
                return (
                  <div
                    key={zoneItem.id}
                    className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-700/80 bg-slate-950/80 px-3 py-1 text-[11px] font-medium text-slate-300 backdrop-blur"
                    style={{ left: toPercentX(center.x), top: toPercentY(center.y) }}
                  >
                    {zoneItem.label}
                  </div>
                );
              })}

              {scene.actors.map((actor) => {
                const meta = stateMeta[actor.state];
                const selected = selectedAgentId === actor.agentId;

                return (
                  <button
                    key={actor.agentId}
                    type="button"
                    onClick={() => selectAgent(actor.agentId)}
                    onMouseEnter={() => setHoveredActorId(actor.agentId)}
                    onMouseLeave={() => setHoveredActorId((current) => (current === actor.agentId ? null : current))}
                    className={`absolute z-10 flex w-20 -translate-x-1/2 -translate-y-1/2 flex-col items-center transition-transform duration-150 ${
                      selected ? 'scale-105' : 'hover:scale-105'
                    }`}
                    style={{ left: toPercentX(actor.x), top: toPercentY(actor.y) }}
                  >
                    <span
                      className={`absolute inset-2 rounded-full blur-md ${selected ? 'opacity-90' : 'opacity-55'}`}
                      style={{ backgroundColor: actor.accent }}
                    />
                    <span
                      className={`relative flex h-12 w-12 items-center justify-center rounded-full border-2 text-sm font-black text-white shadow-xl ${
                        actor.state === 'working'
                          ? 'animate-agent-pulse'
                          : actor.state === 'incident'
                            ? 'animate-incident-alert'
                            : actor.state === 'wandering' || actor.state === 'resting'
                              ? 'animate-office-float'
                              : ''
                      } ${selected ? 'ring-2 ring-cyan-300/80 ring-offset-2 ring-offset-slate-950' : ''}`}
                      style={{
                        background: buildTokenBackground(actor.accent),
                        borderColor: selected ? '#67e8f9' : 'rgba(255,255,255,0.35)'
                      }}
                    >
                      {actor.initials}
                    </span>
                    <span className="absolute -right-1 top-0 rounded-full border border-slate-700/80 bg-slate-950/95 px-1.5 py-0.5 text-[10px]">
                      {meta.icon}
                    </span>
                    <span className="mt-1 max-w-[5.6rem] truncate rounded-full border border-slate-700/70 bg-slate-950/85 px-2 py-0.5 text-[10px] font-medium text-slate-100 shadow">
                      {actor.label}
                    </span>
                  </button>
                );
              })}

              {hoveredActor && (
                <div
                  className="pointer-events-none absolute z-20 w-60 rounded-2xl border border-slate-700/90 bg-slate-950/92 p-3 text-xs shadow-2xl backdrop-blur"
                  style={{
                    left: toPercentX(hoveredActor.x),
                    top: toPercentY(hoveredActor.y),
                    transform: `translate(${hoveredActor.x > officeMap.width * 0.82 ? '-90%' : '-50%'}, ${
                      hoveredActor.y < 130 ? '8%' : '-110%'
                    })`
                  }}
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{hoveredActor.label}</p>
                      <p className="text-[11px] text-slate-400">原始名稱：{hoveredActor.rawName}</p>
                    </div>
                    <Badge value={hoveredActor.status} />
                  </div>
                  <div className="space-y-1 text-slate-300">
                    <p>
                      <span className="text-slate-500">行為：</span> {stateMeta[hoveredActor.state].label}
                    </p>
                    <p>
                      <span className="text-slate-500">狀態：</span> {getAgentStatusLabel(hoveredActor.status)}
                    </p>
                    <p>
                      <span className="text-slate-500">區域：</span> {hoveredActor.zoneLabel}
                    </p>
                    <p>
                      <span className="text-slate-500">任務：</span> {hoveredActor.taskTitle ?? '暫無'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      <Card title="協作訊號">
        {activitySignals.length === 0 ? (
          <p className="text-sm text-slate-400">目前沒有明顯的協作活動。</p>
        ) : (
          <ul className="space-y-2">
            {activitySignals.map((signal) => (
              <li
                key={signal.id}
                className={`rounded-xl border px-3 py-2 text-sm ${
                  signal.tone === 'error'
                    ? 'border-rose-800/80 bg-rose-950/20 text-rose-100'
                    : signal.tone === 'warning'
                      ? 'border-amber-700/80 bg-amber-950/20 text-amber-100'
                      : 'border-cyan-800/70 bg-cyan-950/10 text-cyan-100'
                }`}
              >
                {signal.text}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
