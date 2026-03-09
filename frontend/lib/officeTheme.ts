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

type OfficeThemeDefinition = {
  id: string;
  label: string;
  defaultBackgroundImage: string;
  defaultPortraitBasePath: string;
  defaultPortraitExtension: 'svg' | 'png' | 'webp';
  backgroundFilename: string;
};

function matchesRole(role: string, keyword: string): boolean {
  return role.toLowerCase().includes(keyword);
}

const officeThemeDefinitions: Record<string, OfficeThemeDefinition> = {
  studio: {
    id: 'studio',
    label: 'Studio',
    defaultBackgroundImage: '/office/office-ai-showcase.svg',
    defaultPortraitBasePath: '/office/portraits',
    defaultPortraitExtension: 'svg',
    backgroundFilename: 'background.png'
  },
  succubus_showcase: {
    id: 'succubus_showcase',
    label: 'Succubus Showcase',
    defaultBackgroundImage: '/office/themes/succubus-showcase/background.png',
    defaultPortraitBasePath: '/office/themes/succubus-showcase/portraits',
    defaultPortraitExtension: 'png',
    backgroundFilename: 'background.png'
  }
};

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function resolveEnvValue(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}

function buildPortraits(basePath: string, extension: string): OfficeTheme['portraits'] {
  const portrait = (id: string, label: string, scale: number, offsetY: number): OfficePortraitAsset => ({
    id,
    label,
    image: `${basePath}/${id}.${extension}`,
    scale,
    offsetY
  });

  return {
    planner: portrait('planner', '規劃員工', 1.05, 0),
    researcher: portrait('researcher', '研究員工', 1.05, 0),
    builder: portrait('builder', '工具員工', 1.04, 2),
    reviewer: portrait('reviewer', '審查員工', 1.02, 1),
    responder: portrait('responder', '事件員工', 1.04, 1),
    staff: portrait('staff', '一般員工', 1.02, 1)
  };
}

function resolveThemeDefinition(themeId: string): OfficeThemeDefinition {
  return officeThemeDefinitions[themeId] ?? officeThemeDefinitions.studio;
}

function resolveOfficeAssetBasePath(): string | undefined {
  const assetBasePath = resolveEnvValue('NEXT_PUBLIC_OFFICE_THEME_ASSET_BASE');
  return assetBasePath ? trimTrailingSlash(assetBasePath) : undefined;
}

function resolveOfficeBackgroundImage(theme: OfficeThemeDefinition, assetBasePath: string | undefined): string {
  const backgroundOverride = resolveEnvValue('NEXT_PUBLIC_OFFICE_BACKGROUND_IMAGE');
  if (backgroundOverride) return backgroundOverride;
  if (assetBasePath) return `${assetBasePath}/${theme.backgroundFilename}`;
  return theme.defaultBackgroundImage;
}

function resolveOfficePortraitBasePath(theme: OfficeThemeDefinition, assetBasePath: string | undefined): string {
  const portraitBaseOverride = resolveEnvValue('NEXT_PUBLIC_OFFICE_PORTRAIT_BASE_PATH');
  if (portraitBaseOverride) return trimTrailingSlash(portraitBaseOverride);
  if (assetBasePath) return `${assetBasePath}/portraits`;
  return theme.defaultPortraitBasePath;
}

function resolveOfficePortraitExtension(theme: OfficeThemeDefinition): string {
  return resolveEnvValue('NEXT_PUBLIC_OFFICE_PORTRAIT_EXTENSION') ?? theme.defaultPortraitExtension;
}

function resolveDebugOverlayDefault(): boolean {
  const value = process.env.NEXT_PUBLIC_OFFICE_DEBUG_OVERLAY_DEFAULT?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

export function resolveOfficeTheme(themeId = process.env.NEXT_PUBLIC_OFFICE_THEME?.trim() || 'studio'): OfficeTheme {
  const theme = resolveThemeDefinition(themeId);
  const assetBasePath = resolveOfficeAssetBasePath();
  const backgroundImage = resolveOfficeBackgroundImage(theme, assetBasePath);
  const portraitBasePath = resolveOfficePortraitBasePath(theme, assetBasePath);
  const portraitExtension = resolveOfficePortraitExtension(theme);

  return {
    id: theme.id,
    label: theme.label,
    map: createOfficeMap(backgroundImage),
    portraits: buildPortraits(portraitBasePath, portraitExtension),
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
