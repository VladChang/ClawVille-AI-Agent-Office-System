import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Agent } from '../models/types';

interface AliasPayload {
  updatedAt: string;
  aliases: Record<string, string>;
}

function normalizeAlias(value: string | null): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export class OpenClawAliasStore {
  private aliases: Record<string, string> = {};
  private loadPromise: Promise<void> | null = null;

  constructor(private readonly filePath: string) {}

  private async ensureLoaded(): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = this.load();
    }

    await this.loadPromise;
  }

  private async load(): Promise<void> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const payload = JSON.parse(raw) as Partial<AliasPayload>;
      this.aliases = typeof payload.aliases === 'object' && payload.aliases !== null ? { ...payload.aliases } : {};
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      if (code !== 'ENOENT') {
        throw error;
      }
      this.aliases = {};
    }
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const payload: AliasPayload = {
      updatedAt: new Date().toISOString(),
      aliases: this.aliases
    };

    await writeFile(this.filePath, JSON.stringify(payload, null, 2));
  }

  async get(agentId: string): Promise<string | undefined> {
    await this.ensureLoaded();
    return this.aliases[agentId];
  }

  async set(agentId: string, displayName: string | null): Promise<string | undefined> {
    await this.ensureLoaded();
    const normalized = normalizeAlias(displayName);

    if (normalized) {
      this.aliases[agentId] = normalized;
    } else {
      delete this.aliases[agentId];
    }

    await this.persist();
    return normalized ?? undefined;
  }

  async apply(agents: Agent[]): Promise<Agent[]> {
    await this.ensureLoaded();
    return agents.map((agent) => ({
      ...agent,
      displayName: this.aliases[agent.id] ?? agent.displayName
    }));
  }
}
