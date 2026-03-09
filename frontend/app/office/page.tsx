'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Card } from '@/components/ui';
import { DataHealthBanner, EmptyState } from '@/components/dataState';
import { getAgentLabel, getAgentStatusLabel, getEventLevelLabel, workforceLabels } from '@/lib/presentation';
import { getOfficeAnchorPoints, getOfficeZoneCenter } from '@/lib/officeMap';
import { createOfficeSimulation, getOfficeSceneZones, type OfficeActorState } from '@/lib/officeSimulation';
import { resolveOfficePortraitAsset, resolveOfficeTheme } from '@/lib/officeTheme';
import { useDashboardStore } from '@/store/dashboardStore';

const stateMeta: Record<OfficeActorState, { label: string; icon: string; tone: string }> = {
  working: { label: '工作中', icon: '💼', tone: 'border-cyan-500/60 bg-cyan-500/10 text-cyan-100' },
  resting: { label: '休息中', icon: '☕', tone: 'border-emerald-500/60 bg-emerald-500/10 text-emerald-100' },
  meeting: { label: '開會中', icon: '🤝', tone: 'border-violet-500/60 bg-violet-500/10 text-violet-100' },
  wandering: { label: '巡走中', icon: '🚶', tone: 'border-amber-500/60 bg-amber-500/10 text-amber-100' },
  incident: { label: '事件中', icon: '🚨', tone: 'border-rose-500/70 bg-rose-500/10 text-rose-100' }
};

const officeTheme = resolveOfficeTheme();
const officeMap = officeTheme.map;
const sceneZones = getOfficeSceneZones(officeMap);
const officeAnchors = getOfficeAnchorPoints(officeMap);

function toPercentX(x: number): string {
  return `${(x / officeMap.width) * 100}%`;
}

function toPercentY(y: number): string {
  return `${(y / officeMap.height) * 100}%`;
}

function toSvgPoints(points: { x: number; y: number }[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(' ');
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
  const [debugOverlay, setDebugOverlay] = useState(officeTheme.debugOverlayDefault);
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
  const agentsById = useMemo(() => new Map(agents.map((agent) => [agent.id, agent])), [agents]);

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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            {workforceLabels.officeHint}
            <div className="mt-1 text-[11px] text-slate-500">
              正式展示模式預設隱藏地圖輔助標記；需要校正路線時再開啟偵錯覆蓋。
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDebugOverlay((current) => !current)}
            className="rounded-full border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-cyan-400/70 hover:text-cyan-100"
          >
            {debugOverlay ? '隱藏地圖偵錯' : '顯示地圖偵錯'}
          </button>
        </div>
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
              {debugOverlay && (
                <svg
                  viewBox={`0 0 ${officeMap.width} ${officeMap.height}`}
                  className="pointer-events-none absolute inset-0 h-full w-full"
                  aria-hidden="true"
                >
                  {officeMap.walkableAreas.map((polygon, index) => (
                    <polygon
                      key={`walkable-${index}`}
                      points={toSvgPoints(polygon)}
                      fill="rgba(34, 211, 238, 0.11)"
                      stroke="rgba(103, 232, 249, 0.42)"
                      strokeWidth="2"
                    />
                  ))}
                  {officeMap.obstacles.map((polygon, index) => (
                    <polygon
                      key={`obstacle-${index}`}
                      points={toSvgPoints(polygon)}
                      fill="rgba(251, 113, 133, 0.16)"
                      stroke="rgba(253, 164, 175, 0.55)"
                      strokeWidth="2"
                    />
                  ))}
                  {officeMap.zones.map((zoneItem) => (
                    <polygon
                      key={zoneItem.id}
                      points={toSvgPoints(zoneItem.points)}
                      fill="rgba(250, 204, 21, 0.05)"
                      stroke="rgba(250, 204, 21, 0.6)"
                      strokeDasharray="10 8"
                      strokeWidth="2"
                    />
                  ))}
                  {officeAnchors.map((anchor) => (
                    <g key={anchor.id}>
                      <circle cx={anchor.point.x} cy={anchor.point.y} r="7" fill="rgba(248, 250, 252, 0.9)" />
                      <circle cx={anchor.point.x} cy={anchor.point.y} r="16" fill="rgba(14, 165, 233, 0.14)" />
                    </g>
                  ))}
                </svg>
              )}

              {debugOverlay &&
                sceneZones.map((zoneItem) => {
                  const center = getOfficeZoneCenter(zoneItem.id, officeMap);
                  return (
                    <div
                      key={zoneItem.id}
                      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-700/80 bg-slate-950/85 px-3 py-1 text-[11px] font-medium text-slate-200 backdrop-blur"
                      style={{ left: toPercentX(center.x), top: toPercentY(center.y) }}
                    >
                      {zoneItem.label}
                    </div>
                  );
                })}

              {scene.actors.map((actor) => {
                const meta = stateMeta[actor.state];
                const selected = selectedAgentId === actor.agentId;
                const portrait = resolveOfficePortraitAsset(
                  agentsById.get(actor.agentId) ?? { role: actor.role, status: actor.status },
                  officeTheme
                );
                const zIndex = selected ? 5200 : hoveredActorId === actor.agentId ? 4600 : 1000 + Math.round(actor.y);

                return (
                  <button
                    key={actor.agentId}
                    type="button"
                    onClick={() => selectAgent(actor.agentId)}
                    onMouseEnter={() => setHoveredActorId(actor.agentId)}
                    onMouseLeave={() => setHoveredActorId((current) => (current === actor.agentId ? null : current))}
                    className={`absolute flex w-24 -translate-x-1/2 -translate-y-[76%] flex-col items-center transition-transform duration-150 ${
                      selected ? 'scale-105' : 'hover:scale-105'
                    }`}
                    style={{ left: toPercentX(actor.x), top: toPercentY(actor.y), zIndex }}
                  >
                    <span
                      className={`absolute bottom-4 h-4 w-14 rounded-full blur-md ${selected ? 'opacity-75' : 'opacity-45'}`}
                      style={{ backgroundColor: actor.accent }}
                    />
                    <span
                      className={`relative flex h-[4.8rem] w-[3.8rem] items-end justify-center overflow-hidden rounded-[1.3rem] border text-sm font-black text-white shadow-[0_18px_42px_rgba(15,23,42,0.45)] backdrop-blur ${
                        actor.state === 'working'
                          ? 'animate-agent-pulse'
                          : actor.state === 'incident'
                            ? 'animate-incident-alert'
                            : actor.state === 'wandering' || actor.state === 'resting'
                              ? 'animate-office-float'
                              : ''
                      } ${selected ? 'ring-2 ring-cyan-300/80 ring-offset-2 ring-offset-slate-950' : ''}`}
                      style={{
                        background: `linear-gradient(180deg, rgba(15,23,42,0.22) 0%, rgba(15,23,42,0.68) 100%), radial-gradient(circle at 50% 18%, ${actor.accent} 0%, rgba(15,23,42,0.2) 45%, rgba(2,6,23,0.88) 100%)`,
                        borderColor: selected ? '#67e8f9' : 'rgba(255,255,255,0.22)'
                      }}
                    >
                      <span
                        className="absolute inset-x-1 bottom-1 h-5 rounded-full opacity-70 blur-md"
                        style={{ backgroundColor: actor.accent }}
                      />
                      <img
                        src={portrait.image}
                        alt={`${actor.label} 角色圖像`}
                        className="relative z-10 h-[4.4rem] w-[3.5rem] object-contain"
                        style={{ transform: `translateY(${portrait.offsetY}px) scale(${portrait.scale})` }}
                      />
                    </span>
                    <span className="absolute -right-1 top-0 rounded-full border border-slate-700/80 bg-slate-950/95 px-1.5 py-0.5 text-[10px]">
                      {meta.icon}
                    </span>
                    <span
                      className="absolute -left-1 top-1 h-2.5 w-2.5 rounded-full border border-slate-950/80"
                      style={{ backgroundColor: actor.accent }}
                    />
                    <span className="mt-1 max-w-[6rem] truncate rounded-full border border-slate-700/70 bg-slate-950/88 px-2 py-0.5 text-[10px] font-medium text-slate-100 shadow">
                      {actor.label}
                    </span>
                    <span className="mt-1 rounded-full border border-slate-800/80 bg-slate-900/75 px-2 py-0.5 text-[10px] text-slate-300">
                      {meta.label}
                    </span>
                  </button>
                );
              })}

              {hoveredActor && (
                <div
                  className="pointer-events-none absolute w-60 rounded-2xl border border-slate-700/90 bg-slate-950/92 p-3 text-xs shadow-2xl backdrop-blur"
                  style={{
                    left: toPercentX(hoveredActor.x),
                    top: toPercentY(hoveredActor.y),
                    zIndex: 7000,
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
