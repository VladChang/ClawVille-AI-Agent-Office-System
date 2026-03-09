import { getAgentDisplayName, getEventLevelWeight } from '../../shared/contracts';
import type { Agent, Event, Task } from '@/types/models';
import { clamp, distanceBetween, moveTowards, type Point } from '@/lib/officeGeometry';
import {
  defaultOfficeMap,
  getOfficeAnchorPoints,
  getOfficeZoneById,
  getOfficeZonesByType,
  getZoneAnchorPoints,
  resolveDeskZoneId,
  type OfficeMap
} from '@/lib/officeMap';
import { buildOfficeNavigationGrid, findOfficePath, type OfficeNavigationGrid } from '@/lib/officePathfinding';

export type OfficeActorState = 'working' | 'resting' | 'meeting' | 'wandering' | 'incident';
type OfficeDirective = 'working' | 'idle' | 'meeting' | 'incident';

export type OfficeActorSnapshot = {
  agentId: string;
  label: string;
  rawName: string;
  status: Agent['status'];
  state: OfficeActorState;
  zoneId: string;
  zoneLabel: string;
  taskTitle?: string;
  role: string;
  x: number;
  y: number;
  initials: string;
  accent: string;
};

export type OfficeSceneSnapshot = {
  actors: OfficeActorSnapshot[];
  stateCounts: Record<OfficeActorState, number>;
};

type ActorRuntime = {
  agentId: string;
  rawName: string;
  label: string;
  role: string;
  status: Agent['status'];
  taskTitle?: string;
  state: OfficeActorState;
  directive: OfficeDirective;
  zoneId: string;
  x: number;
  y: number;
  path: Point[];
  speed: number;
  idleCycle: number;
  nextRetargetAt: number;
  initials: string;
  accent: string;
};

function hashText(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function getInitials(label: string): string {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? '')
    .join('') || label.slice(0, 2).toUpperCase();
}

function buildAccent(agentId: string): string {
  const hue = hashText(agentId) % 360;
  return `hsl(${hue} 72% 62%)`;
}

function eventMentionsAgent(event: Event, agent: Agent): boolean {
  const haystack = `${event.message} ${event.type} ${JSON.stringify(event.metadata ?? {})}`.toLowerCase();
  const names = [agent.id, agent.name, agent.displayName ?? ''].map((value) => value.toLowerCase()).filter((value) => value.length > 0);
  return names.some((value) => haystack.includes(value));
}

function getRelevantEvents(agent: Agent, events: Event[]): Event[] {
  return events.filter((event) => eventMentionsAgent(event, agent)).sort((left, right) => {
    const timeDiff = new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime();
    if (timeDiff !== 0) return timeDiff;
    return getEventLevelWeight(right.level) - getEventLevelWeight(left.level);
  });
}

export function resolveActorDirective(agent: Agent, task: Task | undefined, events: Event[]): OfficeDirective {
  const relevantEvents = getRelevantEvents(agent, events);
  const topEvent = relevantEvents[0];

  if (agent.status === 'offline') return 'incident';
  if (topEvent?.level === 'error') return 'incident';
  if (task?.status === 'blocked' || topEvent?.level === 'warning') return 'meeting';
  if (task?.status === 'in_progress' || agent.status === 'busy') return 'working';

  return 'idle';
}

function chooseAnchor(points: Point[], seed: number): Point {
  return points[seed % Math.max(1, points.length)] ?? points[0];
}

function chooseIdlePlan(actor: ActorRuntime, homeZoneId: string, officeMap: OfficeMap, now: number): {
  state: OfficeActorState;
  zoneId: string;
  target: Point;
  nextRetargetAt: number;
} {
  const cycle = actor.idleCycle % 4;
  const hallwayAnchors = getOfficeAnchorPoints(officeMap).filter(
    (anchor) => anchor.zoneId === 'north_hallway' || anchor.zoneId === 'south_hallway'
  );

  if (cycle === 1) {
    const loungeAnchors = getZoneAnchorPoints('break_lounge', officeMap);
    return {
      state: 'resting',
      zoneId: 'break_lounge',
      target: chooseAnchor(loungeAnchors, hashText(actor.agentId) + actor.idleCycle),
      nextRetargetAt: now + 7000 + (hashText(actor.agentId) % 2200)
    };
  }

  const homeAnchors = getZoneAnchorPoints(homeZoneId, officeMap);
  const wanderPool = [
    ...hallwayAnchors.map((anchor) => ({ zoneId: anchor.zoneId ?? 'north_hallway', target: anchor.point })),
    ...homeAnchors.map((point) => ({ zoneId: homeZoneId, target: point }))
  ];
  const choice = wanderPool[(hashText(actor.agentId) + actor.idleCycle) % Math.max(1, wanderPool.length)] ?? {
    zoneId: homeZoneId,
    target: homeAnchors[0]
  };

  return {
    state: 'wandering',
    zoneId: choice.zoneId,
    target: choice.target,
    nextRetargetAt: now + 4500 + (hashText(actor.agentId) % 1800)
  };
}

function planActorRoute(actor: ActorRuntime, grid: OfficeNavigationGrid, target: Point, nextZoneId: string): void {
  const path = findOfficePath(grid, { x: actor.x, y: actor.y }, target);
  actor.path = path.length > 0 ? path : distanceBetween({ x: actor.x, y: actor.y }, target) <= grid.cellSize * 1.5 ? [target] : [];
  actor.zoneId = nextZoneId;
}

export class OfficeSimulationRuntime {
  private readonly officeMap: OfficeMap;
  private readonly grid: OfficeNavigationGrid;
  private readonly actors = new Map<string, ActorRuntime>();
  private lastTickMs = 0;

  constructor(officeMap: OfficeMap = defaultOfficeMap, cellSize = 20) {
    this.officeMap = officeMap;
    this.grid = buildOfficeNavigationGrid(officeMap, cellSize);
  }

  private spawnPoint(agent: Agent): Point {
    const anchor = getOfficeAnchorPoints(this.officeMap).find((item) => item.id === 'entry_spawn');
    const start = anchor?.point ?? { x: 120, y: 645 };
    return {
      x: start.x + (hashText(agent.id) % 24) - 12,
      y: start.y + (hashText(agent.name) % 16) - 8
    };
  }

  private upsertActor(agent: Agent, task: Task | undefined, events: Event[], now: number): void {
    const existing = this.actors.get(agent.id);
    const directive = resolveActorDirective(agent, task, events);
    const homeZoneId = resolveDeskZoneId(agent, this.officeMap);
    const label = getAgentDisplayName(agent);

    const actor =
      existing ??
      ({
        agentId: agent.id,
        rawName: agent.name,
        label,
        role: agent.role,
        status: agent.status,
        taskTitle: task?.title,
        state: 'wandering',
        directive: 'idle',
        zoneId: 'main_entrance',
        x: this.spawnPoint(agent).x,
        y: this.spawnPoint(agent).y,
        path: [],
        speed: 66 + (hashText(agent.id) % 22),
        idleCycle: 0,
        nextRetargetAt: now,
        initials: getInitials(label),
        accent: buildAccent(agent.id)
      } satisfies ActorRuntime);

    actor.rawName = agent.name;
    actor.label = label;
    actor.role = agent.role;
    actor.status = agent.status;
    actor.taskTitle = task?.title;

    const needsInitialRoute = existing === undefined;
    const directiveChanged = actor.directive !== directive;
    actor.directive = directive;

    if (directive === 'working') {
      const deskAnchors = getZoneAnchorPoints(homeZoneId, this.officeMap);
      actor.state = 'working';
      if (needsInitialRoute || directiveChanged || actor.zoneId !== homeZoneId) {
        planActorRoute(actor, this.grid, chooseAnchor(deskAnchors, hashText(agent.id)), homeZoneId);
      }
      actor.nextRetargetAt = now + 999999;
    } else if (directive === 'meeting') {
      const anchors = getZoneAnchorPoints('meeting_room', this.officeMap);
      actor.state = 'meeting';
      if (needsInitialRoute || directiveChanged || actor.zoneId !== 'meeting_room') {
        planActorRoute(actor, this.grid, chooseAnchor(anchors, hashText(agent.id)), 'meeting_room');
      }
      actor.nextRetargetAt = now + 999999;
    } else if (directive === 'incident') {
      const anchors = getZoneAnchorPoints('incident_desk', this.officeMap);
      actor.state = 'incident';
      if (needsInitialRoute || directiveChanged || actor.zoneId !== 'incident_desk') {
        planActorRoute(actor, this.grid, chooseAnchor(anchors, hashText(agent.id)), 'incident_desk');
      }
      actor.nextRetargetAt = now + 999999;
    } else if (needsInitialRoute || directiveChanged || now >= actor.nextRetargetAt) {
      actor.idleCycle += 1;
      const idlePlan = chooseIdlePlan(actor, homeZoneId, this.officeMap, now);
      actor.state = idlePlan.state;
      actor.nextRetargetAt = idlePlan.nextRetargetAt;
      planActorRoute(actor, this.grid, idlePlan.target, idlePlan.zoneId);
    }

    this.actors.set(agent.id, actor);
  }

  updateWorld(world: { agents: Agent[]; tasks: Task[]; events: Event[] }, nowMs: number): void {
    const tasksByAgentId = new Map<string, Task>();

    for (const task of world.tasks) {
      if (!task.assigneeAgentId) continue;
      const existing = tasksByAgentId.get(task.assigneeAgentId);
      if (!existing || new Date(task.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
        tasksByAgentId.set(task.assigneeAgentId, task);
      }
    }

    const liveIds = new Set<string>();
    for (const agent of world.agents) {
      liveIds.add(agent.id);
      this.upsertActor(agent, tasksByAgentId.get(agent.id), world.events, nowMs);
    }

    for (const actorId of Array.from(this.actors.keys())) {
      if (!liveIds.has(actorId)) this.actors.delete(actorId);
    }
  }

  tick(nowMs: number): OfficeSceneSnapshot {
    if (this.lastTickMs === 0) this.lastTickMs = nowMs;
    const deltaMs = clamp(nowMs - this.lastTickMs, 0, 40);
    this.lastTickMs = nowMs;

    for (const actor of this.actors.values()) {
      let remaining = (actor.speed * deltaMs) / 1000;

      while (remaining > 0 && actor.path.length > 0) {
        const nextPoint = actor.path[0];
        const distance = distanceBetween({ x: actor.x, y: actor.y }, nextPoint);

        if (distance <= remaining) {
          actor.x = nextPoint.x;
          actor.y = nextPoint.y;
          actor.path.shift();
          remaining -= distance;
        } else {
          const moved = moveTowards({ x: actor.x, y: actor.y }, nextPoint, remaining);
          actor.x = moved.x;
          actor.y = moved.y;
          remaining = 0;
        }
      }
    }

    const stateCounts: OfficeSceneSnapshot['stateCounts'] = {
      working: 0,
      resting: 0,
      meeting: 0,
      wandering: 0,
      incident: 0
    };

    const actors = Array.from(this.actors.values()).map((actor) => {
      stateCounts[actor.state] += 1;
      const zoneItem = getOfficeZoneById(actor.zoneId, this.officeMap);
      return {
        agentId: actor.agentId,
        label: actor.label,
        rawName: actor.rawName,
        status: actor.status,
        state: actor.state,
        zoneId: actor.zoneId,
        zoneLabel: zoneItem?.label ?? actor.zoneId,
        taskTitle: actor.taskTitle,
        role: actor.role,
        x: actor.x,
        y: actor.y,
        initials: actor.initials,
        accent: actor.accent
      } satisfies OfficeActorSnapshot;
    });

    return { actors, stateCounts };
  }
}

export function createOfficeSimulation(officeMap: OfficeMap = defaultOfficeMap): OfficeSimulationRuntime {
  return new OfficeSimulationRuntime(officeMap);
}

export function getOfficeSceneZones(officeMap: OfficeMap = defaultOfficeMap) {
  return [
    ...getOfficeZonesByType('desk', officeMap),
    ...getOfficeZonesByType('meeting', officeMap),
    ...getOfficeZonesByType('incident', officeMap),
    ...getOfficeZonesByType('break', officeMap),
    ...getOfficeZonesByType('lounge', officeMap)
  ];
}
