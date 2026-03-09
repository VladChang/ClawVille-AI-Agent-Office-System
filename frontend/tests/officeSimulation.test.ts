import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultOfficeMap } from '../lib/officeMap';
import { buildOfficeNavigationGrid, findOfficePath, isWalkableCell, pointToCell } from '../lib/officePathfinding';
import { createOfficeSimulation, resolveActorDirective } from '../lib/officeSimulation';

test('office navigation grid marks desk islands as obstacles but keeps hallways walkable', () => {
  const grid = buildOfficeNavigationGrid(defaultOfficeMap, 20);

  assert.equal(isWalkableCell(grid, pointToCell(grid, { x: 150, y: 140 })), false);
  assert.equal(isWalkableCell(grid, pointToCell(grid, { x: 180, y: 290 })), true);
});

test('office pathfinding returns a route from entrance to meeting room without crossing blocked desk cells', () => {
  const grid = buildOfficeNavigationGrid(defaultOfficeMap, 20);
  const path = findOfficePath(grid, { x: 120, y: 645 }, { x: 995, y: 165 });

  assert.equal(path.length > 3, true);
  assert.equal(path.every((point) => isWalkableCell(grid, pointToCell(grid, point))), true);
});

test('actor directive prefers incident, meeting, and work states from runtime data', () => {
  const baseAgent = {
    id: 'a-1',
    name: 'Nova',
    role: 'Planner',
    status: 'busy' as const,
    updatedAt: '2026-03-09T00:00:00.000Z'
  };

  assert.equal(
    resolveActorDirective(
      { ...baseAgent, status: 'offline' },
      undefined,
      []
    ),
    'incident'
  );

  assert.equal(
    resolveActorDirective(baseAgent, { id: 't-1', title: 'Blocked', status: 'blocked', priority: 'high', createdAt: '', updatedAt: '' }, []),
    'meeting'
  );

  assert.equal(
    resolveActorDirective(baseAgent, { id: 't-2', title: 'Build', status: 'in_progress', priority: 'high', createdAt: '', updatedAt: '' }, []),
    'working'
  );
});

test('office simulation keeps displayName labels and moves actors into stateful zones', () => {
  const simulation = createOfficeSimulation(defaultOfficeMap);
  const now = 1_000;

  simulation.updateWorld(
    {
      agents: [
        {
          id: 'a-7',
          name: 'openclaw-alpha',
          displayName: '阿爪',
          role: 'Planner',
          status: 'busy',
          updatedAt: '2026-03-09T00:00:00.000Z'
        }
      ],
      tasks: [
        {
          id: 't-7',
          title: '整理測試資料',
          assigneeAgentId: 'a-7',
          status: 'in_progress',
          priority: 'high',
          createdAt: '2026-03-09T00:00:00.000Z',
          updatedAt: '2026-03-09T00:00:00.000Z'
        }
      ],
      events: []
    },
    now
  );

  const first = simulation.tick(now);
  const actor = first.actors[0];
  assert.equal(actor.label, '阿爪');
  assert.equal(actor.state, 'working');

  const progressed = simulation.tick(now + 2_500).actors[0];
  assert.equal(progressed.x > actor.x || progressed.y < actor.y, true);
});
