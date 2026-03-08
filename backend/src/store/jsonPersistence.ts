import { readFileSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Agent, Event, Task } from '../models/types';

export interface TaskTransitionRecord {
  taskId: string;
  from: string;
  to: string;
  at: string;
}

export interface AgentStatusRecord {
  agentId: string;
  from: string;
  to: string;
  at: string;
}

export interface PersistedRuntimeData {
  version: 1;
  snapshot: {
    agents: Agent[];
    tasks: Task[];
    events: Event[];
  };
  history: {
    taskTransitions: TaskTransitionRecord[];
    agentStatusChanges: AgentStatusRecord[];
  };
}

function flushIntervalMs(): number {
  const parsed = Number(process.env.RUNTIME_PERSISTENCE_FLUSH_MS);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 200;
}

export class JsonFilePersistence {
  private pendingSerialized: string | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  load(): PersistedRuntimeData | null {
    try {
      const raw = readFileSync(this.filePath, 'utf8');
      const data = JSON.parse(raw) as PersistedRuntimeData;
      if (data?.version !== 1) return null;
      if (!Array.isArray(data.snapshot?.agents) || !Array.isArray(data.snapshot?.tasks) || !Array.isArray(data.snapshot?.events)) {
        return null;
      }
      return data;
    } catch {
      return null;
    }
  }

  save(data: PersistedRuntimeData): void {
    this.pendingSerialized = JSON.stringify(data, null, 2);
    this.scheduleFlush();
  }

  async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    await this.flushPending();
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;

    const delay = flushIntervalMs();
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flushPending().catch((error) => {
        console.error('[runtime-persistence] failed to flush state', error);
      });
    }, delay);

    this.flushTimer.unref?.();
  }

  private async flushPending(): Promise<void> {
    const serialized = this.pendingSerialized;
    if (!serialized) {
      await this.writeChain;
      return;
    }

    this.pendingSerialized = null;
    const tmpPath = `${this.filePath}.tmp`;

    this.writeChain = this.writeChain
      .catch(() => undefined)
      .then(async () => {
        await mkdir(path.dirname(this.filePath), { recursive: true });
        await writeFile(tmpPath, serialized, 'utf8');
        await rename(tmpPath, this.filePath);
      });

    await this.writeChain;
  }
}
