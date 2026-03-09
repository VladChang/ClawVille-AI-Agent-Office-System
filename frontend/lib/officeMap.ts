import type { Agent } from '@/types/models';
import { polygonCentroid, rect, type Point, type Polygon } from '@/lib/officeGeometry';

export type { Point, Polygon } from '@/lib/officeGeometry';

export type OfficeZoneType = 'desk' | 'meeting' | 'break' | 'lounge' | 'hallway' | 'entrance' | 'incident';

export type OfficeZone = {
  id: string;
  label: string;
  type: OfficeZoneType;
  points: Polygon;
  anchorPoints: Point[];
};

export type OfficeAnchorPoint = {
  id: string;
  label: string;
  point: Point;
  zoneId?: string;
};

export type OfficeMap = {
  backgroundImage: string;
  width: number;
  height: number;
  walkableAreas: Polygon[];
  obstacles: Polygon[];
  zones: OfficeZone[];
  anchorPoints: OfficeAnchorPoint[];
};

function zone(id: string, label: string, type: OfficeZoneType, points: Polygon, anchorPoints: Point[]): OfficeZone {
  return { id, label, type, points, anchorPoints };
}

const plannerZone = zone('planner_desks', '規劃工位', 'desk', rect(70, 80, 250, 170), [
  { x: 100, y: 115 },
  { x: 290, y: 115 },
  { x: 100, y: 210 },
  { x: 290, y: 210 }
]);

const researchZone = zone('research_desks', '研究工位', 'desk', rect(360, 80, 250, 170), [
  { x: 390, y: 115 },
  { x: 580, y: 115 },
  { x: 390, y: 210 },
  { x: 580, y: 210 }
]);

const meetingZone = zone('meeting_room', '會議區', 'meeting', rect(850, 80, 280, 170), [
  { x: 920, y: 165 },
  { x: 995, y: 165 },
  { x: 1070, y: 165 }
]);

const archiveZone = zone('archive_desks', '記憶工位', 'desk', rect(70, 340, 220, 160), [
  { x: 95, y: 375 },
  { x: 260, y: 375 },
  { x: 95, y: 465 },
  { x: 260, y: 465 }
]);

const workshopZone = zone('workshop_desks', '工具工位', 'desk', rect(320, 340, 310, 160), [
  { x: 355, y: 375 },
  { x: 595, y: 375 },
  { x: 355, y: 465 },
  { x: 595, y: 465 }
]);

const reviewZone = zone('review_desks', '審查工位', 'desk', rect(670, 340, 160, 160), [
  { x: 700, y: 375 },
  { x: 805, y: 375 },
  { x: 700, y: 465 },
  { x: 805, y: 465 }
]);

const incidentZone = zone('incident_desk', '事件處理台', 'incident', rect(880, 340, 240, 160), [
  { x: 920, y: 390 },
  { x: 1000, y: 390 },
  { x: 1085, y: 390 }
]);

const loungeZone = zone('collab_lounge', '協作中樞', 'lounge', rect(620, 585, 190, 95), [
  { x: 660, y: 625 },
  { x: 720, y: 625 },
  { x: 780, y: 625 }
]);

const breakZone = zone('break_lounge', '休息區', 'break', rect(850, 585, 280, 95), [
  { x: 900, y: 625 },
  { x: 990, y: 625 },
  { x: 1080, y: 625 }
]);

const entranceZone = zone('main_entrance', '入口區', 'entrance', rect(40, 600, 160, 80), [
  { x: 120, y: 645 }
]);

const northHallZone = zone('north_hallway', '北側走道', 'hallway', rect(40, 260, 1100, 60), [
  { x: 180, y: 290 },
  { x: 550, y: 290 },
  { x: 930, y: 290 }
]);

const southHallZone = zone('south_hallway', '南側走道', 'hallway', rect(40, 520, 1100, 60), [
  { x: 180, y: 550 },
  { x: 550, y: 550 },
  { x: 930, y: 550 }
]);

const zones: OfficeZone[] = [
  plannerZone,
  researchZone,
  meetingZone,
  archiveZone,
  workshopZone,
  reviewZone,
  incidentZone,
  loungeZone,
  breakZone,
  entranceZone,
  northHallZone,
  southHallZone
];

export function createOfficeMap(backgroundImage: string): OfficeMap {
  return {
    backgroundImage,
    width: 1200,
    height: 720,
    walkableAreas: [
      plannerZone.points,
      researchZone.points,
      meetingZone.points,
      archiveZone.points,
      workshopZone.points,
      reviewZone.points,
      incidentZone.points,
      loungeZone.points,
      breakZone.points,
      entranceZone.points,
      northHallZone.points,
      southHallZone.points,
      rect(270, 80, 60, 600),
      rect(610, 80, 60, 600),
      rect(830, 80, 60, 600),
      rect(95, 560, 70, 120)
    ],
    obstacles: [
      rect(130, 125, 55, 28),
      rect(205, 125, 55, 28),
      rect(130, 175, 55, 28),
      rect(205, 175, 55, 28),
      rect(420, 125, 55, 28),
      rect(495, 125, 55, 28),
      rect(420, 175, 55, 28),
      rect(495, 175, 55, 28),
      rect(945, 125, 95, 55),
      rect(110, 380, 50, 28),
      rect(175, 380, 50, 28),
      rect(110, 430, 50, 28),
      rect(175, 430, 50, 28),
      rect(380, 375, 65, 32),
      rect(475, 375, 65, 32),
      rect(380, 430, 65, 32),
      rect(475, 430, 65, 32),
      rect(710, 385, 80, 42),
      rect(945, 370, 110, 44),
      rect(680, 610, 65, 26),
      rect(915, 610, 65, 26),
      rect(1005, 610, 65, 26)
    ],
    zones,
    anchorPoints: [
      { id: 'entry_spawn', label: '入口生成點', point: { x: 120, y: 645 }, zoneId: entranceZone.id },
      { id: 'north_west', label: '北側走道西段', point: { x: 180, y: 290 }, zoneId: northHallZone.id },
      { id: 'north_mid', label: '北側走道中央', point: { x: 550, y: 290 }, zoneId: northHallZone.id },
      { id: 'north_east', label: '北側走道東段', point: { x: 930, y: 290 }, zoneId: northHallZone.id },
      { id: 'south_west', label: '南側走道西段', point: { x: 180, y: 550 }, zoneId: southHallZone.id },
      { id: 'south_mid', label: '南側走道中央', point: { x: 550, y: 550 }, zoneId: southHallZone.id },
      { id: 'south_east', label: '南側走道東段', point: { x: 930, y: 550 }, zoneId: southHallZone.id },
      { id: 'lounge_hub', label: '協作節點', point: { x: 720, y: 625 }, zoneId: loungeZone.id }
    ]
  };
}

export const defaultOfficeMap: OfficeMap = createOfficeMap('/office/office-ai-showcase.svg');

const deskZoneIds = [
  plannerZone.id,
  researchZone.id,
  archiveZone.id,
  workshopZone.id,
  reviewZone.id
] as const;

function normalizedRole(role: string): string {
  return role.trim().toLowerCase();
}

function hashText(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function getOfficeZoneById(zoneId: string, officeMap: OfficeMap = defaultOfficeMap): OfficeZone | undefined {
  return officeMap.zones.find((zoneItem) => zoneItem.id === zoneId);
}

export function getOfficeZonesByType(type: OfficeZoneType, officeMap: OfficeMap = defaultOfficeMap): OfficeZone[] {
  return officeMap.zones.filter((zoneItem) => zoneItem.type === type);
}

export function getOfficeZoneCenter(zoneId: string, officeMap: OfficeMap = defaultOfficeMap): Point {
  const zoneItem = getOfficeZoneById(zoneId, officeMap);
  return polygonCentroid(zoneItem?.points ?? rect(0, 0, officeMap.width, officeMap.height));
}

export function resolveDeskZoneId(agent: Agent, officeMap: OfficeMap = defaultOfficeMap): string {
  const role = normalizedRole(agent.role);

  if (role.includes('plan') || role.includes('coord')) return plannerZone.id;
  if (role.includes('research') || role.includes('browser') || role.includes('analyst')) return researchZone.id;
  if (role.includes('memory') || role.includes('knowledge')) return archiveZone.id;
  if (role.includes('tool') || role.includes('builder') || role.includes('execute')) return workshopZone.id;
  if (role.includes('review') || role.includes('qa') || role.includes('critic')) return reviewZone.id;

  return deskZoneIds[hashText(agent.id) % deskZoneIds.length];
}

export function getZoneAnchorPoints(zoneId: string, officeMap: OfficeMap = defaultOfficeMap): Point[] {
  const zoneItem = getOfficeZoneById(zoneId, officeMap);
  return zoneItem?.anchorPoints ?? [];
}

export function getOfficeAnchorPoints(officeMap: OfficeMap = defaultOfficeMap): OfficeAnchorPoint[] {
  return officeMap.anchorPoints;
}
