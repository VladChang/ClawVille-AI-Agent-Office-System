import type { Agent } from '@/types/models';
import { createOfficeMap, type OfficeMap } from '@/lib/officeMap';

export type OfficePortraitAsset = {
  id: string;
  label: string;
  image: string;
  scale: number;
  offsetY: number;
};

export type OfficeTheme = {
  id: string;
  label: string;
  map: OfficeMap;
  portraits: Record<string, OfficePortraitAsset>;
  debugOverlayDefault: boolean;
};

function matchesRole(role: string, keyword: string): boolean {
  return role.toLowerCase().includes(keyword);
}

const studioPortraits: OfficeTheme['portraits'] = {
  planner: { id: 'planner', label: '規劃員工', image: '/office/portraits/planner.svg', scale: 1.05, offsetY: 0 },
  researcher: { id: 'researcher', label: '研究員工', image: '/office/portraits/researcher.svg', scale: 1.05, offsetY: 0 },
  builder: { id: 'builder', label: '工具員工', image: '/office/portraits/builder.svg', scale: 1.04, offsetY: 2 },
  reviewer: { id: 'reviewer', label: '審查員工', image: '/office/portraits/reviewer.svg', scale: 1.02, offsetY: 1 },
  responder: { id: 'responder', label: '事件員工', image: '/office/portraits/responder.svg', scale: 1.04, offsetY: 1 },
  staff: { id: 'staff', label: '一般員工', image: '/office/portraits/staff.svg', scale: 1.02, offsetY: 1 }
};

function resolveOfficeBackgroundImage(): string {
  return process.env.NEXT_PUBLIC_OFFICE_BACKGROUND_IMAGE?.trim() || '/office/office-ai-showcase.svg';
}

function resolveDebugOverlayDefault(): boolean {
  const value = process.env.NEXT_PUBLIC_OFFICE_DEBUG_OVERLAY_DEFAULT?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

export function resolveOfficeTheme(themeId = process.env.NEXT_PUBLIC_OFFICE_THEME?.trim() || 'studio'): OfficeTheme {
  const backgroundImage = resolveOfficeBackgroundImage();

  if (themeId === 'studio') {
    return {
      id: 'studio',
      label: 'Studio',
      map: createOfficeMap(backgroundImage),
      portraits: studioPortraits,
      debugOverlayDefault: resolveDebugOverlayDefault()
    };
  }

  return {
    id: themeId,
    label: themeId,
    map: createOfficeMap(backgroundImage),
    portraits: studioPortraits,
    debugOverlayDefault: resolveDebugOverlayDefault()
  };
}

export function resolveOfficePortraitAsset(agent: Pick<Agent, 'role' | 'status'>, theme: OfficeTheme = resolveOfficeTheme()): OfficePortraitAsset {
  if (agent.status === 'offline') return theme.portraits.responder;
  if (matchesRole(agent.role, 'plan') || matchesRole(agent.role, 'coord')) return theme.portraits.planner;
  if (matchesRole(agent.role, 'research') || matchesRole(agent.role, 'browser') || matchesRole(agent.role, 'analyst')) return theme.portraits.researcher;
  if (matchesRole(agent.role, 'tool') || matchesRole(agent.role, 'builder') || matchesRole(agent.role, 'execute')) return theme.portraits.builder;
  if (matchesRole(agent.role, 'review') || matchesRole(agent.role, 'qa') || matchesRole(agent.role, 'critic')) return theme.portraits.reviewer;
  return theme.portraits.staff;
}
